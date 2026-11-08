import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { koiLpCheck } from './check';
import { KOI_LP_POOLS } from './pools';

// Recorded shapes, placeholder wallet. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const USDC_WETH = '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4';
const USDC_E = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';

// The USDC.e/WETH pool on 2026-11-01: reserves and LP supply as read on-chain.
const POOL_STATE = {
  supply: 8_531_521_950_230_355n,
  reserves: [405_927_709_903n, 179_319_150_635_866_551_212n] as const,
};

interface Chain {
  /** pair: LP balance of the wallet */
  lp?: Record<string, bigint>;
  failPair?: string;
  failReservesOf?: string;
  prices?: Record<string, number | null>;
}

function fakeContext({ lp = {}, failPair, failReservesOf, prices = {} }: Chain) {
  const readContract = vi.fn(async ({ functionName, to }: ReadRequest) => {
    if (to === failPair) throw new Error('reverted');
    if (functionName === 'balanceOf') return lp[to] ?? 0n;
    if (to === failReservesOf) throw new Error('reverted');
    if (functionName === 'totalSupply') return POOL_STATE.supply;
    if (functionName === 'getReserves') return [...POOL_STATE.reserves, 1_761_998_400n];
    throw new Error(`unexpected ${functionName}`);
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 10_000_000);
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
    priceUsd: async (_network, token) =>
      token in prices ? prices[token]! : token === USDC_E ? 1 : 2000,
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readContract, gasCostUsd };
}

describe('koi-lp check', () => {
  it('reports nothing without LP, reading every pool on zkSync with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await koiLpCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledTimes(KOI_LP_POOLS.length);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        network: 'zksync',
        to: USDC_WETH,
        functionName: 'balanceOf',
        args: [WALLET],
      }),
    );
  });

  it('finds both tokens of the pool share and counts the withdrawal once', async () => {
    // LP balance of a public holder of the USDC.e/WETH pool on 2026-11-01.
    const { ctx, gasCostUsd } = fakeContext({ lp: { [USDC_WETH]: 42_931_368_019_535n } });

    expect(await koiLpCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'USDC.e in Koi liquidity (USDC.e/WETH pool)',
          network: 'zksync',
          amount: { raw: 2_042_663_900n, decimals: 6, symbol: 'USDC.e' },
          valueUsd: 2042.6639,
          claimCostUsd: 0.0462088,
          deadline: null,
          heldBy: USDC_WETH,
        },
        {
          title: 'WETH in Koi liquidity (USDC.e/WETH pool)',
          network: 'zksync',
          amount: { raw: 902_349_720_695_609_268n, decimals: 18, symbol: 'WETH' },
          valueUsd: expect.closeTo(1804.6994, 3) as number,
          claimCostUsd: 0,
          deadline: null,
          heldBy: USDC_WETH,
          note: 'Comes out in the same withdrawal as the USDC.e.',
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('zksync', 462_088n);
  });

  it('drops priced dust but keeps a token without a price', async () => {
    const other = KOI_LP_POOLS[1]!;
    const { ctx } = fakeContext({
      lp: { [USDC_WETH]: 1n, [other.pair]: 10n ** 15n },
      prices: { [other.tokens[0].address]: 0, [other.tokens[1].address]: null },
    });

    const outcome = await koiLpCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ valueUsd: null }] });
    if (outcome.kind === 'found') expect(outcome.findings).toHaveLength(1);
  });

  it('returns an error, not nothing, when a pool cannot be read', async () => {
    const { ctx } = fakeContext({ failPair: USDC_WETH });

    expect(await koiLpCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('returns an error when the wallet holds LP but the pool reserves cannot be read', async () => {
    const { ctx } = fakeContext({
      lp: { [USDC_WETH]: 42_931_368_019_535n },
      failReservesOf: USDC_WETH,
    });

    expect(await koiLpCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found and says some pools could not be read', async () => {
    const { ctx } = fakeContext({
      lp: { [USDC_WETH]: 42_931_368_019_535n },
      failPair: KOI_LP_POOLS[1]!.pair,
    });

    expect(await koiLpCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Koi pools could not be read.',
    });
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await koiLpCheck.check('0xnope', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
