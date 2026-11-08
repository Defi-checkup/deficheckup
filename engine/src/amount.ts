import type { TokenAmount } from './types';

/**
 * Converts a token amount to a plain number for display and USD math.
 * The whole part and the fraction are split first so large raw values keep their precision.
 */
export function amountToNumber({ raw, decimals }: TokenAmount): number {
  const unit = 10n ** BigInt(decimals);
  return Number(raw / unit) + Number(raw % unit) / Number(unit);
}
