import { describe, expect, it, vi } from 'vitest';
import { lookupPrice, valueAtPrice } from './prices';
import type { CheckContext, PriceQuote } from './types';

const TOKEN = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
const amount = { raw: 3_000_000n, decimals: 6, symbol: 'TEST' };

describe('finding valuation', () => {
  it.each([
    [{ status: 'known', usd: 2 }, { valueUsd: 6 }],
    [{ status: 'known', usd: 0 }, { valueUsd: 0 }],
    [{ status: 'unknown', usd: null }, { valueUsd: null }],
    [
      { status: 'unavailable', usd: null },
      { valueUsd: null, priceStatus: 'unavailable' },
    ],
  ] satisfies [PriceQuote, object][])('preserves the cause of %j', (quote, expected) => {
    expect(valueAtPrice(amount, quote)).toEqual(expected);
  });

  it.each([2, 0, null])(
    'supports old contexts returning %s without the optional lookup method',
    async (usd) => {
      const ctx = { priceUsd: vi.fn(async () => usd) } as unknown as CheckContext;
      expect(await lookupPrice(ctx, 'ethereum', TOKEN)).toEqual({
        status: usd === null ? 'unknown' : 'known',
        usd,
      });
      expect(ctx.priceUsd).toHaveBeenCalledWith('ethereum', TOKEN);
    },
  );

  it('marks a rejected legacy price lookup unavailable without throwing away the amount', async () => {
    const ctx = {
      priceUsd: async () => {
        throw new Error('offline');
      },
    } as unknown as CheckContext;
    expect(valueAtPrice(amount, await lookupPrice(ctx, 'ethereum', TOKEN))).toEqual({
      valueUsd: null,
      priceStatus: 'unavailable',
    });
  });
});
