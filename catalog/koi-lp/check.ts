import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type Finding,
} from '@deficheckup/engine';
import { KOI_LP_POOLS, type KoiLpPool } from './pools';

// Koi (formerly Mute) moved to Robinhood Chain and its home page no longer mentions zkSync, but the
// pools on zkSync Era still hold liquidity and the app at dapp.koi.finance still loads them. Read
// on-chain on 2026-11-01: wallets hold the LP token of a pool directly, and the router
// 0x8B791913eB07C32779a16750e3868aA8495F5964 (factory() = the Koi factory) pays both tokens back
// with removeLiquidity. Dozens of providers withdrew that way every day in late October 2026.

// Measured on 2026-11-01 from real transactions in the USDC.e/WETH pool: approve of the LP to the
// router used 91,503 to 108,262 gas and removeLiquidity 202,814 to 353,826. We use the highest of
// each.
export const REMOVE_LIQUIDITY_GAS = 108_262n + 353_826n;

/** Liquidity worth less than this (when a price is known) is noise, not forgotten funds. */
const DUST_USD = 0.01;

const pairAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getReserves',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint256' },
      { name: 'reserve1', type: 'uint256' },
      { name: 'blockTimestampLast', type: 'uint256' },
    ],
  },
] as const;

function poolName(pool: KoiLpPool): string {
  return `${pool.tokens[0].symbol}/${pool.tokens[1].symbol}`;
}

function isReserves(value: unknown): value is readonly [bigint, bigint, ...unknown[]] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'bigint' &&
    typeof value[1] === 'bigint'
  );
}

/** The share of each token the LP balance withdraws, or null when the pool cannot be read. */
export async function underlying(
  pool: KoiLpPool,
  lp: bigint,
  ctx: Parameters<Check['check']>[1],
): Promise<[bigint, bigint] | null> {
  const read = (functionName: 'totalSupply' | 'getReserves') =>
    ctx.readContract({ network: 'zksync', to: pool.pair, abi: pairAbi, functionName });
  const [supply, reserves] = await Promise.allSettled([read('totalSupply'), read('getReserves')]);
  if (supply.status !== 'fulfilled' || reserves.status !== 'fulfilled') return null;
  const total = supply.value;
  if (typeof total !== 'bigint' || total === 0n || !isReserves(reserves.value)) return null;
  return [(lp * reserves.value[0]) / total, (lp * reserves.value[1]) / total];
}

export const koiLpCheck: Check = {
  id: 'koi-lp',
  name: 'Koi (formerly Mute) liquidity left in pools',
  networks: ['zksync'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://dapp.koi.finance',
  deadline: null,
  contracts: evmContracts(
    'zksync',
    ...KOI_LP_POOLS.flatMap((pool) => [pool.pair, ...pool.tokens.map((token) => token.address)]),
  ),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    let unreadable = 0;
    const perPool = await Promise.all(
      KOI_LP_POOLS.map(async (pool) => {
        let lp: unknown;
        try {
          lp = await ctx.readContract({
            network: 'zksync',
            to: pool.pair,
            abi: pairAbi,
            functionName: 'balanceOf',
            args: [address],
          });
        } catch {
          unreadable += 1;
          return [];
        }
        if (typeof lp !== 'bigint') {
          unreadable += 1;
          return [];
        }
        if (lp === 0n) return [];

        const amounts = await underlying(pool, lp, ctx);
        if (amounts === null) {
          unreadable += 1;
          return [];
        }
        const [price0, price1, claimCostUsd] = await Promise.all([
          lookupPrice(ctx, 'zksync', pool.tokens[0].address),
          lookupPrice(ctx, 'zksync', pool.tokens[1].address),
          ctx.gasCostUsd('zksync', REMOVE_LIQUIDITY_GAS),
        ]);
        const prices = [price0, price1];
        const findings: Finding[] = [];
        pool.tokens.forEach((token, i) => {
          const raw = amounts[i]!;
          if (raw === 0n) return;
          const amount = { raw, decimals: token.decimals, symbol: token.symbol };
          const valuation = valueAtPrice(amount, prices[i]!);
          const { valueUsd } = valuation;
          if (valueUsd !== null && valueUsd < DUST_USD) return;
          findings.push({
            title: `${token.symbol} in Koi liquidity (${poolName(pool)} pool)`,
            network: 'zksync',
            amount,
            ...valuation,
            claimCostUsd,
            deadline: null,
            heldBy: pool.pair,
          });
        });
        // One removeLiquidity pays both tokens: count the cost once, on the first finding.
        return findings.map((finding, i) =>
          i === 0
            ? finding
            : {
                ...finding,
                claimCostUsd: 0,
                note: `Comes out in the same withdrawal as the ${findings[0]!.amount.symbol}.`,
              },
        );
      }),
    );

    const [first, ...rest] = perPool.flat();
    const missing = 'Some Koi pools could not be read.';
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
