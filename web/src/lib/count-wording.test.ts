import { createElement } from 'react';
import type * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checks } from '@deficheckup/catalog';
import type { CheckRun, Finding } from '@deficheckup/engine';
import Report from '../components/Report';
import Scanner from '../components/Scanner';
import ScanProgress from '../components/ScanProgress';
import { plural } from './plural';
import type * as ReportModule from './report';

// Render both fold states and in-flight scanner text without a browser or network requests.
const state = vi.hoisted(() => ({
  open: false,
  visible: 3,
  values: [] as unknown[],
  updates: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => [
    state.values.length ? state.values.shift() : state.open && initial === false ? true : initial,
    (value: unknown) => {
      state.updates.push(value);
    },
  ],
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect),
}));
vi.mock('./report', async (original) => ({
  ...(await original<typeof ReportModule>()),
  get VISIBLE_FINDINGS() {
    return state.visible;
  },
}));

const address = '0x000000000000000000000000000000000000dEaD';
const wallet = { input: address, address };
const finding: Finding = {
  title: 'Synthetic balance',
  network: 'ethereum',
  amount: { raw: 1n, decimals: 18, symbol: 'TEST' },
  valueUsd: 1,
  claimCostUsd: null,
  deadline: null,
};
const evmChecks = checks.filter((check) => !check.networks.includes('solana'));
function runs(count: number, outcome: CheckRun['outcome']): CheckRun[] {
  return evmChecks.slice(0, count).map((check) => ({
    address,
    checkId: check.id,
    outcome,
    durationMs: 1,
  }));
}
function report(items: CheckRun[], wallets = [wallet]) {
  return renderToStaticMarkup(
    createElement(Report, { checks, networks: ['ethereum'], wallets, runs: items }),
  );
}

beforeEach(() => {
  state.open = false;
  state.visible = 3;
  state.values = [];
  state.updates = [];
  state.effects = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('count wording', () => {
  it.each([0, 1, 2])('uses the right empty-check labels for %i', (count) => {
    const items = runs(count, { kind: 'nothing' });
    const html = report(items);
    if (count === 0) {
      expect(html).not.toContain('empty check');
      expect(html).toContain('No checks returned an empty result.');
    } else {
      const noun = count === 1 ? 'check' : 'checks';
      expect(html).toContain(`Show ${count} empty ${noun}<`);
      expect(html).toContain(
        count === 1
          ? 'This check found no overlooked balance in its supported markets.'
          : 'These checks found no overlooked balance in their supported markets.',
      );
      state.open = true;
      expect(report(items)).toContain(`Hide ${count} empty ${noun}<`);
    }
  });

  it.each([0, 1, 2])(
    'uses singular or plural report counts and accessible names for %i',
    (count) => {
      const noun = count === 1 ? 'finding' : 'findings';
      const items = count ? runs(count, { kind: 'found', findings: [finding] }) : [];
      const html = report(items);
      expect(html).toContain(`Done · ${count} ${count === 1 ? 'thing' : 'things'} found`);
      expect(html).toContain(`${count} ${count === 1 ? 'position' : 'positions'} ·`);
      expect(html).toContain(`aria-label="Priced ${noun}"`);
      expect(html).toContain(`Priced ${noun} (${count})`);
      const unpriced = report(
        count
          ? runs(count, {
              kind: 'found',
              findings: [{ ...finding, valueUsd: null }],
            })
          : [],
      );
      if (count) {
        expect(unpriced).toContain(`aria-label="Unpriced ${noun}"`);
        expect(unpriced).toContain(`Show ${count} unpriced ${noun}<`);
        state.open = true;
        expect(
          report(
            runs(count, {
              kind: 'found',
              findings: [{ ...finding, valueUsd: null }],
            }),
          ),
        ).toContain(`Hide ${count} unpriced ${noun}<`);
      } else {
        expect(unpriced).not.toContain('aria-label="Unpriced');
      }
    },
  );

  it.each([0, 1, 2])('preserves wallet and failed-check count grammar for %i', (count) => {
    const wallets = Array.from({ length: count }, () => wallet);
    const items = runs(count, { kind: 'error', reason: 'Synthetic failure.' });
    const html = report(items, wallets);
    expect(html).toContain(count === 1 ? address : `${count} wallets`);
    expect(html).toContain(`Failed or partial: ${count}`);
    state.open = true;
    if (count) {
      expect(report(items, wallets)).toContain(
        `Hide ${count} failed or partial ${count === 1 ? 'check' : 'checks'}<`,
      );
    }
  });

  it.each([1, 3])(
    'inflects the live scan card limit %i and shows every priced card in the report',
    (limit) => {
      state.visible = limit;
      const items = runs(4, { kind: 'found', findings: [finding] });
      const html = report(items);
      expect(html).not.toContain('Show all');
      state.values = [
        true,
        { Report, ScanProgress },
        '',
        'scanning',
        '',
        false,
        '',
        [wallet],
        [],
        [],
        0,
      ];
      const scan = renderToStaticMarkup(
        createElement(Scanner, { checks: evmChecks, networks: ['ethereum'] }),
      );
      expect(scan).toContain(
        `Showing up to ${limit} ${limit === 1 ? 'finding' : 'findings'} while scanning.`,
      );
    },
  );

  it.each([0, 1, 2])(
    'inflects scanner coverage and visible and announced progress for %i',
    (count) => {
      const scanChecks = evmChecks.slice(0, count);
      const finished = runs(count, { kind: 'found', findings: [finding] });
      state.values = [
        true,
        { Report, ScanProgress },
        '',
        'scanning',
        '',
        false,
        '',
        [wallet],
        finished,
        [],
        0,
      ];
      const html = renderToStaticMarkup(
        createElement(Scanner, { checks: scanChecks, networks: ['ethereum'] }),
      );
      expect(html).toContain(`${count} ${count === 1 ? 'check' : 'checks'} across 1 EVM network`);
      expect(html).toContain(
        `Wallet 1 of 1 · ${count} of ${count} ${count === 1 ? 'check' : 'checks'} complete`,
      );
      for (const effect of state.effects) effect()?.();
      expect(state.updates).toContain(
        `Scanning wallet 1 of 1. ${count} of ${count} ${count === 1 ? 'check' : 'checks'} complete. ${count} ${count === 1 ? 'finding' : 'findings'} so far.`,
      );
    },
  );

  it.each([0, 1, 2])('inflects uppercase catalog labels for %i', (count) => {
    expect(`THE CATALOG · ${count} ${plural(count, 'CHECK', 'CHECKS')}`).toBe(
      `THE CATALOG · ${count} ${count === 1 ? 'CHECK' : 'CHECKS'}`,
    );
  });
});
