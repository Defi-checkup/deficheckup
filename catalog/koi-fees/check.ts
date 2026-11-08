import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type Finding,
} from '@deficheckup/engine';
import { KOI_POOLS, type KoiPool } from './pools';

// Koi (formerly Mute) pools on zkSync Era work like Solidly pairs: swap fees go to a separate fee
// contract and each provider's share is credited to claimable0(user) and claimable1(user), even
// after they removed all their liquidity. Read on-chain on 2026-11-01: wallets with no LP left still
// had USDC.e and WETH credited in the USDC.e/WETH pool, and a simulated claimFees() from one of them
// returned exactly those amounts. Portfolio trackers show these fees as a pool deposit, which made
// them look like a fake LP position.

// Measured on 2026-11-01: 303,144 gas for claimFees() in the USDC.e/WETH pool, which pays both
// tokens in one transaction.
const CLAIM_GAS = 303_144n;

/** Fees worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

const pairAbi = [
  {
    type: 'function',
    name: 'claimable0',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimable1',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

function poolName(pool: KoiPool): string {
  return `${pool.tokens[0].symbol}/${pool.tokens[1].symbol}`;
}

export const koiFeesCheck: Check = {
  id: 'koi-fees',
  name: 'Koi (formerly Mute) unclaimed pool fees',
  networks: ['zksync'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://dapp.koi.finance',
  deadline: null,
  contracts: evmContracts(
    'zksync',
    ...KOI_POOLS.flatMap((pool) => [pool.pair, ...pool.tokens.map((token) => token.address)]),
  ),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const reads = await Promise.allSettled(
      KOI_POOLS.flatMap((pool) =>
        (['claimable0', 'claimable1'] as const).map((functionName) =>
          ctx.readContract({
            network: 'zksync',
            to: pool.pair,
            abi: pairAbi,
            functionName,
            args: [address],
          }),
        ),
      ),
    );

    let unreadable = 0;
    const credited: { pool: KoiPool; amounts: [bigint, bigint] }[] = [];
    KOI_POOLS.forEach((pool, i) => {
      const amounts = [reads[2 * i]!, reads[2 * i + 1]!].map((read) => {
        if (read.status === 'fulfilled' && typeof read.value === 'bigint') return read.value;
        unreadable += 1;
        return 0n;
      }) as [bigint, bigint];
      if (amounts[0] > 0n || amounts[1] > 0n) credited.push({ pool, amounts });
    });

    const perPool = await Promise.all(
      credited.map(async ({ pool, amounts }) => {
        const [price0, price1, claimCostUsd] = await Promise.all([
          lookupPrice(ctx, 'zksync', pool.tokens[0].address),
          lookupPrice(ctx, 'zksync', pool.tokens[1].address),
          ctx.gasCostUsd('zksync', CLAIM_GAS),
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
            title: `${token.symbol} in unclaimed Koi fees (${poolName(pool)} pool)`,
            network: 'zksync',
            amount,
            ...valuation,
            claimCostUsd,
            deadline: null,
            heldBy: pool.pair,
          });
        });
        // One claimFees() pays both tokens: count the cost once, on the first finding.
        return findings.map((finding, i) =>
          i === 0
            ? finding
            : {
                ...finding,
                claimCostUsd: 0,
                note: `Claimed in the same transaction as the ${findings[0]!.amount.symbol}.`,
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
