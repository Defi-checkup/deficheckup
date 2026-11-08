import { createCheckContext, runChecks, type CheckContext } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { exampleCheck } from './check';

// Recorded data. These are public placeholder addresses, never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';

function fakeContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
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
    priceUsd: async () => 2,
    gasCostUsd: async () => 1.5,
    fetchJson: async () => undefined,
    ...overrides,
  };
}

describe('example check', () => {
  it('reads claimable() for the full wallet address', async () => {
    const readContract = vi.fn(async () => 0n);
    await exampleCheck.check(WALLET, fakeContext({ readContract }));

    expect(readContract).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'claimable', args: [WALLET] }),
    );
  });

  it('finds funds, with value, claim cost and deadline', async () => {
    const outcome = await exampleCheck.check(
      WALLET,
      fakeContext({ readContract: async () => 3_000_000_000_000_000_000n }),
    );

    expect(outcome).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'Unclaimed EXMPL airdrop',
          network: 'ethereum',
          amount: { raw: 3_000_000_000_000_000_000n, decimals: 18, symbol: 'EXMPL' },
          valueUsd: 6,
          claimCostUsd: 1.5,
          deadline: '2099-12-31',
        },
      ],
    });
  });

  it('still reports the funds when no price is known', async () => {
    const outcome = await exampleCheck.check(
      WALLET,
      fakeContext({ readContract: async () => 1n, priceUsd: async () => null }),
    );

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ valueUsd: null }] });
    if (outcome.kind === 'found') expect(outcome.findings[0]).not.toHaveProperty('priceStatus');
  });

  it('retains token amounts and the price-service failure on a finding', async () => {
    const outcome = await exampleCheck.check(
      WALLET,
      fakeContext({
        readContract: async () => 3_000_000_000_000_000_000n,
        lookupPrice: async () => ({ status: 'unavailable', usd: null }),
      }),
    );
    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [
        {
          amount: { raw: 3_000_000_000_000_000_000n },
          valueUsd: null,
          priceStatus: 'unavailable',
        },
      ],
    });
  });

  it('keeps the finding when the claim cost cannot be estimated', async () => {
    const outcome = await exampleCheck.check(
      WALLET,
      fakeContext({ readContract: async () => 1n, gasCostUsd: async () => null }),
    );

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ claimCostUsd: null }] });
  });

  it('retains the finding after a slow read and two price timeouts inside the ten-second check budget', async () => {
    vi.useFakeTimers();
    try {
      const ctx = createCheckContext({
        readers: {
          ethereum: {
            readContract: () =>
              new Promise((resolve) => setTimeout(() => resolve(10n ** 18n), 7500)),
            getGasPrice: async () => 0n,
          },
        },
        fetchFn: () => new Promise(() => {}),
      });
      const pending = runChecks([exampleCheck], [WALLET], ctx);
      await vi.advanceTimersByTimeAsync(9500);
      const result = await pending;
      expect(result.runs[0]?.outcome).toMatchObject({
        kind: 'found',
        findings: [
          {
            amount: { raw: 10n ** 18n },
            valueUsd: null,
            priceStatus: 'unavailable',
          },
        ],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports nothing when the balance is zero', async () => {
    expect(await exampleCheck.check(WALLET, fakeContext())).toEqual({ kind: 'nothing' });
  });

  it('reports an error for an invalid address, without reading the chain', async () => {
    const readContract = vi.fn(async () => 0n);
    const outcome = await exampleCheck.check('0x1234', fakeContext({ readContract }));

    expect(outcome.kind).toBe('error');
    expect(readContract).not.toHaveBeenCalled();
  });

  it('reports an error when the contract answers something unexpected', async () => {
    const outcome = await exampleCheck.check(
      WALLET,
      fakeContext({ readContract: async () => 'not a number' }),
    );

    expect(outcome.kind).toBe('error');
  });
});
