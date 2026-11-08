import type { CheckContext } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { aaveV2RewardsCheck } from './check';

// Recorded shapes, placeholder address. Never a real user's wallet.
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
    priceUsd: async () => 200,
    gasCostUsd: async () => 0.5,
    fetchJson: async () => undefined,
    ...overrides,
  };
}

describe('aave-v2-rewards check', () => {
  it('asks the controller for the rewards of all 32 incentivized tokens and the full address', async () => {
    const readContract = vi.fn(async () => 0n);

    expect(await aaveV2RewardsCheck.check(WALLET, fakeContext({ readContract }))).toEqual({
      kind: 'nothing',
    });
    expect(readContract).toHaveBeenCalledOnce();
    const [request] = readContract.mock.calls[0] as unknown as [{ to: string; args: unknown[] }];
    expect(request.to).toBe('0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5');
    expect(request.args[1]).toBe(WALLET);
    const tokens = request.args[0] as string[];
    expect(tokens).toHaveLength(32);
    expect(new Set(tokens).size).toBe(32);
    expect(tokens.every((t) => /^0x[0-9a-fA-F]{40}$/.test(t))).toBe(true);
  });

  it('finds unclaimed stkAAVE, priced as stkAAVE, with the measured claim gas', async () => {
    const priceUsd = vi.fn(async () => 200);
    const gasCostUsd = vi.fn(async () => 0.5);
    const outcome = await aaveV2RewardsCheck.check(
      WALLET,
      fakeContext({ readContract: async () => 883_150_145_905_427_027n, priceUsd, gasCostUsd }),
    );

    expect(outcome).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'Unclaimed Aave V2 rewards (stkAAVE)',
          network: 'ethereum',
          amount: { raw: 883_150_145_905_427_027n, decimals: 18, symbol: 'stkAAVE' },
          valueUsd: expect.closeTo(176.63, 2),
          claimCostUsd: 0.5,
          deadline: null,
          heldBy: '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
        },
      ],
    });
    expect(priceUsd).toHaveBeenCalledWith('ethereum', '0x4da27a545c0c5B758a6BA100e3a049001de870f5');
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 170_000n);
  });

  it('reports an error for an unexpected response, not nothing', async () => {
    const outcome = await aaveV2RewardsCheck.check(
      WALLET,
      fakeContext({ readContract: async () => undefined }),
    );

    expect(outcome).toMatchObject({ kind: 'error' });
  });

  it('reports an error for an invalid address, without reading the chain', async () => {
    const readContract = vi.fn(async () => 0n);

    expect(await aaveV2RewardsCheck.check('', fakeContext({ readContract }))).toMatchObject({
      kind: 'error',
    });
    expect(readContract).not.toHaveBeenCalled();
  });
});
