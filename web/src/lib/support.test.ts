import { describe, expect, it } from 'vitest';
import { SUPPORT } from './support';

describe('public project support destinations', () => {
  it('pins the exact ENS name and complete addresses supplied in the support brief', () => {
    expect(SUPPORT).toEqual({
      ens: 'deficheckup.eth',
      evm: '0xFC967a9a8A9f98E82d5c02D1e47afE2d5991dAdd',
      solana: '3rV5VRkwNEWXiE6j2RvT4kc5DzMwxEn7nSfErpXEjFh5',
    });
    expect(Object.isFrozen(SUPPORT)).toBe(true);
  });
});
