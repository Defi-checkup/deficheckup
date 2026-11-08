import type { CheckContext, ReadRequest, SelectorReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { KOI_LP_POOLS } from '../koi-lp/pools';
import { koiFarmCheck } from './check';
import { KOI_FARMS } from './farms';

// Recorded shapes, placeholder wallet and round amounts. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const FARM = '0xe5095A9d6fe9573722706062EAafaE422134cd33';
const KOI = '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05';
const USDC_E = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';

// The USDC.e/WETH pool on 2026-11-01: reserves and LP supply as read on-chain.
const POOL_STATE = {
  supply: 8_531_521_950_230_355n,
  reserves: [405_927_709_903n, 179_319_150_635_866_551_212n] as const,
};

/** A stake as 0x64c73e00 returns it: LP, start, total reward, paid, vesting, last claim, 2 indexes. */
function stake(lp: bigint, total: bigint, paid: bigint, start = 1_712_718_417n): bigint[] {
  return [lp, start, total, paid, 2_592_000n, start, 11_441_105_936_434n, 5_639_818_504n];
}

interface Chain {
  /** farm: stakes of the wallet */
  stakes?: Record<string, bigint[][]>;
  failFarm?: string;
  badShape?: string;
  failPool?: boolean;
  /** Balance of the reward payer, or 'fail' when the read fails. Plenty by default. */
  payer?: bigint | 'fail';
}

function fakeContext({ stakes = {}, failFarm, badShape, failPool, payer = 10n ** 30n }: Chain) {
  const readSelector = vi.fn(async ({ to }: SelectorReadRequest) => {
    if (to === failFarm) throw new Error('reverted');
    if (to === badShape) return [[[1n, 2n]]];
    return [stakes[to] ?? []];
  });
  const readContract = vi.fn(async ({ functionName }: ReadRequest) => {
    if (functionName === 'balanceOf') {
      if (payer === 'fail') throw new Error('reverted');
      return payer;
    }
    if (failPool) throw new Error('reverted');
    if (functionName === 'totalSupply') return POOL_STATE.supply;
    if (functionName === 'getReserves') return [...POOL_STATE.reserves, 1_761_998_400n];
    throw new Error(`unexpected ${functionName}`);
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 10_000_000);
  const ctx: CheckContext = {
    readContract,
    readSelector,
    nativeBalance: async () => 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy: async () => {
      throw new Error('unexpected proxy');
    },
    priceUsd: async (_network, token) => (token === USDC_E ? 1 : token === KOI ? 0.01 : 2000),
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readSelector, gasCostUsd };
}

describe('koi-farm check', () => {
  it('points every farm to a known Koi pool', () => {
    const pairs = new Set(KOI_LP_POOLS.map((p) => p.pair));
    for (const farm of KOI_FARMS) expect(pairs.has(farm.pair)).toBe(true);
  });

  it('reports nothing without stakes, reading every farm by selector with the full address', async () => {
    const { ctx, readSelector } = fakeContext({});

    expect(await koiFarmCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readSelector).toHaveBeenCalledTimes(KOI_FARMS.length);
    expect(readSelector).toHaveBeenCalledWith({
      network: 'zksync',
      to: FARM,
      selector: '0x64c73e00',
      inputs: [{ type: 'address' }],
      args: [WALLET],
      outputs: [{ type: 'uint256[8][]' }],
    });
  });

  it('adds up the stakes and finds both pool tokens and the reward left, costed once', async () => {
    const { ctx, gasCostUsd } = fakeContext({
      stakes: {
        [FARM]: [
          stake(400_000_000_000n, 3n * 10n ** 18n, 10n ** 18n),
          stake(17_540_159_118n, 10n ** 18n, 0n),
        ],
      },
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'USDC.e in USDC.e/WETH LP staked in a Koi farm',
          network: 'zksync',
          amount: { raw: 19_866_457n, decimals: 6, symbol: 'USDC.e' },
          valueUsd: 19.866457,
          claimCostUsd: 0.1309994,
          deadline: null,
          heldBy: FARM,
          note: 'Withdrawing returns the LP token, which you then remove from the pool.',
        },
        {
          title: 'WETH in USDC.e/WETH LP staked in a Koi farm',
          network: 'zksync',
          amount: { raw: 8_776_036_342_188_948n, decimals: 18, symbol: 'WETH' },
          valueUsd: expect.closeTo(17.552, 2) as number,
          claimCostUsd: 0,
          deadline: null,
          heldBy: FARM,
          note: 'Comes out in the same withdrawal as the USDC.e.',
        },
        {
          title: 'KOI reward not claimed in a Koi farm (USDC.e/WETH pool)',
          network: 'zksync',
          amount: { raw: 3n * 10n ** 18n, decimals: 18, symbol: 'KOI' },
          valueUsd: 0.03,
          claimCostUsd: 0,
          deadline: null,
          heldBy: FARM,
          note: 'Comes out in the same withdrawal as the USDC.e.',
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('zksync', 1_309_994n);
  });

  it('says when part of the reward is still vesting', async () => {
    const soon = BigInt(Math.floor(Date.now() / 1000));
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(0n, 10n ** 20n, 0n, soon)] },
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ note: expect.stringContaining('forfeits the part not vested') as string }],
    });
  });

  it('counts only the farm withdrawal when there is a reward but no LP', async () => {
    const { ctx, gasCostUsd } = fakeContext({ stakes: { [FARM]: [stake(0n, 10n ** 20n, 0n)] } });

    const outcome = await koiFarmCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ amount: { symbol: 'KOI' } }] });
    if (outcome.kind === 'found') expect(outcome.findings[0]).not.toHaveProperty('note');
    expect(gasCostUsd).toHaveBeenCalledWith('zksync', 847_906n);
  });

  it('turns a reward its payer cannot cover into a notice, keeping the LP', async () => {
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(400_000_000_000n, 3n * 10n ** 18n, 0n)] },
      payer: 10n ** 18n,
    });

    const outcome = await koiFarmCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({
      kind: 'found',
      notices: [expect.stringContaining('cannot be paid today') as string],
    });
    if (outcome.kind === 'found') {
      expect(outcome.findings.map((f) => f.amount?.symbol)).toEqual(['USDC.e', 'WETH']);
    }
  });

  it('never counts a payer shared by two farms twice', async () => {
    // Both farms pay KOI from the same contract (0x63F44e1Ca8960Df9f463f7E42D2ecB81b7BC2225).
    const other = KOI_FARMS.find(
      (f) => f.farm !== FARM && f.rewardSource === KOI_FARMS[0]!.rewardSource,
    )!;
    const { ctx } = fakeContext({
      stakes: {
        [FARM]: [stake(0n, 80n * 10n ** 18n, 0n)],
        [other.farm]: [stake(0n, 80n * 10n ** 18n, 0n)],
      },
      payer: 100n * 10n ** 18n,
    });

    const outcome = await koiFarmCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [{ heldBy: FARM, amount: { raw: 80n * 10n ** 18n } }],
      notices: [expect.stringContaining('after your other rewards from it') as string],
    });
    if (outcome.kind === 'found') expect(outcome.findings).toHaveLength(1);
  });

  it('reports a reward that cannot be paid, and nothing else, as lost', async () => {
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(0n, 3n * 10n ** 18n, 0n)] },
      payer: 0n,
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toMatchObject({ kind: 'lost' });
  });

  it('keeps the reward but says so when the payer cannot be read', async () => {
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(0n, 3n * 10n ** 18n, 0n)] },
      payer: 'fail',
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Could not check that a Koi farm reward can still be paid.',
    });
  });

  it('keeps the reward when the pool cannot be read, and says LP may be missing', async () => {
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(400_000_000_000n, 3n * 10n ** 18n, 0n)] },
      failPool: true,
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { symbol: 'KOI' } }],
      partial: expect.stringContaining('staked LP may be missing') as string,
    });
  });

  it('returns an error, not nothing, when a farm cannot be read or answers an odd shape', async () => {
    expect(await koiFarmCheck.check(WALLET, fakeContext({ failFarm: FARM }).ctx)).toMatchObject({
      kind: 'error',
    });
    expect(await koiFarmCheck.check(WALLET, fakeContext({ badShape: FARM }).ctx)).toMatchObject({
      kind: 'error',
    });
  });

  it('returns an error when the wallet has a stake but the pool cannot be read', async () => {
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(400_000_000_000n, 0n, 0n)] },
      failPool: true,
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found and says some farms could not be read', async () => {
    const { ctx } = fakeContext({
      stakes: { [FARM]: [stake(400_000_000_000n, 0n, 0n)] },
      failFarm: KOI_FARMS[1]!.farm,
    });

    expect(await koiFarmCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Koi farms could not be read.',
    });
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readSelector } = fakeContext({});

    expect(await koiFarmCheck.check('0xnope', ctx)).toMatchObject({ kind: 'error' });
    expect(readSelector).not.toHaveBeenCalled();
  });
});
