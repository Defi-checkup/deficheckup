import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { artForGuide, guideArt, splitGuideIntro } from './guide-art';

const source = new URL('../assets/guide-art/', import.meta.url);
const ids = [
  'aave-v2-rewards',
  'compound-v2',
  'cream',
  'dsproxy',
  'hyperliquid',
  'instadapp-dsa',
  'koi-lp',
  'solana-rent',
  'uni-2020',
  'zksync-lite',
];

describe('guide illustration mapping', () => {
  it('covers exactly the ten full guides and keeps the joint Koi/Mute artwork on koi-lp', () => {
    expect(Object.keys(guideArt).sort()).toEqual(ids);
    const catalog = new URL('../../../catalog/', import.meta.url);
    const featured = readdirSync(catalog, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && !['example', 'shared', 'node_modules'].includes(entry.name),
      )
      .filter((entry) =>
        /\nfeatured: true\n/.test(
          readFileSync(new URL(`${entry.name}/guide.en.md`, catalog), 'utf8'),
        ),
      )
      .map((entry) => entry.name);
    expect(featured.sort()).toEqual(ids);
    expect(artForGuide('koi-lp')?.file).toBe('koi-mute.webp');
    for (const id of ['koi-fees', 'koi-farm', 'koi-amplifier', 'solana-stake', 'home', 'toString'])
      expect(artForGuide(id)).toBeUndefined();
  });

  it('gives every illustration a unique, hand-written description rather than a file name', () => {
    const alts = Object.values(guideArt).map(({ alt }) => alt);
    expect(new Set(alts).size).toBe(10);
    for (const { file, alt } of Object.values(guideArt)) {
      expect(alt.trim().length).toBeGreaterThan(0);
      expect(alt).not.toMatch(/\.(?:png|webp|avif)\b|[_/]/i);
      expect(alt).not.toContain(file.replace('.webp', ''));
    }
  });

  it('maps to ten local, static WebPs within the repository budget', async () => {
    const expected = Object.values(guideArt).map(({ file }) => file);
    expect(readdirSync(source).sort()).toEqual(expected.sort());
    expect(new Set(expected).size).toBe(10);
    let total = 0;
    for (const file of expected) {
      expect(file).toMatch(/^[a-z0-9-]+\.webp$/);
      const bytes = readFileSync(new URL(file, source));
      const metadata = await sharp(bytes).metadata();
      expect(metadata.format).toBe('webp');
      expect([metadata.width, metadata.height]).toEqual([1376, 768]);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      total += bytes.length;
    }
    expect(total).toBeLessThan(1_500_000);
  });
});

describe('guide answer placement', () => {
  it('preserves the complete opening answer and all remaining compiled markup', () => {
    const intro = '<h1 id="guide">Guide</h1>\n<p>Answer with <a href="/">a link</a>.</p>';
    const rest = '\n<blockquote><p>Verification note.</p></blockquote>\n<h2>Details</h2>';
    expect(splitGuideIntro(intro + rest)).toEqual({ intro, rest });
    expect(() => splitGuideIntro('<h1>Guide</h1><h2>No opening answer</h2>')).toThrow();
  });
});
