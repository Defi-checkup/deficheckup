import { describe, expect, it, vi } from 'vitest';
import { createEnsResolver, resolveInputs, type EnsResolver } from './inputs';

// Public placeholder addresses, never a real user's wallet.
const A = '0x000000000000000000000000000000000000dEaD';
const B = '0x1111111111111111111111111111111111111111';
const SOLANA = '11111111111111111111111111111111';

const names: Record<string, `0x${string}`> = { 'example.eth': B };
const resolver: EnsResolver = async (name) => names[name] ?? null;

describe('resolveInputs', () => {
  it('passes addresses through and resolves names, keeping the order', async () => {
    const result = await resolveInputs([A, 'example.eth', SOLANA], resolver);

    expect(result).toEqual({
      wallets: [
        { input: A, address: A },
        { input: 'example.eth', address: B },
        { input: SOLANA, address: SOLANA },
      ],
      invalid: [],
    });
  });

  it('drops repeated wallets, ignoring letter case for EVM addresses', async () => {
    const result = await resolveInputs([A, A.toLowerCase(), B, 'example.eth'], resolver);

    expect(result.wallets).toEqual([
      { input: A, address: A },
      { input: B, address: B },
    ]);
  });

  it('trims spaces, skips blank lines and reports what cannot be read', async () => {
    const result = await resolveInputs(['  ', ` ${A} `, 'nobody.eth', 'hello', '0x1234'], resolver);

    expect(result.wallets).toEqual([{ input: A, address: A }]);
    expect(result.invalid).toEqual(['nobody.eth', 'hello', '0x1234']);
  });

  it('only asks the resolver about inputs that look like names', async () => {
    const spy = vi.fn(resolver);
    await resolveInputs([A, 'hello', 'example.eth'], spy);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('example.eth');
  });
});

describe('createEnsResolver', () => {
  it('normalizes the name before asking', async () => {
    const getEnsAddress = vi.fn(async () => B as `0x${string}`);
    const resolve = createEnsResolver({ getEnsAddress });

    expect(await resolve('Example.ETH')).toBe(B);
    expect(getEnsAddress).toHaveBeenCalledWith({ name: 'example.eth' });
  });

  it('returns null when the lookup fails', async () => {
    const resolve = createEnsResolver({
      getEnsAddress: async () => {
        throw new Error('RPC down');
      },
    });

    expect(await resolve('example.eth')).toBeNull();
  });
});
