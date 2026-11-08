import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checks } from '@deficheckup/catalog';
import type { CheckRun, Finding } from '@deficheckup/engine';
import Report, { FailedChecks, FindingCard } from '../components/Report';
import ScanProgress from '../components/ScanProgress';
import { groupedFindings, groupedProtocolFindings, groupedScanFailures, totals } from './report';

const first = '0x000000000000000000000000000000000000dEaD';
const second = '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891';
const wallets = [first, second].map((address) => ({ input: address, address }));
const finding: Finding = {
  title: 'Synthetic reward',
  network: 'ethereum',
  amount: { raw: 1234567890123456789n, decimals: 18, symbol: 'WETH' },
  valueUsd: 12,
  claimCostUsd: 1,
  deadline: '2026-12-01',
  heldBy: first,
};
function run(address: string, checkId: string, outcome: CheckRun['outcome']): CheckRun {
  return { address, checkId, outcome, durationMs: 0 };
}
function found(address: string, checkId: string, findings: [Finding, ...Finding[]]) {
  return run(address, checkId, { kind: 'found', findings });
}
function report(runs: CheckRun[], selected = wallets) {
  return renderToStaticMarkup(
    createElement(Report, { checks, runs, wallets: selected, networks: ['ethereum'] }),
  );
}

describe('protocol groups across wallets', () => {
  it('combines the same check and token exactly, orders by total and keeps scan order inside Details', () => {
    const runs = [
      found(first, 'merkl', [finding]),
      found(second, 'merkl', [{ ...finding, valueUsd: 30 }]),
      found(first, 'hyperliquid', [{ ...finding, valueUsd: 40 }]),
    ];
    const before = structuredClone(runs);
    const { priced, unpriced } = groupedProtocolFindings(runs);
    expect(priced.map(({ checkId, valueUsd }) => [checkId, valueUsd])).toEqual([
      ['merkl', 42],
      ['hyperliquid', 40],
    ]);
    expect(priced[0]!.amount).toEqual({ ...finding.amount, raw: 2469135780246913578n });
    expect(priced[0]!.wallets.map(({ address }) => address)).toEqual([first, second]);
    expect(priced[0]!.findings).toHaveLength(2);
    expect(unpriced).toEqual([]);
    expect(runs).toEqual(before);
    const html = report(runs);
    expect(html).toContain(
      'Done · ≈ $82.00 · 2 things found · 2 wallets scanned · 2 with findings',
    );
    expect(html).toContain('2 positions in 2 wallets');
    expect(html).toContain('2.46913 WETH');
    expect(html.match(/class="panel finding"/g)).toHaveLength(2);
    const card = html.split('<article class="panel finding">')[1]!;
    const [visible, details] = card.split('<details class="finding-disclosure">');
    expect(visible).toContain('Claim by 2026-12-01');
    expect(visible).not.toContain(first);
    for (const text of [
      first,
      second,
      '1.234567890123456789 WETH',
      'Estimated claim cost',
      'Holding contract',
      'Ethereum',
    ])
      expect(details).toContain(text);
    expect(details!.indexOf(first)).toBeLessThan(details!.indexOf(second));
    expect(card.match(/Official app/g)).toHaveLength(1);
    expect(card.match(/Read our guide/g)).toHaveLength(1);
  });

  it.each([
    { amount: { ...finding.amount, symbol: 'USDC' } },
    { amount: { ...finding.amount, decimals: 6 } },
    { network: 'base' as const },
    { amount: null, valueUsd: null },
  ])('does not add mixed, incompatible or unknown token amounts (case %#)', (change) => {
    const group = groupedProtocolFindings([
      found(first, 'merkl', [finding]),
      run(second, 'merkl', { kind: 'found', findings: [{ ...finding, ...change }] }),
    ]).priced[0]!;
    expect(group.amount).toBeNull();
    const html = renderToStaticMarkup(
      createElement(FindingCard, {
        check: checks.find((check) => check.id === 'merkl')!,
        group,
        finding,
        index: 0,
      }),
    );
    expect(html).toContain(`<p class="value">≈ $${change.valueUsd === null ? '12' : '24'}.00</p>`);
  });

  it('keeps priced zero, mixed unpriced and wholly unpriced protocols distinct without losing positions', () => {
    const runs = [
      found(first, 'merkl', [finding]),
      found(second, 'merkl', [{ ...finding, valueUsd: null }]),
      found(first, 'dsproxy', [{ ...finding, valueUsd: null }]),
      found(second, 'dsproxy', [{ ...finding, valueUsd: null }]),
      found(second, 'hyperliquid', [{ ...finding, valueUsd: 0 }]),
    ];
    const { priced, unpriced } = groupedProtocolFindings(runs);
    expect(priced.map(({ checkId }) => checkId)).toEqual(['merkl', 'hyperliquid']);
    expect(priced[0]).toMatchObject({ valueUsd: 12, unpriced: 1 });
    expect(unpriced[0]).toMatchObject({ checkId: 'dsproxy', valueUsd: null, unpriced: 2 });
    expect(unpriced[0]!.wallets).toHaveLength(2);
    expect(totals(runs)).toMatchObject({ count: 5, knownUsd: 12, unpriced: 3 });
    const html = report(runs);
    expect(html).toContain('1 unpriced (excluded from the total)');
    expect(html).toContain('Show 1 unpriced finding');
    expect(html.match(/class="panel finding"/g)).toHaveLength(2);
    expect(html).toContain('3 things found');
  });

  it('preserves ties and a single wallet keeps its existing USD group total instead of a token sum', () => {
    const runs = [
      found(first, 'merkl', [finding, finding]),
      found(first, 'hyperliquid', [{ ...finding, valueUsd: 24 }]),
    ];
    expect(groupedProtocolFindings(runs).priced.map(({ checkId }) => checkId)).toEqual([
      'merkl',
      'hyperliquid',
    ]);
    expect(groupedFindings(runs).priced[0]).toMatchObject({ address: first, valueUsd: 24 });
    const single = report(runs, [wallets[0]!]);
    expect(single).toContain('Ethereum · 2 positions');
    expect(single).toContain('<p class="value">≈ $24.00</p>');
    expect(single).not.toContain('2.46913 WETH');
    expect(single).not.toContain('By wallet');
    expect(single).not.toContain('protocol-report');
  });

  it('does not add unrelated Kamino receipt tokens that share a generic symbol and decimals', () => {
    const shares = {
      ...finding,
      network: 'solana' as const,
      amount: { raw: 100n, decimals: 6, symbol: 'Kamino shares' },
      valueUsd: null,
    };
    const group = groupedProtocolFindings([
      found(first, 'kamino-liquidity', [shares]),
      found(second, 'kamino-liquidity', [shares]),
    ]).unpriced[0]!;
    expect(group.amount).toBeNull();
    expect(group.findings).toHaveLength(2);
    const html = renderToStaticMarkup(
      createElement(FindingCard, {
        check: checks.find((check) => check.id === 'kamino-liquidity')!,
        group,
        finding: shares,
        index: 0,
      }),
    );
    expect(html).toContain('<p class="value">2 positions</p>');
    expect(html).not.toContain('0.0002 Kamino shares');
  });

  it('keeps the warning once before links, wallet totals folded, and failed wallets out of empty results', () => {
    const html = report([
      found(first, 'merkl', [finding]),
      run(second, 'merkl', { kind: 'error', reason: 'Unavailable.' }),
    ]);
    expect(html.match(/Avoid address poisoning:/g)).toHaveLength(1);
    expect(html.indexOf('Avoid address poisoning:')).toBeLessThan(html.indexOf('Official app'));
    expect(html).toContain('2 wallets scanned · 1 with findings');
    expect(html).toContain('<details class="by-wallet"><summary>By wallet</summary>');
    expect(html).toContain('≈ $12.00 · 1 thing found · 1 position');
    expect(html).toContain('≈ $0.00 · 0 things found · 0 positions');
    expect(html).toContain('No findings confirmed; some checks could not be completed.');
    expect(html).not.toContain('class="empty-results"');
    expect(html).not.toContain('Nothing found this time');
    expect(html).not.toContain(' open=');
    const empty = report([
      run(first, 'merkl', { kind: 'nothing' }),
      run(second, 'merkl', { kind: 'error', reason: 'Unavailable.' }),
    ]);
    const disclosure = empty.split('<details class="empty-results">')[1]!.split('</details>')[0]!;
    expect(disclosure).toContain('Nothing found in 1 completed check');
    expect(disclosure).toContain(first);
    expect(disclosure).not.toContain(second);
  });

  it('combines network findings while the next wallet is still scanning', () => {
    const html = renderToStaticMarkup(
      createElement(ScanProgress, {
        checks: [checks.find((check) => check.id === 'merkl')!],
        networks: ['ethereum'],
        wallets,
        walletIndex: 1,
        finished: [found(first, 'merkl', [finding])],
        titleRef: null,
      }),
    );
    expect(html).toContain('Wallet 2 of 2');
    expect(html).toContain('1 found · checking');
  });

  it('retains lost, fake, informative and found notices with their wallet addresses', () => {
    const html = report([
      {
        ...found(first, 'merkl', [finding]),
        outcome: { kind: 'found', findings: [finding], notices: ['Rewards remain unavailable.'] },
      },
      run(first, 'cream', { kind: 'lost', reason: 'Withdrawals paused.' }),
      run(second, 'compound-v2', { kind: 'fake', reason: 'Debt exceeds collateral.' }),
      run(second, 'safe-locking', { kind: 'nothing', note: 'Tokens are still locked.' }),
    ]);
    for (const text of [
      'Rewards remain unavailable.',
      'lost: Withdrawals paused.',
      'fake: Debt exceeds collateral.',
      'Tokens are still locked.',
      'Lost or fake: 2',
    ])
      expect(html).toContain(text);
    expect(html).toContain('No checks returned an empty result.');
    expect(html.match(/Avoid address poisoning:/g)).toHaveLength(1);
  });

  it('does not count wallets with no returned checks as scanned after an interruption', () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        checks,
        networks: ['ethereum'],
        wallets,
        runs: [found(first, 'merkl', [finding])],
        complete: false,
      }),
    );
    expect(html).toContain(
      'Interrupted · ≈ $12.00 · 1 thing found · 1 of 2 wallets scanned · 1 with findings',
    );
    expect(html).toContain('Your scan stopped early');
    expect(html).not.toContain('Done ·');
  });
});

describe('failures preserve wallet scope', () => {
  const check = checks.find((check) => check.id === 'dsproxy')!;
  const error = { kind: 'error', reason: 'First technical reason.' } as const;
  it('merges network notices established per wallet and keeps successful wallets out of them', () => {
    const runs = [run(first, check.id, error), run(second, check.id, { kind: 'nothing' })];
    const failures = groupedScanFailures([check], runs);
    expect(failures.groups).toHaveLength(1);
    expect(failures.groups[0]!.entries.map(({ run }) => run.address)).toEqual([first]);
    const html = renderToStaticMarkup(
      createElement(FailedChecks, { checks: [check], runs, multiWallet: true }),
    );
    expect(html).toContain('Affected wallets: 1');
    expect(html).toContain(first);
    expect(html).not.toContain(second);
    const both = groupedScanFailures([check], [runs[0]!, run(second, check.id, error)]);
    expect(both.groups).toHaveLength(1);
    expect(both.groups[0]!.entries).toHaveLength(2);
  });
  it('does not let another wallet complete a missing check or turn a partial finding into a network failure', () => {
    const other = checks.find((check) => check.id === 'instadapp-dsa')!;
    const runs = [
      run(first, check.id, error),
      run(second, other.id, error),
      run(second, check.id, { kind: 'found', findings: [finding], partial: 'Partial reason.' }),
    ];
    expect(groupedScanFailures([check, other], runs).groups).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(FailedChecks, { checks: [check, other], runs, multiWallet: true }),
    );
    expect(html.match(/class="failure-row"/g)).toHaveLength(2);
    expect(html).toContain('Affected wallets: 2');
    for (const text of [
      first,
      second,
      error.reason,
      'Partial reason.',
      'could not finish checking',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain(' open=');
  });

  it('keeps a wallet-specific multi-network row when another wallet has a grouped notice there', () => {
    const multi = checks.find((check) => check.id === 'safe-owner')!;
    const base = { ...check, id: 'base-check', networks: ['base'] as const };
    const named = { ...error, failedNetworks: ['ethereum', 'base'] as const };
    const failures = groupedScanFailures(
      [check, multi, base],
      [
        run(first, check.id, error),
        run(first, multi.id, named),
        run(first, base.id, { kind: 'nothing' }),
        run(second, check.id, error),
        run(second, multi.id, named),
        run(second, base.id, error),
      ],
    );
    expect(failures.groups.map(({ network }) => network)).toEqual(['ethereum', 'base']);
    expect(
      failures.groups
        .find(({ network }) => network === 'base')!
        .entries.map(({ run }) => run.address),
    ).toEqual([second, second]);
    expect(
      failures.individual.map((entries) => entries.map(({ run }) => [run.address, run.checkId])),
    ).toEqual([[[first, multi.id]]]);
  });
});
