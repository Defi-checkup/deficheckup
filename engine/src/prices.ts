import { amountToNumber } from './amount';
import type { CheckContext, Finding, Network, PriceQuote, TokenAmount } from './types';

/** Old contexts keep their null-as-unknown behavior; request failures keep their cause. */
export async function lookupPrice(
  ctx: CheckContext,
  network: Network,
  token: string,
): Promise<PriceQuote> {
  try {
    if (ctx.lookupPrice) return await ctx.lookupPrice(network, token);
    const usd = await ctx.priceUsd(network, token);
    return usd === null ? { status: 'unknown', usd } : { status: 'known', usd };
  } catch {
    return { status: 'unavailable', usd: null };
  }
}

/** Attach price failure metadata to the exact token whose valuation depended on it. */
export function valueAtPrice(
  amount: TokenAmount,
  quote: PriceQuote,
): Pick<Finding, 'valueUsd' | 'priceStatus'> {
  return {
    valueUsd: quote.usd === null ? null : amountToNumber(amount) * quote.usd,
    ...(quote.status === 'unavailable' ? { priceStatus: 'unavailable' as const } : {}),
  };
}
