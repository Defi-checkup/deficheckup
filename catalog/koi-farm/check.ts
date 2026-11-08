import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  amountToNumber,
  isEvmAddress,
  type Check,
  type CheckContext,
  type Finding,
  type PriceQuote,
} from '@deficheckup/engine';
import type { KoiToken } from '../koi-fees/pools';
import { REMOVE_LIQUIDITY_GAS, underlying } from '../koi-lp/check';
import { KOI_LP_POOLS, type KoiLpPool } from '../koi-lp/pools';
import { KOI_FARMS, type KoiFarm } from './farms';

// Koi farms on zkSync Era: you stake a pool's LP token and earn a reward that vests over 30 days.
// Their source is not published, so the stakes are read by selector. Read on-chain on 2026-11-01:
// 0x64c73e00(address) returns the wallet's stakes, 8 numbers each, in this order: LP staked, stake
// time, total reward, reward already paid, vesting time (2,592,000 s), last claim time and two fee
// indexes. Checked against real claims: withdraw() and redeemRewards() paid exactly the LP staked
// and the total reward minus the part already paid, plus the pool fees earned while staked.
const STAKES_SELECTOR = '0x64c73e00';

// Measured on 2026-11-01: withdraw() and redeemRewards() used up to 847,906 gas in 64 real claims
// across the 16 farms (most stayed under 530,000). We use the highest. With LP staked, removing it
// from the pool comes on top.
const FARM_WITHDRAW_GAS = 847_906n;

// Koi's docs (Amplifier page, read on 2026-11-01): rewards vest over the month after a deposit, and
// withdrawing earlier forfeits the part not vested yet.
const DOCS = 'https://docs.koi.finance/mute-switch/amplifier';

const balanceOfAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Amounts worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

interface Stake {
  lp: bigint;
  rewardLeft: bigint;
  /** Seconds since 1970 when the reward is fully vested. */
  vestedAt: bigint;
}

function isStakeList(value: unknown): value is readonly (readonly bigint[])[] {
  return (
    Array.isArray(value) &&
    value.every(
      (stake) =>
        Array.isArray(stake) &&
        stake.length === 8 &&
        stake.every((field) => typeof field === 'bigint'),
    )
  );
}

async function readStakes(farm: KoiFarm, address: string, ctx: CheckContext): Promise<Stake[]> {
  const [list] = await ctx.readSelector({
    network: 'zksync',
    to: farm.farm,
    selector: STAKES_SELECTOR,
    inputs: [{ type: 'address' }],
    args: [address],
    outputs: [{ type: 'uint256[8][]' }],
  });
  if (!isStakeList(list)) throw new Error('Unexpected stake list.');
  return list.map(([lp, start, total, paid, vesting]) => ({
    lp: lp!,
    rewardLeft: total! > paid! ? total! - paid! : 0n,
    vestedAt: start! + vesting!,
  }));
}

function poolOf(farm: KoiFarm): KoiLpPool {
  const pool = KOI_LP_POOLS.find((p) => p.pair === farm.pair);
  if (!pool) throw new Error(`Farm ${farm.farm} points to a pool outside KOI_LP_POOLS.`);
  return pool;
}

function value(raw: bigint, token: KoiToken, price: PriceQuote) {
  const amount = { raw, decimals: token.decimals, symbol: token.symbol };
  return { amount, ...valueAtPrice(amount, price) };
}

interface FarmResult {
  lp: bigint;
  /** The pool tokens the staked LP is worth. */
  findings: Finding[];
  reward?: {
    /** What the payer holds, or undefined when that could not be read. */
    payer: bigint | undefined;
    payerKey: string;
    label: string;
    finding: Finding;
  };
}

/** One withdrawal pays everything: count the cost once, on the first finding. */
function withCostOnce(findings: Finding[], lp: bigint): Finding[] {
  const lpNote = 'Withdrawing returns the LP token, which you then remove from the pool.';
  return findings.map((finding, i) => {
    if (i === 0) return lp > 0n && !finding.note ? { ...finding, note: lpNote } : finding;
    return {
      ...finding,
      claimCostUsd: 0,
      note:
        finding.note ?? `Comes out in the same withdrawal as the ${findings[0]!.amount.symbol}.`,
    };
  });
}

function day(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
}

export const koiFarmCheck: Check = {
  id: 'koi-farm',
  name: 'Koi farm, LP and rewards still staked',
  networks: ['zksync'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://dapp.koi.finance',
  deadline: null,
  contracts: evmContracts(
    'zksync',
    ...KOI_FARMS.flatMap((farm) => [farm.farm, farm.pair, farm.reward.address, farm.rewardSource]),
    ...KOI_LP_POOLS.flatMap((pool) => [pool.pair, ...pool.tokens.map((token) => token.address)]),
  ),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const missing = new Set<string>();
    const notices: string[] = [];
    const perFarm = await Promise.all(
      KOI_FARMS.map(async (farm): Promise<FarmResult | null> => {
        const pool = poolOf(farm);
        let stakes: Stake[];
        try {
          stakes = await readStakes(farm, address, ctx);
        } catch {
          missing.add('Some Koi farms could not be read.');
          return null;
        }
        const lp = stakes.reduce((sum, s) => sum + s.lp, 0n);
        const rewardLeft = stakes.reduce((sum, s) => sum + s.rewardLeft, 0n);
        if (lp === 0n && rewardLeft === 0n) return null;

        const name = `${pool.tokens[0].symbol}/${pool.tokens[1].symbol}`;
        const payerBalance =
          rewardLeft === 0n
            ? Promise.resolve(undefined)
            : ctx
                .readContract({
                  network: 'zksync',
                  to: farm.reward.address,
                  abi: balanceOfAbi,
                  functionName: 'balanceOf',
                  args: [farm.rewardSource],
                })
                .then((balance) => (typeof balance === 'bigint' ? balance : undefined))
                .catch(() => undefined);
        const [amounts, payer, price0, price1, rewardPrice, claimCostUsd] = await Promise.all([
          lp === 0n ? Promise.resolve(null) : underlying(pool, lp, ctx),
          payerBalance,
          lookupPrice(ctx, 'zksync', pool.tokens[0].address),
          lookupPrice(ctx, 'zksync', pool.tokens[1].address),
          lookupPrice(ctx, 'zksync', farm.reward.address),
          ctx.gasCostUsd(
            'zksync',
            lp === 0n ? FARM_WITHDRAW_GAS : FARM_WITHDRAW_GAS + REMOVE_LIQUIDITY_GAS,
          ),
        ]);
        const base = {
          network: 'zksync' as const,
          claimCostUsd,
          deadline: null,
          heldBy: farm.farm,
        };

        const findings: Finding[] = [];
        if (lp > 0n && amounts === null) {
          missing.add('The pool of a Koi farm could not be read, so staked LP may be missing.');
        }
        const prices = [price0, price1];
        pool.tokens.forEach((token, i) => {
          const raw = amounts?.[i] ?? 0n;
          if (raw === 0n) return;
          const share = value(raw, token, prices[i]!);
          if (share.valueUsd !== null && share.valueUsd < DUST_USD) return;
          findings.push({
            ...base,
            ...share,
            title: `${token.symbol} in ${name} LP staked in a Koi farm`,
          });
        });

        const reward = value(rewardLeft, farm.reward, rewardPrice);
        const worthIt =
          rewardLeft > 0n && (reward.valueUsd === null || reward.valueUsd >= DUST_USD);
        if (!worthIt) return { lp, findings };
        const vestedAt = stakes.reduce((max, s) => (s.vestedAt > max ? s.vestedAt : max), 0n);
        const now = BigInt(Math.floor(Date.now() / 1000));
        return {
          lp,
          findings,
          reward: {
            payer,
            payerKey: `${farm.reward.address}:${farm.rewardSource}`,
            label: `${amountToNumber(reward.amount)} ${farm.reward.symbol} of rewards in a Koi farm (${name} pool)`,
            finding: {
              ...base,
              ...reward,
              title: `${farm.reward.symbol} reward not claimed in a Koi farm (${name} pool)`,
              ...(vestedAt > now
                ? {
                    note: `Fully vested on ${day(vestedAt)}. Withdrawing earlier forfeits the part not vested yet (${DOCS}).`,
                  }
                : {}),
            },
          },
        };
      }),
    );

    // Rewards are judged in catalog order, each one taken out of what its payer still holds, so two
    // farms that share a payer never count the same balance twice.
    const payersLeft = new Map<string, bigint>();
    const all: Finding[] = [];
    for (const result of perFarm) {
      if (!result) continue;
      const findings = [...result.findings];
      const { reward } = result;
      if (reward && reward.payer === undefined) {
        missing.add('Could not check that a Koi farm reward can still be paid.');
        findings.push(reward.finding);
      } else if (reward) {
        const left = payersLeft.get(reward.payerKey) ?? reward.payer!;
        if (left < reward.finding.amount.raw) {
          notices.push(
            `${reward.label} cannot be paid today: the contract that pays them holds ${amountToNumber({ ...reward.finding.amount, raw: left })}${payersLeft.has(reward.payerKey) ? ' after your other rewards from it' : ''}.`,
          );
        } else {
          payersLeft.set(reward.payerKey, left - reward.finding.amount.raw);
          findings.push(reward.finding);
        }
      }
      all.push(...withCostOnce(findings, result.lp));
    }

    const [first, ...rest] = all;
    const partial = missing.size > 0 ? [...missing].join(' ') : undefined;
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(partial ? { partial } : {}),
        ...(notices.length > 0 ? { notices } : {}),
      };
    }
    if (partial) return { kind: 'error', reason: partial };
    if (notices.length > 0) return { kind: 'lost', reason: notices.join(' ') };
    return { kind: 'nothing' };
  },
};
