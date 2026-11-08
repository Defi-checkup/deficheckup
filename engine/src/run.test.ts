import { afterEach, describe, expect, it, vi } from 'vitest';
import { runChecks, type Progress } from './run';
import type { Check, CheckContext, CheckOutcome } from './types';

// Public placeholder addresses, never a real user's wallet.
const EVM = '0x000000000000000000000000000000000000dEaD';
const SOLANA = '11111111111111111111111111111111';

const ctx: CheckContext = {
  readContract: async () => 0n,
  nativeBalance: async () => 0n,
  solanaRpc: async () => {
    throw new Error('Unexpected Solana RPC');
  },
  proxy: async () => {
    throw new Error('unexpected proxy');
  },
  readSelector: async () => {
    throw new Error('unexpected readSelector');
  },
  priceUsd: async () => null,
  gasCostUsd: async () => null,
  fetchJson: async () => undefined,
};

function fakeCheck(id: string, run: Check['check'], networks: Check['networks'] = ['ethereum']) {
  const check: Check = {
    id,
    name: id,
    networks,
    category: 'forgotten-position',
    status: { kind: 'open' },
    officialLink: 'https://example.com',
    deadline: null,
    contracts: [],
    verifiedOn: '2026-11-01',
    check: run,
  };
  return check;
}

const nothing = async (): Promise<CheckOutcome> => ({ kind: 'nothing' });

afterEach(() => {
  vi.useRealTimers();
});

describe('runChecks', () => {
  it('preserves optional network failure detail in results and progress', async () => {
    const outcome: CheckOutcome = {
      kind: 'error',
      reason: 'Unavailable',
      failedNetworks: ['base'],
    };
    const events: Progress[] = [];
    const { runs } = await runChecks(
      [fakeCheck('multi', async () => outcome, ['ethereum', 'base'])],
      [EVM],
      ctx,
      { onProgress: (event) => events.push(event) },
    );
    expect(runs[0]!.outcome).toEqual(outcome);
    expect(events.at(-1)).toMatchObject({ state: 'finished', outcome });
  });

  it('runs each check only for the kind of address it covers', async () => {
    const evmCheck = vi.fn(nothing);
    const solanaCheck = vi.fn(nothing);

    const { runs } = await runChecks(
      [fakeCheck('evm', evmCheck), fakeCheck('sol', solanaCheck, ['solana'])],
      [EVM, SOLANA],
      ctx,
    );

    expect(runs.map((run) => [run.checkId, run.address])).toEqual([
      ['evm', EVM],
      ['sol', SOLANA],
    ]);
    expect(evmCheck).toHaveBeenCalledWith(EVM, ctx);
    expect(solanaCheck).toHaveBeenCalledWith(SOLANA, ctx);
  });

  it('reports invalid inputs instead of running checks on them', async () => {
    const run = vi.fn(nothing);
    const result = await runChecks([fakeCheck('a', run)], ['hello', '0x1234', EVM], ctx);

    expect(result.invalidAddresses).toEqual(['hello', '0x1234']);
    expect(run).toHaveBeenCalledOnce();
  });

  it('keeps going when one check throws', async () => {
    const { runs } = await runChecks(
      [
        fakeCheck('broken', async () => {
          throw new Error('RPC exploded');
        }),
        fakeCheck('fine', nothing),
      ],
      [EVM],
      ctx,
    );

    expect(runs.map((run) => run.outcome)).toEqual([
      { kind: 'error', reason: 'RPC exploded' },
      { kind: 'nothing' },
    ]);
  });

  it('turns a check that never answers into a timeout error', async () => {
    vi.useFakeTimers();
    const pending = runChecks(
      [fakeCheck('stuck', () => new Promise(() => {})), fakeCheck('fine', nothing)],
      [EVM],
      ctx,
      { timeoutMs: 5_000 },
    );
    await vi.advanceTimersByTimeAsync(5_000);
    const { runs } = await pending;

    expect(runs[0]?.outcome).toEqual({ kind: 'error', reason: 'Timed out after 5 s.' });
    expect(runs[1]?.outcome).toEqual({ kind: 'nothing' });
  });

  it('still returns the results when the progress listener throws', async () => {
    const { runs } = await runChecks([fakeCheck('a', nothing)], [EVM], ctx, {
      onProgress: () => {
        throw new Error('UI bug');
      },
    });

    expect(runs[0]?.outcome).toEqual({ kind: 'nothing' });
  });

  it('reports progress as each check starts and finishes', async () => {
    const events: Progress[] = [];
    await runChecks([fakeCheck('a', nothing)], [EVM], ctx, {
      onProgress: (event) => events.push(event),
    });

    expect(events).toEqual([
      { state: 'started', checkId: 'a', address: EVM },
      { state: 'finished', checkId: 'a', address: EVM, outcome: { kind: 'nothing' } },
    ]);
  });
});
