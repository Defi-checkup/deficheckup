import { getAddress } from 'viem';
import type { EvmAddress } from './types';

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// Base58 alphabet (no 0, O, I or l), 32 to 44 characters.
const SOLANA_SHAPE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** How many bytes a base58 string decodes to. Each leading "1" stands for a zero byte. */
function base58ByteLength(value: string): number {
  let number = 0n;
  for (const char of value) number = number * 58n + BigInt(BASE58.indexOf(char));

  let bytes = 0;
  for (; number > 0n; number >>= 8n) bytes++;

  const leadingZeros = value.length - value.replace(/^1+/, '').length;
  return leadingZeros + bytes;
}

export function isEvmAddress(value: string): value is EvmAddress {
  return EVM_ADDRESS.test(value);
}

/** A Solana address is a 32-byte public key written in base58. */
export function isSolanaAddress(value: string): boolean {
  return SOLANA_SHAPE.test(value) && base58ByteLength(value) === 32;
}

/** The 32 bytes of a validated Solana public key, for comparing account authority fields. */
export function solanaAddressBytes(value: string): Uint8Array {
  if (!isSolanaAddress(value)) throw new Error('Not a valid Solana address.');
  let number = 0n;
  for (const char of value) number = number * 58n + BigInt(BASE58.indexOf(char));
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--, number >>= 8n) bytes[i] = Number(number & 255n);
  return bytes;
}

/** Encodes an on-chain public key without abbreviating it. */
export function solanaAddressString(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new Error('Expected a 32-byte Solana public key.');
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let result = '';
  for (; number > 0n; number /= 58n) result = BASE58[Number(number % 58n)]! + result;
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + result;
}

export function addressKind(value: string): 'evm' | 'solana' | null {
  if (isEvmAddress(value)) return 'evm';
  if (isSolanaAddress(value)) return 'solana';
  return null;
}

/**
 * The same address in checksum case (EIP-55). Some APIs, like Safe's, reject an address written in
 * lowercase, and people paste addresses either way.
 */
export function toChecksumAddress(address: EvmAddress): EvmAddress {
  return getAddress(address);
}
