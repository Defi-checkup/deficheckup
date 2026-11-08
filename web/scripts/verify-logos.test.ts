import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { protocolByCheck, protocolLogos, reportLogoForCheck } from '../src/lib/protocol-logos';
import { verifyLogos, verifySvg } from './verify-logos';

const svg = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

describe('official protocol logos', () => {
  it('audits every local asset and requires a decision for every catalog check', () => {
    verifyLogos(fileURLToPath(new URL('../public/logos', import.meta.url)));
    expect(new Set(Object.values(protocolByCheck))).toEqual(new Set(Object.keys(protocolLogos)));
  });

  it('shares identities across legacy checks and sends only presentation data to the browser', () => {
    for (const ids of [
      ['koi-fees', 'koi-lp', 'koi-amplifier', 'koi-farm'],
      ['safe-owner', 'safe-locking'],
      ['solana-rent', 'solana-stake'],
    ]) {
      const logos = ids.map(reportLogoForCheck);
      for (const logo of logos) expect(logo).toEqual(logos[0]);
    }
    expect(reportLogoForCheck('dsproxy')).toEqual({
      file: '/logos/defisaver.svg',
      backdrop: 'ink',
    });
    expect(reportLogoForCheck('unknown')).toBeUndefined();
    expect(reportLogoForCheck('constructor')).toBeUndefined();
    expect(reportLogoForCheck('kitty-loot-farm')).toEqual({ file: '/logos/kittypunch.png' });
    expect(reportLogoForCheck('uni-2020')).toBeUndefined();
    expect(protocolLogos.uniswap.kind).toBe('missing');
    for (const id of Object.keys(protocolByCheck)) {
      if (!reportLogoForCheck(id)) continue;
      expect(Object.keys(reportLogoForCheck(id)!)).toEqual(expect.arrayContaining(['file']));
      expect(JSON.stringify(reportLogoForCheck(id))).not.toMatch(
        /https|terms|fetchedOn|sourcePage/,
      );
    }
  });

  it.each([
    '<script>alert(1)</script>',
    '<foreignObject><div>foreign content</div></foreignObject>',
    '<path onload="alert(1)"/>',
    '<path ONCLICK="alert(1)"/>',
    '<use href="https://example.invalid/mark.svg#x"/>',
    '<use href="//example.invalid/mark.svg#x"/>',
    '<use xlink:href="data:image/svg+xml,x"/>',
    '<image href="data:image/png;base64,AA=="/>',
    '<style>@import "https://example.invalid/a.css";</style>',
    '<path style="fill:url(https://example.invalid/a.svg)"/>',
    '<path fill="url(https://example.invalid/a.svg#x)"/>',
    '<path fill="url( /a.svg#x )"/>',
    '<path fill="uRl(//example.invalid/a.svg)"/>',
    '<path fill="u&#114;l(https://example.invalid/a.svg)"/>',
    '<path fill="u\\72l(https://example.invalid/a.svg)"/>',
    '<a href="javascript:alert(1)"><path/></a>',
    '<animate attributeName="href" values="javascript:alert(1)"/>',
    '<svg xmlns="http://example.invalid"/>',
    '<g xmlns:evil="http://example.invalid"/>',
    '<path d="M0 0" d="M1 1"/>',
    '<g><path/></stop>',
    '</svg><svg xmlns="http://www.w3.org/2000/svg">',
  ])('rejects active, remote, encoded or malformed content: %s', (content) => {
    expect(() => verifySvg(svg(content))).toThrow();
  });

  it('rejects declarations, entities, processing instructions and trailing content', () => {
    for (const unsafe of [
      '<!DOCTYPE svg SYSTEM "https://example.invalid/a.dtd">' + svg(''),
      '<?xml-stylesheet href="https://example.invalid/a.css"?>' + svg(''),
      svg('') + 'trailing',
      svg('') + svg(''),
      '<svg/>',
      '<svg xmlns="http://www.w3.org/2000/svg">',
    ])
      expect(() => verifySvg(unsafe)).toThrow();
  });

  it('allows original paths, transforms and fragment-only gradients without CSS', () => {
    expect(() =>
      verifySvg(
        svg(
          '<defs><linearGradient id="a"><stop offset="0" stop-color="#ffffff"/></linearGradient></defs><g transform="scale(1)"><path fill="url(#a)" d="M0 0h10v10z"/></g>',
        ),
      ),
    ).not.toThrow();
  });
});
