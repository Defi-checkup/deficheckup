import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { KOI_LP_POOLS } from '../koi-lp/pools';
import { AMPLIFIERS } from './amplifiers';
import { koiAmplifierCheck } from './check';

// Recorded shapes, placeholder wallet. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const AMPLIFIER = '0x06e8D81f824F8b8758A75Fe9616Dd154400Cb7a4';
const USDC_E = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';

// The USDC.e/WETH pool on 2026-11-01: reserves and LP supply as read on-chain.
const POOL_STATE = {
  supply: 8_531_521_950_230_355n,
  reserves: [405_927_709_903n, 179_319_150_635_866_551_212n] as const,
};

interface Chain {
  /** amplifier: LP staked by the wallet */
  staked?: Record<string, bigint>;
  failAmplifier?: string;
  failPool?: boolean;
}

function fakeContext({ staked = {}, failAmplifier, failPool }: Chain) {
  const readContract = vi.fn(async ({ functionName, to }: ReadRequest) => {
    if (functionName === 'totalUserStake') {
      if (to === failAmplifier) throw new Error('reverted');
      return staked[to] ?? 0n;
    }
    if (failPool) throw new Error('reverted');
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
    priceUsd: async (_network, token) => (token === USDC_E ? 1 : 2000),
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readContract, gasCostUsd };
}

describe('koi-amplifier check', () => {
  it('points every Amplifier to a known Koi pool', () => {
    const pairs = new Set(KOI_LP_POOLS.map((p) => p.pair));
    for (const amp of AMPLIFIERS) expect(pairs.has(amp.pair)).toBe(true);
  });

  it('reports nothing without a stake, reading every Amplifier with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await koiAmplifierCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledTimes(AMPLIFIERS.length);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        network: 'zksync',
        to: AMPLIFIER,
        functionName: 'totalUserStake',
        args: [WALLET],
      }),
    );
  });

  it('finds the staked share of both tokens and counts withdrawal and removal once', async () => {
    // Stake of a public staker of 2023 in this Amplifier, still there on 2026-11-01.
    const { ctx, gasCostUsd } = fakeContext({ staked: { [AMPLIFIER]: 417_540_159_118n } });

    expect(await koiAmplifierCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'USDC.e in USDC.e/WETH LP staked in a Mute Amplifier',
          network: 'zksync',
          amount: { raw: 19_866_457n, decimals: 6, symbol: 'USDC.e' },
          valueUsd: 19.866457,
          claimCostUsd: 0.1044211,
          deadline: null,
          heldBy: AMPLIFIER,
          note: 'Rewards ended on 2023-07-19. Withdrawing returns the LP token, which you then remove from the pool.',
        },
        {
          title: 'WETH in USDC.e/WETH LP staked in a Mute Amplifier',
          network: 'zksync',
          amount: { raw: 8_776_036_342_188_948n, decimals: 18, symbol: 'WETH' },
          valueUsd: expect.closeTo(17.552, 2) as number,
          claimCostUsd: 0,
          deadline: null,
          heldBy: AMPLIFIER,
          note: 'Comes out in the same withdrawal as the USDC.e.',
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('zksync', 1_044_211n);
  });

  it('returns an error, not nothing, when an Amplifier cannot be read', async () => {
    const { ctx } = fakeContext({ failAmplifier: AMPLIFIER });

    expect(await koiAmplifierCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('returns an error when the wallet has a stake but the pool cannot be read', async () => {
    const { ctx } = fakeContext({ staked: { [AMPLIFIER]: 417_540_159_118n }, failPool: true });

    expect(await koiAmplifierCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found and says some Amplifiers could not be read', async () => {
    const { ctx } = fakeContext({
      staked: { [AMPLIFIER]: 417_540_159_118n },
      failAmplifier: AMPLIFIERS[0]!.amplifier,
    });

    expect(await koiAmplifierCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Mute Amplifiers could not be read.',
    });
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await koiAmplifierCheck.check('0xnope', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
