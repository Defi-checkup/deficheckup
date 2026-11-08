import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeLockingCheck } from './check';

// Recorded shapes, placeholder wallet. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const SAFE_LOCK = '0x0a7CB434f96f65972D46A5c1A64a9654dC9959b2';
const E18 = 10n ** 18n;
const NOW = Date.UTC(2026, 10, 1, 12, 0);

interface Chain {
  user?: unknown;
  maturesAt?: bigint;
  failUnlock?: boolean;
}

function fakeContext({
  user = { locked: 0n, unlocked: 0n, unlockStart: 0, unlockEnd: 0 },
  maturesAt = BigInt(NOW / 1000 - 3600),
  failUnlock = false,
}: Chain) {
  const readContract = vi.fn(async ({ functionName }: ReadRequest) => {
    if (functionName === 'getUser') return user;
    if (functionName === 'getUnlock') {
      if (failUnlock) throw new Error('reverted');
      return { amount: 1n, maturesAt };
    }
    throw new Error(`unexpected ${functionName}`);
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 10_000);
  const ctx: CheckContext = {
    readContract,
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
    priceUsd: async () => 0.5,
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readContract, gasCostUsd };
}

describe('safe-locking check', () => {
  afterEach(() => vi.useRealTimers());

  it('reports nothing without a lock, asking the contract with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await safeLockingCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: SAFE_LOCK, functionName: 'getUser', args: [WALLET] }),
    );
  });

  it('finds SAFE unlocked and ready, with the withdraw cost', async () => {
    vi.useFakeTimers({ now: NOW });
    const { ctx, readContract, gasCostUsd } = fakeContext({
      user: { locked: 0n, unlocked: 223n * E18, unlockStart: 0, unlockEnd: 1 },
    });

    expect(await safeLockingCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'SAFE unlocked but never withdrawn',
          network: 'ethereum',
          amount: { raw: 223n * E18, decimals: 18, symbol: 'SAFE' },
          valueUsd: 111.5,
          claimCostUsd: 7.1101,
          deadline: null,
          heldBy: SAFE_LOCK,
        },
      ],
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'getUnlock', args: [WALLET, 0] }),
    );
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 71_101n);
  });

  it('adds gas for every unlock the withdrawal walks', async () => {
    vi.useFakeTimers({ now: NOW });
    const { ctx, gasCostUsd } = fakeContext({
      user: { locked: 0n, unlocked: E18, unlockStart: 3, unlockEnd: 8 },
    });

    await safeLockingCheck.check(WALLET, ctx);

    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 111_101n);
  });

  it('says when an unlock is still in its cooldown', async () => {
    vi.useFakeTimers({ now: NOW });
    const { ctx } = fakeContext({
      user: { locked: 0n, unlocked: E18, unlockStart: 2, unlockEnd: 4 },
      maturesAt: BigInt(NOW / 1000 + 7200),
    });

    expect(await safeLockingCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [
        { note: 'Part of it is still in the one-day cooldown, until 2026-11-01 14:00 UTC.' },
      ],
    });
  });

  it('keeps the finding when the cooldown cannot be read', async () => {
    const { ctx } = fakeContext({
      user: { locked: 0n, unlocked: E18, unlockStart: 0, unlockEnd: 1 },
      failUnlock: true,
    });

    expect(await safeLockingCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ note: expect.stringContaining('could not be read') }],
    });
  });

  it('finds SAFE still locked, with the cost of unlocking and withdrawing', async () => {
    const { ctx, gasCostUsd } = fakeContext({
      user: { locked: 190n * E18, unlocked: 0n, unlockStart: 0, unlockEnd: 0 },
    });

    expect(await safeLockingCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'SAFE still locked', valueUsd: 95, claimCostUsd: 12.303 }],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 123_030n);
  });

  it('returns an error on an unexpected answer', async () => {
    const { ctx } = fakeContext({ user: '0x' });

    expect(await safeLockingCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await safeLockingCheck.check('safe.eth', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
