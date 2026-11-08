import { describe, expect, it } from 'vitest';
import {
  addressKind,
  isEvmAddress,
  isSolanaAddress,
  solanaAddressBytes,
  solanaAddressString,
  toChecksumAddress,
} from './address';

describe('isEvmAddress', () => {
  it('accepts a full address in any letter case', () => {
    expect(isEvmAddress('0x000000000000000000000000000000000000dEaD')).toBe(true);
    expect(isEvmAddress('0x000000000000000000000000000000000000dead')).toBe(true);
  });

  it('rejects abbreviated, short, long and malformed values', () => {
    expect(isEvmAddress('0x0000…dEaD')).toBe(false);
    expect(isEvmAddress('0x000000000000000000000000000000000000dEa')).toBe(false);
    expect(isEvmAddress('0x000000000000000000000000000000000000dEaD0')).toBe(false);
    expect(isEvmAddress('000000000000000000000000000000000000dEaD00')).toBe(false);
    expect(isEvmAddress('0xZ00000000000000000000000000000000000dEaD')).toBe(false);
    expect(isEvmAddress('')).toBe(false);
  });
});

describe('isSolanaAddress', () => {
  it('round trips full on-chain public keys, including leading zero bytes', () => {
    for (const key of [
      '11111111111111111111111111111111',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    ])
      expect(solanaAddressString(solanaAddressBytes(key))).toBe(key);
    expect(() => solanaAddressString(new Uint8Array(31))).toThrow();
  });
  it('accepts 32-byte public keys', () => {
    expect(isSolanaAddress('11111111111111111111111111111111')).toBe(true); // System Program
    expect(isSolanaAddress('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(true); // Token Program
  });

  it('rejects addresses of other networks that share the alphabet', () => {
    expect(isSolanaAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyT')).toBe(false); // Bitcoin, 25 bytes
    expect(addressKind('1BoatSLRHtKNngkdXEeobR76b53LETtpyT')).toBeNull();
  });

  it('rejects characters outside base58', () => {
    expect(isSolanaAddress('0OIl1111111111111111111111111111')).toBe(false);
  });
});

describe('toChecksumAddress', () => {
  it('writes an address in EIP-55 case, however it was pasted', () => {
    expect(toChecksumAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    );
  });
});
