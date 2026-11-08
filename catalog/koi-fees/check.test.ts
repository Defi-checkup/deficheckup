import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { koiFeesCheck } from './check';
import { KOI_POOLS } from './pools';

// Recorded shapes, placeholder wallet. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const USDC_WETH = '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4';
const USDC_E = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';

interface Chain {
  /** pair: [claimable0, claimable1] */
  fees?: Record<string, [bigint, bigint]>;
  failPair?: string;
  prices?: Record<string, number | null>;
}

function fakeContext({ fees = {}, failPair, prices = {} }: Chain) {
  const readContract = vi.fn(async ({ functionName, to }: ReadRequest) => {
    if (to === failPair) throw new Error('reverted');
    const [a, b] = fees[to] ?? [0n, 0n];
    if (functionName === 'claimable0') return a;
    if (functionName === 'claimable1') return b;
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

describe('koi-fees check', () => {
  it('reports nothing without fees, reading every pool on zkSync with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await koiFeesCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledTimes(KOI_POOLS.length * 2);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        network: 'zksync',
        to: USDC_WETH,
        functionName: 'claimable0',
        args: [WALLET],
      }),
    );
  });

  it('finds both fee tokens of a pool and counts the claim once', async () => {
    // Round placeholder amounts, not any real provider's fees.
    const { ctx, gasCostUsd } = fakeContext({
      fees: { [USDC_WETH]: [2_500_000n, 1_500_000_000_000_000n] },
    });

    expect(await koiFeesCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'USDC.e in unclaimed Koi fees (USDC.e/WETH pool)',
          network: 'zksync',
          amount: { raw: 2_500_000n, decimals: 6, symbol: 'USDC.e' },
          valueUsd: 2.5,
          claimCostUsd: 0.0303144,
          deadline: null,
          heldBy: USDC_WETH,
        },
        {
          title: 'WETH in unclaimed Koi fees (USDC.e/WETH pool)',
          network: 'zksync',
          amount: { raw: 1_500_000_000_000_000n, decimals: 18, symbol: 'WETH' },
          valueUsd: 3,
          claimCostUsd: 0,
          deadline: null,
          heldBy: USDC_WETH,
          note: 'Claimed in the same transaction as the USDC.e.',
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('zksync', 303_144n);
  });

  it('drops priced dust but keeps a token without a price', async () => {
    const { ctx } = fakeContext({
      fees: { [USDC_WETH]: [1n, 0n], [KOI_POOLS[1]!.pair]: [0n, 10n ** 18n] },
      prices: { [KOI_POOLS[1]!.tokens[1].address]: null },
    });

    const outcome = await koiFeesCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ valueUsd: null }] });
    if (outcome.kind === 'found') expect(outcome.findings).toHaveLength(1);
  });

  it('keeps each pool token and its own price failure separate from a missing price', async () => {
    const { ctx } = fakeContext({ fees: { [USDC_WETH]: [2_500_000n, 1_500_000_000_000_000n] } });
    ctx.lookupPrice = async (_network, token) => ({
      status: token === USDC_E ? 'unavailable' : 'unknown',
      usd: null,
    });
    const outcome = await koiFeesCheck.check(WALLET, ctx);
    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [
        { amount: { symbol: 'USDC.e' }, valueUsd: null, priceStatus: 'unavailable' },
        { amount: { symbol: 'WETH' }, valueUsd: null, claimCostUsd: 0 },
      ],
    });
    if (outcome.kind === 'found') expect(outcome.findings[1]).not.toHaveProperty('priceStatus');
  });

  it('returns an error, not nothing, when a pool cannot be read', async () => {
    const { ctx } = fakeContext({ failPair: USDC_WETH });

    expect(await koiFeesCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found and says some pools could not be read', async () => {
    const { ctx } = fakeContext({
      fees: { [USDC_WETH]: [5_000_000n, 0n] },
      failPair: KOI_POOLS[1]!.pair,
    });

    expect(await koiFeesCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Koi pools could not be read.',
    });
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await koiFeesCheck.check('0xnope', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
