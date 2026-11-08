import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checks } from '@deficheckup/catalog';
import type { CheckRun, Finding } from '@deficheckup/engine';
import Report from '../components/Report';
import ScanProgress from '../components/ScanProgress';
import { groupedFindings, groupedProtocolFindings, reportValue, totals } from './report';

const first = '0x000000000000000000000000000000000000dEaD';
const second = '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891';
const unknown: Finding = {
  title: 'Synthetic balance',
  network: 'ethereum',
  amount: { raw: 2_000_000_000_000_000_000n, decimals: 18, symbol: 'ETH' },
  valueUsd: null,
  claimCostUsd: null,
  deadline: null,
};
const unavailable: Finding = { ...unknown, priceStatus: 'unavailable' };
function run(address: string, checkId: string, ...findings: [Finding, ...Finding[]]): CheckRun {
  return { address, checkId, durationMs: 1, outcome: { kind: 'found', findings } };
}
function render(runs: CheckRun[], multi = false) {
  return renderToStaticMarkup(
    createElement(Report, {
      checks,
      networks: ['ethereum'],
      runs,
      wallets: (multi ? [first, second] : [first]).map((address) => ({ address, input: address })),
    }),
  );
}

describe('price outages in reports', () => {
  it.each([false, true])(
    'keeps all failed prices visible as tokens without a zero total (multi-wallet: %s)',
    (multi) => {
      const runs = [
        run(first, 'lido-withdrawals', unavailable),
        run(multi ? second : first, 'liquity-surplus', {
          ...unavailable,
          amount: { raw: 13730n, decimals: 0, symbol: 'USDC' },
        }),
      ];
      expect(totals(runs)).toMatchObject({
        count: 2,
        knownUsd: 0,
        unpriced: 0,
        pricesUnavailable: 2,
        incomplete: 0,
      });
      for (const group of [groupedFindings(runs), groupedProtocolFindings(runs)]) {
        expect(group.priced).toHaveLength(2);
        expect(group.unpriced).toEqual([]);
      }
      const html = render(runs, multi);
      expect(html).toContain(
        'Prices unavailable right now for 2 findings. Amounts are shown in tokens; try again in a minute.',
      );
      expect(html).toContain('2 ETH · 13,730 USDC · prices unavailable for 2');
      expect(html.match(/class="panel finding"/g)).toHaveLength(2);
      expect(html).toContain('<p class="mono subtitle">price unavailable</p>');
      expect(html).toContain('<dd>price unavailable</dd>');
      expect(html).not.toContain('≈ $0.00');
      expect(html).not.toContain('may include spam');
      expect(html).not.toContain('Show 2 unpriced');
      expect(html).toContain('0 priced');
    },
  );

  it.each([false, true])(
    'labels only the known value as partial and retains failures in a mixed card (multi-wallet: %s)',
    (multi) => {
      const runs = [
        run(first, 'lido-withdrawals', { ...unknown, valueUsd: 12.5 }),
        run(multi ? second : first, 'lido-withdrawals', unavailable),
      ];
      const html = render(runs, multi);
      expect(reportValue(runs)).toBe('≈ $12.50 known, prices unavailable for 1');
      expect(html).toContain('≈ $12.50 known, prices unavailable for 1');
      expect(html).toContain('Prices unavailable right now for 1 finding.');
      expect(html).toContain('1 priced · 0 unpriced');
      expect(html.match(/class="panel finding"/g)).toHaveLength(1);
      expect(html).toContain('price unavailable');
      expect(html).not.toContain('may include spam');
    },
  );

  it('preserves a real zero price as a known partial total when another lookup fails', () => {
    const runs = [run(first, 'lido-withdrawals', { ...unknown, valueUsd: 0 }, unavailable)];
    expect(reportValue(runs)).toBe('≈ $0.00 known, prices unavailable for 1');
    expect(totals(runs)).toMatchObject({ pricesUnavailable: 1, unpriced: 0 });
  });

  it('keeps unknown tokens collapsed and excluded even alongside an outage', () => {
    const html = render([
      run(first, 'lido-withdrawals', unavailable),
      run(first, 'dsproxy', unknown),
    ]);
    expect(html).toContain('1 unpriced (excluded from the total)');
    expect(html).toContain('Show 1 unpriced finding');
    expect(html).toContain('These may include spam or dust.');
    expect(html.match(/class="panel finding"/g)).toHaveLength(1);
    expect(html).not.toContain('≈ $0.00');
    const mixed = render([run(first, 'lido-withdrawals', unavailable, unknown)]);
    expect(mixed).toContain('1 unpriced (excluded from the total)');
    expect(mixed).toContain('Unpriced positions may include spam or dust.');
    expect(mixed).toContain('USD estimate unavailable');
    expect(mixed).toContain('price unavailable');
  });

  it('keeps normal prices and legacy unknown-token reports unchanged', () => {
    const runs = [
      run(first, 'lido-withdrawals', { ...unknown, valueUsd: 13730 }),
      run(first, 'dsproxy', unknown),
    ];
    const html = render(runs);
    expect(reportValue(runs)).toBe('≈ $13,730.00');
    expect(html).toContain('1 priced · 1 unpriced (excluded from the total)');
    expect(html).toContain('Show 1 unpriced finding');
    expect(html).not.toContain('Prices unavailable');
    expect(html).not.toContain('prices unavailable for');
  });

  it('shows every token separately when multiple prices failed in one protocol', () => {
    const html = render([
      run(first, 'lido-withdrawals', unavailable, {
        ...unavailable,
        amount: { raw: 10n, decimals: 0, symbol: 'USDC' },
      }),
    ]);
    expect(html).toContain('<p class="value">2 ETH · 10 USDC</p>');
    expect(html).toContain('price unavailable');
    expect(html).not.toContain('≈ $0.00');
  });

  it('shows the same failure label and token quantities while scanning', () => {
    const html = renderToStaticMarkup(
      createElement(ScanProgress, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: first, address: first }],
        walletIndex: 0,
        finished: [run(first, 'lido-withdrawals', unavailable)],
        titleRef: null,
      }),
    );
    expect(html).toContain('<p class="value">2 ETH</p>');
    expect(html).toContain('price unavailable');
    expect(html).not.toContain('unpriced (excluded');
    expect(html).not.toContain('may include spam');
  });
});
