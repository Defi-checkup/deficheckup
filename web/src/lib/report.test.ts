import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checks } from '@deficheckup/catalog';
import type { CheckRun, Finding } from '@deficheckup/engine';
import { describe, expect, it } from 'vitest';
import Report, { AddressWarning, FindingCard, ProtocolName } from '../components/Report';
import Scanner from '../components/Scanner';
import TokenCoin from '../components/TokenCoin';
import { checksForAddress, descriptions } from './catalog';
import {
  displayTokenAmount,
  groupedFindings,
  positionLabels,
  splitInputs,
  tokenAmount,
  totals,
  usd,
} from './report';
import { reportLogoForCheck } from './protocol-logos';

const ADDRESS = '0x000000000000000000000000000000000000dEaD';
const finding: Finding = {
  title: 'Synthetic balance',
  network: 'ethereum',
  amount: { raw: 1n, decimals: 18, symbol: 'TEST' },
  valueUsd: null,
  claimCostUsd: 1.239,
  deadline: '2026-12-01',
  heldBy: ADDRESS,
  note: 'Repay the debt before withdrawing.',
};
function run(checkId: string, outcome: CheckRun['outcome']): CheckRun {
  return { address: ADDRESS, checkId, outcome, durationMs: 1 };
}

describe('scanner input and amounts', () => {
  it.each(['found', 'nothing', 'error'] as const)(
    'ends the final %s report with one discreet support link for one or several wallets',
    (kind) => {
      const outcome: CheckRun['outcome'] =
        kind === 'found'
          ? { kind, findings: [finding] }
          : kind === 'error'
            ? { kind, reason: 'Synthetic offline failure' }
            : { kind };
      const addresses = [ADDRESS, '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891'];
      for (const count of [1, 2]) {
        const selected = addresses.slice(0, count);
        const html = renderToStaticMarkup(
          createElement(Report, {
            wallets: selected.map((address) => ({ address, input: address })),
            runs: selected.map((address) => ({ ...run('merkl', outcome), address })),
            checks,
            networks: ['ethereum'],
          }),
        );
        expect(html.match(/href="\/support"/g)).toHaveLength(1);
        expect(
          html.endsWith(
            '<p class="subtitle">DeFi Checkup is free and open source. If it helped you, you can <a href="/support">support it</a>.</p></section>',
          ),
        ).toBe(true);
      }
    },
  );

  it('renders a proven position with an unknown amount without inventing a token or USD value', () => {
    const position = { ...finding, amount: null, valueUsd: null, claimCostUsd: null };
    expect(tokenAmount(null)).toBe('Amount unavailable');
    const html = renderToStaticMarkup(
      createElement(FindingCard, {
        finding: position,
        check: checks.find((check) => check.id === 'meteora-dlmm')!,
        index: 0,
      }),
    );
    expect(html).toContain('Amount unavailable');
    expect(html).toContain('USD estimate unavailable');
    expect(html).toContain('POS');
    expect(html).not.toContain('0 SOL');
    expect(totals([run('meteora-dlmm', { kind: 'found', findings: [position] })])).toMatchObject({
      count: 1,
      knownUsd: 0,
      unpriced: 1,
    });
  });
  it('accepts commas and lines, removes empty entries and exact repeats', () => {
    expect(splitInputs(` ${ADDRESS}, name.eth\r\n\n${ADDRESS}, `)).toEqual([ADDRESS, 'name.eth']);
  });
  it('preserves tiny balances and integers beyond floating point precision', () => {
    expect(tokenAmount(finding.amount)).toBe('0.000000000000000001 TEST');
    expect(tokenAmount({ raw: 123456789012345678901234n, decimals: 2, symbol: 'X' })).toBe(
      '1234567890123456789012.34 X',
    );
    expect(tokenAmount({ raw: 2000000n, decimals: 6, symbol: 'USDC' })).toBe('2 USDC');
  });
  it('never rounds estimates up or equates an unknown price with zero', () => {
    expect(usd(1.239)).toBe('≈ $1.23');
    expect(usd(0.009)).toBe('≈ < $0.01');
    expect(usd(null)).toBe('USD estimate unavailable');
    expect(usd(0)).toBe('≈ $0.00');
  });
});

describe('compact finding display', () => {
  it.each([
    [1n, 18, '< 0.0001 ETH'],
    [99999999999999n, 18, '< 0.0001 ETH'],
    [100000000000000n, 18, '0.0001 ETH'],
    [5157442565931272696n, 18, '5.15744 ETH'],
    [1950000000000000000000n, 18, '1,950 ETH'],
    [123456789012345678901234n, 2, '1,234,560,000,000,000,000,000 ETH'],
    [999999999n, 6, '999.999 ETH'],
    [9999999n, 0, '9,999,990 ETH'],
    [0n, 18, '0 ETH'],
    [-123456789n, 6, '-123.457 ETH'],
  ])('formats %s units at %s decimals conservatively', (raw, decimals, expected) => {
    expect(displayTokenAmount({ raw, decimals, symbol: 'ETH' })).toBe(expected);
  });
  it('keeps unavailable amounts unknown', () => {
    expect(displayTokenAmount(null)).toBe('Amount unavailable');
  });
  it('does not inflate any displayed balance across precision boundaries', () => {
    for (const decimals of [0, 2, 6, 18]) {
      for (const raw of [1n, 999999n, 1000001n, 999999999n, 5157442565931272696n, -999999999n]) {
        const result = displayTokenAmount({ raw, decimals, symbol: 'T' });
        if (result.startsWith('<')) {
          expect(raw * 10000n).toBeLessThan(10n ** BigInt(decimals));
          continue;
        }
        const [whole, fraction = ''] = result.replaceAll(',', '').split(' ')[0]!.split('.');
        const displayed = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);
        expect(displayed).toBeLessThanOrEqual(raw);
      }
    }
  });
  it.each(['UNI', 'WETH', 'aUSDC', 'USDC.e', 'stkAAVE'])(
    'fits %s without silently cutting the symbol',
    (symbol) => {
      const html = renderToStaticMarkup(createElement(TokenCoin, { symbol, index: 0 }));
      expect(html).toContain(`aria-label="${symbol}"`);
      expect(html).toContain(`>${symbol.length > 5 ? symbol.slice(0, 3) + '+' : symbol}</text>`);
    },
  );
  it('closes Details by default, keeps deadlines visible and puts full amounts and addresses inside', () => {
    const html = renderToStaticMarkup(
      createElement(FindingCard, {
        finding: {
          ...finding,
          amount: { raw: 5157442565931272696n, decimals: 18, symbol: 'WETH' },
        },
        check: checks.find((check) => check.id === 'hyperliquid')!,
        index: 0,
      }),
    );
    const [card, details] = html.split('<details class="finding-disclosure">');
    expect(card).toContain('5.15744 WETH');
    expect(card).toContain('Claim by 2026-12-01');
    for (const text of [
      'Estimated claim cost',
      ADDRESS,
      finding.note!,
      'Official app',
      '5.157442565931272696 WETH',
    ]) {
      expect(card).not.toContain(text);
      expect(details).toContain(text);
    }
    expect(html).not.toContain('<details open');
    expect(details).toContain('<summary>Details');
  });
  it('provides short position labels for each check that can find recoverable balances', () => {
    for (const check of checks.filter((check) => check.id !== 'cream'))
      expect(positionLabels[check.id]).toBeTruthy();
  });
  it('shows a mixed group once, exposes every deadline and retains each position in Details', () => {
    const positions = [
      { ...finding, title: 'First pool', valueUsd: 12.5 },
      { ...finding, title: 'Second pool', deadline: '2026-12-02', amount: null, valueUsd: null },
    ] as const;
    const group = groupedFindings([run('koi-fees', { kind: 'found', findings: positions })])
      .priced[0]!;
    const html = renderToStaticMarkup(
      createElement(FindingCard, {
        check: checks.find((check) => check.id === 'koi-fees')!,
        finding: group.findings[0]!,
        group,
        index: 0,
      }),
    );
    const [card, details] = html.split('<details class="finding-disclosure">');
    expect(card).toContain('Ethereum · 2 positions');
    expect(card).toContain('≈ $12.50');
    expect(card).toContain('known value');
    expect(card).toContain('1 unpriced (excluded from the total)');
    expect(card).toContain('Claim by 2026-12-01 · 2026-12-02');
    expect(details?.match(/<li>/g)).toHaveLength(2);
    for (const text of [
      'First pool',
      'Second pool',
      '0.000000000000000001 TEST',
      'Amount unavailable',
      ADDRESS,
      finding.note!,
    ]) {
      expect(details).toContain(text);
    }
    expect(html.match(/Official app/g)).toHaveLength(1);
  });
});

describe('report completeness', () => {
  it('renders official identities for findings and lost/fake cards, with a text fallback', () => {
    const reportChecks = checks.map((check) => ({
      ...check,
      reportLogo: reportLogoForCheck(check.id),
    }));
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks: reportChecks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs: [
          run('hyperliquid', { kind: 'found', findings: [{ ...finding, valueUsd: 1 }] }),
          run('cream', { kind: 'lost', reason: 'Paused.' }),
          run('compound-v2', { kind: 'fake', reason: 'Debt.' }),
          run('uni-2020', { kind: 'lost', reason: 'Synthetic unavailable position.' }),
        ],
      }),
    );
    expect(html.match(/<img /g)).toHaveLength(3);
    for (const name of ['hyperliquid', 'cream', 'compound'])
      expect(html).toContain(`/logos/${name}.svg`);
    expect(
      html.match(/width="24" height="24" alt="" loading="lazy" decoding="async"/g),
    ).toHaveLength(3);
    expect(html).toContain('Uniswap UNI airdrop (2020): lost');
    expect(html).not.toContain('/logos/uniswap');
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain('sourcePage');
  });

  it('keeps logos out of the initial home and scanning cards even when metadata is present', () => {
    const reportChecks = checks.map((check) => ({
      ...check,
      reportLogo: reportLogoForCheck(check.id),
    }));
    const home = renderToStaticMarkup(
      createElement(Scanner, { checks: reportChecks, networks: ['ethereum'] }),
    );
    expect(home).not.toContain('<img');
    const check = reportChecks.find((check) => check.id === 'hyperliquid')!;
    const scanning = renderToStaticMarkup(createElement(FindingCard, { check, finding, index: 0 }));
    expect(scanning).toContain(check.name);
    expect(scanning).not.toContain('<img');
    expect(renderToStaticMarkup(createElement(ProtocolName, { check: checks[0]! }))).toBe(
      checks[0]!.name,
    );
  });

  it('keeps the shared scan warning complete', () => {
    const html = renderToStaticMarkup(createElement(AddressWarning));
    expect(html).toContain('Avoid address poisoning:');
    expect(html).toContain('copy addresses from your own wallet');
    expect(html).toContain('transaction history');
    expect(html).toContain('compare them in full');
  });
  it('keeps unpriced findings out of USD totals and counts partial checks', () => {
    expect(
      totals([
        run('hyperliquid', {
          kind: 'found',
          findings: [finding, { ...finding, valueUsd: 12.5 }],
          partial: 'A read failed.',
        }),
        run('merkl', { kind: 'error', reason: 'Unavailable' }),
      ]),
    ).toEqual({ count: 2, knownUsd: 12.5, unpriced: 1, pricesUnavailable: 0, incomplete: 2 });
  });
  it('renders all actionable details, protocol notices and failures', () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs: [
          run('hyperliquid', {
            kind: 'found',
            findings: [{ ...finding, valueUsd: 1 }],
            partial: 'A read failed.',
            notices: ['Unrecoverable rewards remain.'],
          }),
          run('cream', { kind: 'lost', reason: 'Withdrawals are paused.' }),
          run('compound-v2', { kind: 'fake', reason: 'Debt exceeds collateral.' }),
          run('merkl', { kind: 'error', reason: 'Service unavailable.' }),
          run('uni-2020', { kind: 'nothing', alreadyClaimed: true }),
        ],
      }),
    );
    for (const text of [
      ADDRESS,
      '0.000000000000000001 TEST',
      '≈ $1.23',
      '2026-12-01',
      finding.note!,
      'Show 2 failed or partial checks',
      'Unrecoverable rewards remain.',
      'Withdrawals are paused.',
      'Debt exceeds collateral.',
      'Official app',
      'Read our guide',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('https://app.hyperliquid.xyz');
    expect(html).toContain('/protocols/hyperliquid/');
  });
  it('groups by check and wallet, sorts by known total, preserves ties and never mutates inputs', () => {
    const runs = [
      run('merkl', {
        kind: 'found',
        findings: [{ ...finding, valueUsd: 2 }, finding, { ...finding, valueUsd: 3 }],
      }),
      run('hyperliquid', { kind: 'found', findings: [{ ...finding, valueUsd: 4 }] }),
      run('koi-fees', { kind: 'found', findings: [{ ...finding, valueUsd: 5 }] }),
      run('safe-owner', { kind: 'found', findings: [{ ...finding, valueUsd: 0 }] }),
      run('dsproxy', { kind: 'found', findings: [finding] }),
      {
        ...run('merkl', { kind: 'found', findings: [{ ...finding, valueUsd: 20 }] }),
        address: '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891',
      },
      run('cream', { kind: 'lost', reason: 'Paused.' }),
    ];
    const before = structuredClone(runs);
    const { priced, unpriced } = groupedFindings(runs);
    expect(priced.map(({ checkId, valueUsd }) => [checkId, valueUsd])).toEqual([
      ['merkl', 20],
      ['merkl', 5],
      ['koi-fees', 5],
      ['hyperliquid', 4],
      ['safe-owner', 0],
    ]);
    expect(priced[1]).toMatchObject({ address: ADDRESS, unpriced: 1 });
    expect(priced[1]!.findings).toHaveLength(3);
    expect(unpriced).toEqual([
      {
        checkId: 'dsproxy',
        address: ADDRESS,
        findings: [finding],
        valueUsd: null,
        unpriced: 1,
        pricesUnavailable: 0,
      },
    ]);
    expect(runs).toEqual(before);
  });
  it('keeps a large unpriced report collapsed while preserving warning counts', () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs: [
          run('merkl', {
            kind: 'found',
            findings: [finding, ...Array.from({ length: 109 }, () => finding)],
            partial: 'Missing market.',
          }),
          run('cream', { kind: 'lost', reason: 'Withdrawals paused.' }),
        ],
      }),
    );
    expect(html).toContain('Show 1 unpriced finding');
    expect(html).not.toContain('class="panel finding');
    expect(html).toContain('Lost or fake: 1');
    expect(html).toContain('Failed or partial: 1');
    expect(html).toContain('No priced balances could be confirmed.');
    expect(html).toContain('Show 1 failed or partial check');
    expect(html).toContain('Withdrawals paused.');
    expect(html).toContain('excluded from the total');
    const summary = html.split('class="wallet-report')[0]!;
    expect(summary.match(/110 unpriced/g)).toHaveLength(1);
    expect(summary).toContain('110 unpriced (excluded from the total)');
    expect(summary).not.toContain('findings have no USD price');
  });
  it('shows all priced groups and keeps the single report warning before official links', () => {
    const runs = [
      run('merkl', {
        kind: 'found',
        findings: [
          { ...finding, valueUsd: 48 },
          { ...finding, valueUsd: 12 },
        ],
        partial: 'Read failed.',
      }),
      run('hyperliquid', { kind: 'found', findings: [{ ...finding, valueUsd: 47 }] }),
      run('koi-fees', { kind: 'found', findings: [{ ...finding, valueUsd: 46 }] }),
      run('dsproxy', { kind: 'found', findings: [{ ...finding, valueUsd: 45 }] }),
      run('cream', { kind: 'lost', reason: 'Paused.' }),
      run('compound-v2', { kind: 'fake', reason: 'Debt.' }),
    ];
    const single = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs,
      }),
    );
    expect(single.match(/class="panel finding"/g)).toHaveLength(4);
    expect(single.match(/Avoid address poisoning:/g)).toHaveLength(1);
    expect(single.indexOf('Avoid address poisoning:')).toBeLessThan(single.indexOf('Official app'));
    expect(single).toContain('≈ $60.00');
    expect(single).toContain('≈ $47.00');
    expect(single).toContain('≈ $46.00');
    expect(single).toContain('≈ $45.00');
    expect(single).not.toContain('Show all');
    expect(single).toContain('<h3 class="sr-only">Priced findings (4)</h3>');
    expect(single).toContain('<h4>Merkl rewards</h4>');
    expect(single).toContain('Done · 4 things found on 1 network');
    expect(single.indexOf('Network progress')).toBeLessThan(single.indexOf('class="wallet-report'));
    const other = '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891';
    const multiple = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [ADDRESS, other].map((address) => ({ input: address, address })),
        runs: [...runs, ...runs.map((item) => ({ ...item, address: other }))],
      }),
    );
    expect(multiple.match(/class="panel finding"/g)).toHaveLength(4);
    expect(multiple.match(/Avoid address poisoning:/g)).toHaveLength(1);
    expect(multiple.match(/Lost or fake: 2/g)).toHaveLength(2);
    expect(multiple.match(/Failed or partial: 1/g)).toHaveLength(2);
    expect(multiple).toContain('Lost or fake: 4');
    expect(multiple).toContain('Failed or partial: 2');
    expect(multiple).toContain('≈ $396.00');
    expect(multiple).toContain(
      'Done · ≈ $396.00 · 4 things found · 2 wallets scanned · 2 with findings',
    );
    expect(multiple).toContain('4 positions in 2 wallets');
    expect(multiple).toContain('<details class="by-wallet"><summary>By wallet</summary>');
  });
  it('does not claim a failed scan is an empty success', () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs: [run('merkl', { kind: 'error', reason: 'Offline' })],
      }),
    );
    expect(html).toContain('Your scan needs another look');
    expect(html).not.toContain('Nothing found this time');
    expect(html).toContain('Failed or partial: 1');
    expect(
      html.match(/There may be more funds in the checks we could not complete\./g),
    ).toHaveLength(1);
    expect(html).toContain('No checks returned an empty result.');
    expect(html).not.toContain('Show 1 empty check');
  });
  it('labels retained results as interrupted when the scan stops unexpectedly', () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs: [run('merkl', { kind: 'found', findings: [{ ...finding, valueUsd: 1 }] })],
        complete: false,
      }),
    );
    expect(html).toContain('Interrupted ·');
    expect(html).toContain('Your scan stopped early');
    expect(html).toContain('0.000000000000000001 TEST');
    expect(html).not.toContain('Done ·');
  });
  it('requires a description for each catalog check', () => {
    expect(checks.every((check) => Boolean(descriptions[check.id]))).toBe(true);
  });
  it('renders a complete empty scan with its coverage', () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets: [{ input: ADDRESS, address: ADDRESS }],
        runs: checksForAddress(checks, ADDRESS).map((check) => run(check.id, { kind: 'nothing' })),
      }),
    );
    expect(html).toContain('Nothing found this time');
    expect(html).not.toContain('Failed or partial (');
    expect(html).toContain(`Show ${checksForAddress(checks, ADDRESS).length} empty checks`);
    expect(html).toContain('aria-expanded="false"');
  });
  it('shows active Solana stake information without hiding it in empty-check details', () => {
    // Public mainnet withdrawer recorded by the stake check, with synthetic report data.
    const address = 'VTR3xEg5wYw6GupqzHDh2hYc3nh7jUoooptzLQn3t3d';
    const note = 'Stake is active. Deactivate it first, then wait for cooldown.';
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['solana'],
        wallets: [{ input: address, address }],
        runs: [{ ...run('solana-stake', { kind: 'nothing', note }), address }],
      }),
    );
    expect(html).toContain(note);
    expect(html).toContain('Official guidance');
    expect(html).not.toContain('Show 1 empty check');
    expect(checksForAddress(checks, address).map((check) => check.id)).toEqual([
      'solana-stake',
      'solana-rent',
      'meteora-dlmm',
      'kamino-liquidity',
      'marginfi',
      'jupiter-lock',
    ]);
  });
});
