import { solanaAddressBytes } from './address';
import { solanaAccountData, solanaLamports, solanaRecord } from './solana';

// Official Meteora IDL at af36dd53ab180783ccecda306926189a4700953c, idls/dlmm.json.
// getAccountInfo on mainnet, 2026-11-02, slot 464438494: executable = true.
export const SOLANA_DLMM_PROGRAM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
export const DLMM_POSITION_SIZE = 8120;
export const DLMM_POOL_CAP = 10;
const POSITION_DISCRIMINATOR = [117, 176, 212, 199, 245, 180, 133, 182];
const POOL_DISCRIMINATOR = [33, 11, 49, 98, 181, 101, 177, 13];

export function solanaDlmmParams(address: string) {
  return [
    SOLANA_DLMM_PROGRAM,
    {
      encoding: 'base64',
      commitment: 'finalized',
      withContext: true,
      // Discover extended positions too, but read only the fixed header and inline bins.
      dataSlice: { offset: 0, length: DLMM_POSITION_SIZE },
      filters: [
        { memcmp: { offset: 0, bytes: 'LgkNAEYaVX3' } },
        { memcmp: { offset: 40, bytes: address } },
      ],
    },
  ] as const;
}

export function solanaDlmmPoolsParams(addresses: readonly string[]) {
  return [
    addresses,
    { encoding: 'base64', commitment: 'finalized', dataSlice: { offset: 0, length: 80 } },
  ] as const;
}

/** Validate the complete fixed prefix even when a position has unsupported extension bins. */
export function solanaDlmmPosition(account: Record<string, unknown>, address: string) {
  const bytes = solanaAccountData(account.data);
  const authority = solanaAddressBytes(address);
  if (
    account.owner !== SOLANA_DLMM_PROGRAM ||
    account.executable !== false ||
    bytes.length !== DLMM_POSITION_SIZE ||
    typeof account.space !== 'number' ||
    !Number.isSafeInteger(account.space) ||
    account.space < DLMM_POSITION_SIZE ||
    !POSITION_DISCRIMINATOR.every((byte, i) => bytes[i] === byte) ||
    !authority.every((byte, i) => bytes[40 + i] === byte)
  )
    throw new Error('Unexpected DLMM position.');
  return {
    bytes,
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    extended: account.space !== DLMM_POSITION_SIZE,
  };
}

export function solanaDlmmPool(value: unknown): DataView {
  const account = solanaRecord(value);
  solanaLamports(account.lamports);
  const bytes = solanaAccountData(account.data);
  if (
    account.owner !== SOLANA_DLMM_PROGRAM ||
    account.executable !== false ||
    account.space !== 904 ||
    bytes.length !== 80 ||
    !POOL_DISCRIMINATOR.every((byte, i) => bytes[i] === byte)
  )
    throw new Error('Unexpected DLMM pool.');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
