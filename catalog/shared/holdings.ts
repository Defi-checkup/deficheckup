import {
  lookupPrice,
  valueAtPrice,
  type CheckContext,
  type EvmAddress,
  type Finding,
  type Network,
  type TokenAmount,
} from '@deficheckup/engine';
import type { KnownToken } from './tokens';

const balanceOfAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Balances worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

export interface HoldingsRequest {
  network: Network;
  /** The smart wallet to read, in full. */
  holder: EvmAddress;
  tokens: readonly KnownToken[];
  /** Symbol and decimals of the network's native coin. */
  native: { symbol: string; decimals: number };
  /** Gas units to move each kind of balance out of the smart wallet. */
  gas: { native: bigint; token: bigint };
  /** Builds the one-line title of a finding, e.g. "0.5 ETH in Instadapp DSA #7". */
  title: (symbol: string) => string;
}

export interface Holdings {
  findings: Finding[];
  /** How many balances could not be read. Zero findings plus failures is not "nothing". */
  failed: number;
}

/**
 * Reads the native coin and every listed token held by a smart wallet, all at once (one Multicall3
 * request), then prices and claim costs together. One finding per token with a balance.
 */
export async function readHoldings(ctx: CheckContext, request: HoldingsRequest): Promise<Holdings> {
  const { network, holder, tokens, native, gas, title } = request;

  const reads = await Promise.allSettled([
    ctx.nativeBalance(network, holder),
    ...tokens.map((token) =>
      ctx.readContract({
        network,
        to: token.address,
        abi: balanceOfAbi,
        functionName: 'balanceOf',
        args: [holder],
      }),
    ),
  ]);

  const held: { amount: TokenAmount; priceToken: string; gasUnits: bigint }[] = [];
  let failed = 0;
  reads.forEach((read, i) => {
    if (read.status === 'rejected' || typeof read.value !== 'bigint') {
      failed++;
      return;
    }
    if (read.value === 0n) return;

    const token = i === 0 ? null : tokens[i - 1];
    held.push(
      token
        ? {
            amount: { raw: read.value, decimals: token.decimals, symbol: token.symbol },
            priceToken: token.address,
            gasUnits: gas.token,
          }
        : {
            amount: { raw: read.value, decimals: native.decimals, symbol: native.symbol },
            priceToken: 'native',
            gasUnits: gas.native,
          },
    );
  });

  const findings = await Promise.all(
    held.map(async ({ amount, priceToken, gasUnits }) => {
      const [price, claimCostUsd] = await Promise.all([
        lookupPrice(ctx, network, priceToken),
        ctx.gasCostUsd(network, gasUnits),
      ]);
      const finding: Finding = {
        title: title(amount.symbol),
        network,
        amount,
        ...valueAtPrice(amount, price),
        claimCostUsd,
        deadline: null,
        heldBy: holder,
      };
      return finding;
    }),
  );

  return {
    findings: findings.filter((f) => f.valueUsd === null || f.valueUsd >= DUST_USD),
    failed,
  };
}
