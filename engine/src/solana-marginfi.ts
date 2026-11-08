import { solanaAddressBytes } from './address';
import { solanaAccountData } from './solana';

// Official marginfi-v2 at aeafee702d1b807f717db75f87996a67e1977c04:
// id-crate/src/lib.rs and type-crate/src/types/user_account.rs. Mainnet executable = true,
// read 2026-11-02 at slot 464442901. Account struct is 2304 bytes plus discriminator.
export const SOLANA_MARGINFI_PROGRAM = 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA';
const DISCRIMINATOR = [67, 178, 130, 109, 126, 114, 28, 42];

export function solanaMarginfiParams(address: string) {
  return [
    SOLANA_MARGINFI_PROGRAM,
    {
      encoding: 'base64',
      commitment: 'finalized',
      withContext: true,
      filters: [
        { dataSize: 2312 },
        { memcmp: { offset: 40, bytes: address } },
        { memcmp: { offset: 0, bytes: 'CKkRR4La3xu' } },
      ],
    },
  ] as const;
}

export function solanaMarginfiAccount(account: Record<string, unknown>, address: string) {
  const bytes = solanaAccountData(account.data);
  const authority = solanaAddressBytes(address);
  if (
    account.owner !== SOLANA_MARGINFI_PROGRAM ||
    account.executable !== false ||
    bytes.length !== 2312 ||
    !DISCRIMINATOR.every((byte, i) => bytes[i] === byte) ||
    !authority.every((byte, i) => bytes[40 + i] === byte)
  )
    throw new Error('Unexpected marginfi account.');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** WrappedI80F48 stores a signed little-endian i128. Its raw units are not token amounts. */
export function marginfiShares(view: DataView, offset: number): bigint {
  return (view.getBigInt64(offset + 8, true) << 64n) + view.getBigUint64(offset, true);
}
