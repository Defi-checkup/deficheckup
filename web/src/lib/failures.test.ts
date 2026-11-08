import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checks } from '@deficheckup/catalog';
import type { CheckOutcome, CheckRun, Finding, Network } from '@deficheckup/engine';
import { describe, expect, it } from 'vitest';
import { FailedChecks } from '../components/Report';
import NetworkBoard from '../components/NetworkBoard';
import type { CheckInfo } from './catalog';
import {
  failureMessage,
  failureSubjects,
  groupedFailures,
  networkCoverage,
  totals,
} from './report';

const address = '0x000000000000000000000000000000000000dEaD';
const single = checks.find((check) => check.id === 'dsproxy')!;
const multi = checks.find((check) => check.id === 'safe-owner')!;
const finding: Finding = {
  title: 'Synthetic Safe balance',
  network: 'base',
  amount: { raw: 1n, decimals: 18, symbol: 'ETH' },
  valueUsd: null,
  claimCostUsd: null,
  deadline: null,
};
const error: CheckOutcome = { kind: 'error', reason: 'Exact technical reason.' };
const partial: CheckOutcome = {
  kind: 'found',
  findings: [finding],
  partial: 'Exact partial reason.',
};
const run = (checkId: string, outcome: CheckOutcome): CheckRun => ({
  address,
  checkId,
  outcome,
  durationMs: 0,
});
function status(network: Network, checks: readonly CheckInfo[], runs: CheckRun[]) {
  return networkCoverage(network, checks, runs, [address]).status;
}

describe('network failure attribution', () => {
  it.each([error, partial])('marks a single-network failure incomplete: $kind', (outcome) => {
    expect(status('ethereum', [single], [run(single.id, outcome)])).toBe('incomplete');
  });

  it.each([error, partial])(
    'does not spread an unnamed multi-network failure: $kind',
    (outcome) => {
      const runs = [run(single.id, { kind: 'nothing' }), run(multi.id, outcome)];
      expect(status('ethereum', [single, multi], runs)).toBe('checked');
      expect(status('arbitrum', [single, multi], runs)).toBe('not checked');
      expect(status('base', [single, multi], runs)).toBe(
        outcome.kind === 'found' ? 'checked' : 'not checked',
      );
      expect(totals(runs).incomplete).toBe(1);
    },
  );

  it.each([error, partial])(
    'marks only named multi-network failures incomplete: $kind',
    (outcome) => {
      const runs = [run(multi.id, { ...outcome, failedNetworks: ['ethereum'] })];
      expect(status('ethereum', [multi], runs)).toBe('incomplete');
      expect(status('arbitrum', [multi], runs)).toBe('checked');
      expect(status('base', [multi], runs)).toBe('checked');
    },
  );

  it('keeps a network incomplete when every check on it failed', () => {
    const runs = [run(single.id, error), run(multi.id, { ...error, failedNetworks: ['ethereum'] })];
    expect(status('ethereum', [single, multi], runs)).toBe('incomplete');
    const html = renderToStaticMarkup(
      createElement(NetworkBoard, {
        checks: [single, multi],
        networks: ['ethereum'],
        finished: runs,
        address,
      }),
    );
    expect(html).toContain('incomplete');
    expect(html).not.toContain('>checked<');
  });

  it('never labels unknown total failure or missing results checked', () => {
    expect(status('ethereum', [multi], [run(multi.id, error)])).toBe('not checked');
    expect(status('ethereum', [single], [])).toBe('not checked');
    expect(networkCoverage('ethereum', [single], [], [address], true).status).toBe('checking');
  });

  it('retains findings beside an incomplete status', () => {
    const coverage = networkCoverage(
      'base',
      [multi],
      [
        run(multi.id, {
          ...partial,
          failedNetworks: ['base'],
        }),
      ],
      [address],
    );
    expect(coverage.status).toBe('incomplete');
    expect(coverage.findings).toEqual([finding]);
  });

  it('combines applicable wallet coverage and excludes unselected wallets', () => {
    const other = '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891';
    const runs = [
      run(single.id, { kind: 'nothing' }),
      { ...run(single.id, error), address: other },
    ];
    expect(networkCoverage('ethereum', [single], runs, [address]).status).toBe('checked');
    expect(networkCoverage('ethereum', [single], runs, [address, other]).status).toBe('incomplete');
    expect(networkCoverage('ethereum', [single], runs.slice(0, 1), [address, other]).status).toBe(
      'not checked',
    );
  });
});

describe('network failure notices', () => {
  const solanaChecks = checks.filter((check) => check.networks.includes('solana'));
  const solanaAddress = 'VTR3xEg5wYw6GupqzHDh2hYc3nh7jUoooptzLQn3t3d';
  const solanaRuns = solanaChecks.map((check) => ({
    ...run(check.id, error),
    address: solanaAddress,
  }));

  it('groups all six Solana errors into one notice with closed affected-check details', () => {
    const { groups, individual } = groupedFailures(solanaChecks, solanaRuns);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      network: 'solana',
      entries: solanaRuns.map((run, index) => ({ run, check: solanaChecks[index] })),
    });
    expect(individual).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(FailedChecks, { checks: solanaChecks, runs: solanaRuns }),
    );
    expect(html.match(/Solana could not be checked right now\. Try again later\./g)).toHaveLength(
      1,
    );
    expect(html).toContain('Affected checks (6)');
    expect(html).not.toContain('<article');
    expect(html).not.toContain(' open=');
    for (const check of solanaChecks) expect(html).toContain(check.name);
    expect(html.match(/Exact technical reason\./g)).toHaveLength(6);
    expect(totals(solanaRuns).incomplete).toBe(6);
  });

  it('requires errors from every expected check, not just every returned check', () => {
    expect(groupedFailures(solanaChecks, solanaRuns.slice(1)).groups).toEqual([]);
    for (const outcome of [
      { kind: 'nothing' } as const,
      { ...partial, findings: [{ ...finding, network: 'solana' as const }] } as CheckOutcome,
    ]) {
      const runs = [solanaRuns[0]!, ...solanaRuns.slice(1).map((run) => ({ ...run, outcome }))];
      expect(groupedFailures(solanaChecks, runs).groups).toEqual([]);
    }
  });

  it('leaves unnamed multi-network failures individual rather than claiming a network outage', () => {
    const runs = [run(single.id, error), run(multi.id, error)];
    const result = groupedFailures([single, multi], runs);
    expect(result.groups).toEqual([]);
    expect(result.individual.map(({ run }) => run)).toEqual(runs);
  });

  it('groups named failures while keeping an individual row for networks not fully failed', () => {
    const base = { ...single, id: 'base-check', networks: ['base'] as const };
    const runs = [
      run(single.id, error),
      run(multi.id, { ...error, failedNetworks: ['ethereum', 'base'] }),
      run(base.id, { kind: 'nothing' }),
    ];
    const result = groupedFailures([single, multi, base], runs);
    expect(result.groups.map(({ network }) => network)).toEqual(['ethereum']);
    expect(result.individual.map(({ check }) => check.id)).toEqual([multi.id]);
    const allGrouped = groupedFailures(
      [single, multi, base],
      [runs[0]!, runs[1]!, run(base.id, error)],
    );
    expect(allGrouped.groups.map(({ network }) => network)).toEqual(['ethereum', 'base']);
    expect(allGrouped.individual).toEqual([]);
  });

  it('renders remaining failures as compact rows with plain copy, retry and exact technical details', () => {
    const html = renderToStaticMarkup(
      createElement(FailedChecks, { checks: [single, multi], runs: [run(multi.id, partial)] }),
    );
    expect(html).toContain('class="failure-row"');
    expect(html).not.toContain('class="panel');
    expect(html).toContain('Safes you own');
    expect(html).toContain(
      'We could not finish checking your Safe balances and ownership, so there may be more funds there.',
    );
    expect(html).toContain('Try again later. Any balances found are kept.');
    expect(html).toContain('Technical details');
    expect(html).toContain('Exact partial reason.');
    expect(html).not.toContain(' open=');
  });
});

describe('plain failure messages', () => {
  it('covers every active check with a specific, plain scope and the funds caveat', () => {
    for (const check of checks) {
      expect(failureSubjects[check.id], check.id).toBeTruthy();
      for (const outcome of [error, partial]) {
        const message = failureMessage(check, outcome);
        expect(message).toContain(failureSubjects[check.id]);
        expect(message).toContain('so there may be');
        expect(message).not.toMatch(/clock|history|registry|extension|RPC|could not be read/);
      }
    }
  });

  it.each([
    ['solana-stake', 'SOL you may be able to withdraw from staking'],
    ['solana-rent', 'SOL you may be able to recover from empty token accounts'],
    ['meteora-dlmm', 'your Meteora liquidity positions and refundable SOL'],
    ['kamino-liquidity', 'your Kamino liquidity balances'],
    ['marginfi', 'your marginfi deposits'],
    ['jupiter-lock', 'tokens waiting to be claimed from Jupiter Lock'],
  ])('explains what was not checked for %s', (id, subject) => {
    expect(
      failureMessage(
        checks.find((check) => check.id === id)!,
        error,
      ),
    ).toBe(`We could not check ${subject}, so there may be funds there.`);
  });
});
