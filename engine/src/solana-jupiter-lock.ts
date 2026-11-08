import { solanaAddressBytes, solanaAddressString } from './address';
import { solanaAccountData } from './solana';

// Jupiter docs: https://developers.jup.ag/docs/lock. Executable on mainnet on 2026-11-02,
// slot 464450353. Layout: on-chain Anchor IDL, slot 464450180, version 0.4.0, and
// jup-ag/jup-lock-starter at e3b207471a4846bdca351d6709a135d06a14fde2,
// src/lib/accounts/vestingEscrow.ts. Both specify 296 bytes and recipient at byte 8.
export const SOLANA_JUPITER_LOCK_PROGRAM = 'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn';
export const JUPITER_LOCK_READ_CAP = 5;
const DISCRIMINATOR = [244, 119, 183, 4, 73, 116, 135, 195];

export function solanaJupiterLockParams(address: string) {
  return [
    SOLANA_JUPITER_LOCK_PROGRAM,
    {
      encoding: 'base64',
      commitment: 'finalized',
      withContext: true,
      filters: [
        { dataSize: 296 },
        { memcmp: { offset: 8, bytes: address } },
        { memcmp: { offset: 0, bytes: 'hteFiUjrzUz' } },
      ],
    },
  ] as const;
}

export function solanaJupiterLockAccount(account: Record<string, unknown>, address: string) {
  const bytes = solanaAccountData(account.data);
  const recipient = solanaAddressBytes(address);
  if (
    account.owner !== SOLANA_JUPITER_LOCK_PROGRAM ||
    account.executable !== false ||
    bytes.length !== 296 ||
    !DISCRIMINATOR.every((byte, i) => bytes[i] === byte) ||
    !recipient.every((byte, i) => bytes[8 + i] === byte)
  )
    throw new Error('Unexpected Jupiter Lock escrow.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // update/cancel modes are bit flags 0..3; token program flag is SPL Token (0) or 2022 (1).
  if (bytes[137]! > 3 || bytes[138]! > 3 || bytes[139]! > 1)
    throw new Error('Unsupported Jupiter Lock mode.');
  const total =
    view.getBigUint64(160, true) + view.getBigUint64(168, true) * view.getBigUint64(176, true);
  const claimed = view.getBigUint64(184, true);
  if (total > (1n << 64n) - 1n || claimed > total)
    throw new Error('Unexpected Jupiter Lock amounts.');
  return {
    mint: solanaAddressString(bytes.subarray(40, 72)),
    token2022: bytes[139] === 1,
    cancelled: view.getBigUint64(200, true) !== 0n,
    unclaimed: total - claimed,
  };
}
