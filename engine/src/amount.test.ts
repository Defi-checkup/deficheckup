import { describe, expect, it } from 'vitest';
import { amountToNumber } from './amount';

describe('amountToNumber', () => {
  it('converts whole and fractional amounts', () => {
    expect(amountToNumber({ raw: 1_500_000_000_000_000_000n, decimals: 18, symbol: 'X' })).toBe(
      1.5,
    );
    expect(amountToNumber({ raw: 2_500_000n, decimals: 6, symbol: 'USDC' })).toBe(2.5);
  });

  it('handles zero and tokens without decimals', () => {
    expect(amountToNumber({ raw: 0n, decimals: 18, symbol: 'X' })).toBe(0);
    expect(amountToNumber({ raw: 7n, decimals: 0, symbol: 'NFT' })).toBe(7);
  });

  it('keeps the fraction of very small amounts', () => {
    expect(amountToNumber({ raw: 1n, decimals: 18, symbol: 'X' })).toBe(1e-18);
  });
});
