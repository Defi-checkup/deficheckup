import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type Finding,
} from '@deficheckup/engine';
import { REMOVE_LIQUIDITY_GAS, underlying } from '../koi-lp/check';
import { KOI_LP_POOLS, type KoiLpPool } from '../koi-lp/pools';
import { AMPLIFIERS, type Amplifier } from './amplifiers';

// Mute (now Koi) Amplifiers were farms on zkSync Era: you staked a pool's LP token and earned MUTE.
// Their rewards ended in 2023, but the LP never left on its own. Read on-chain on 2026-11-01:
// totalUserStake(user) is the LP each staker can still take out, and withdraw() pays it back in
// full, together with the pool fees earned while staked and a small MUTE reward (seen in real
// withdrawals in October 2026, and simulated with success from a staker of 2023).

// Measured on 2026-11-01: withdraw() used 329,700 to 582,123 gas in eight real withdrawals from
// three Amplifiers in October 2026. We use the highest, plus removing the LP from the pool.
const WITHDRAW_GAS = 582_123n + REMOVE_LIQUIDITY_GAS;

/** Liquidity worth less than this (when a price is known) is noise, not forgotten funds. */
const DUST_USD = 0.01;

const amplifierAbi = [
  {
    type: 'function',
    name: 'totalUserStake',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

function poolOf(amp: Amplifier): KoiLpPool {
  const pool = KOI_LP_POOLS.find((p) => p.pair === amp.pair);
  if (!pool) throw new Error(`Amplifier ${amp.amplifier} points to a pool outside KOI_LP_POOLS.`);
  return pool;
}

export const koiAmplifierCheck: Check = {
  id: 'koi-amplifier',
  name: 'Mute (now Koi) Amplifier, LP still staked',
  networks: ['zksync'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://dapp.koi.finance',
  deadline: null,
  contracts: evmContracts(
    'zksync',
    ...AMPLIFIERS.flatMap((item) => [item.amplifier, item.pair]),
    ...KOI_LP_POOLS.flatMap((pool) => [pool.pair, ...pool.tokens.map((token) => token.address)]),
  ),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    let unreadable = 0;
    const perAmplifier = await Promise.all(
      AMPLIFIERS.map(async (amp) => {
        const pool = poolOf(amp);
        let staked: unknown;
        try {
          staked = await ctx.readContract({
            network: 'zksync',
            to: amp.amplifier,
            abi: amplifierAbi,
            functionName: 'totalUserStake',
            args: [address],
          });
        } catch {
          unreadable += 1;
          return [];
        }
        if (typeof staked !== 'bigint') {
          unreadable += 1;
          return [];
        }
        if (staked === 0n) return [];

        const amounts = await underlying(pool, staked, ctx);
        if (amounts === null) {
          unreadable += 1;
          return [];
        }
        const [price0, price1, claimCostUsd] = await Promise.all([
          lookupPrice(ctx, 'zksync', pool.tokens[0].address),
          lookupPrice(ctx, 'zksync', pool.tokens[1].address),
          ctx.gasCostUsd('zksync', WITHDRAW_GAS),
        ]);
        const prices = [price0, price1];
        const name = `${pool.tokens[0].symbol}/${pool.tokens[1].symbol}`;
        const findings: Finding[] = [];
        pool.tokens.forEach((token, i) => {
          const raw = amounts[i]!;
          if (raw === 0n) return;
          const amount = { raw, decimals: token.decimals, symbol: token.symbol };
          const valuation = valueAtPrice(amount, prices[i]!);
          const { valueUsd } = valuation;
          if (valueUsd !== null && valueUsd < DUST_USD) return;
          findings.push({
            title: `${token.symbol} in ${name} LP staked in a Mute Amplifier`,
            network: 'zksync',
            amount,
            ...valuation,
            claimCostUsd,
            deadline: null,
            heldBy: amp.amplifier,
          });
        });
        // withdraw() returns the LP; removing it from the pool is a second step (see koi-lp).
        return findings.map((finding, i) =>
          i === 0
            ? {
                ...finding,
                note: `Rewards ended on ${amp.endedOn}. Withdrawing returns the LP token, which you then remove from the pool.`,
              }
            : {
                ...finding,
                claimCostUsd: 0,
                note: `Comes out in the same withdrawal as the ${findings[0]!.amount.symbol}.`,
              },
        );
      }),
    );

    const [first, ...rest] = perAmplifier.flat();
    const missing = 'Some Mute Amplifiers could not be read.';
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(unreadable > 0 ? { partial: missing } : {}),
      };
    }
    if (unreadable > 0) return { kind: 'error', reason: missing };
    return { kind: 'nothing' };
  },
};
