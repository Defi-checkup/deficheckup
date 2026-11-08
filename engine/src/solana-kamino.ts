import { isSolanaAddress, solanaAddressString } from './address';
import { solanaAccountData, solanaLamports, solanaRecord } from './solana';

// Official kliquidity-sdk at 369ed3ffd62338539a9beb4147d411a21489fd35:
// src/@codegen/kliquidity/programs/yvaults.ts and accounts/whirlpoolStrategy.ts.
// Mainnet getAccountInfo on 2026-11-02: executable = true (recorded with the check).
export const SOLANA_KAMINO_LIQUIDITY_PROGRAM = '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc';
export const KAMINO_STRATEGY_CAP = 6000;

/** Public strategy registry, shared by all owners in a scan. No user address is sent. */
export function solanaKaminoStrategiesParams() {
  return [
    SOLANA_KAMINO_LIQUIDITY_PROGRAM,
    {
      encoding: 'base64',
      commitment: 'finalized',
      withContext: true,
      dataSlice: { offset: 720, length: 40 },
      filters: [{ dataSize: 4064 }, { memcmp: { offset: 0, bytes: 'Yu22ZtRC1Zv' } }],
    },
  ] as const;
}

export function solanaKaminoStrategy(value: unknown) {
  const entry = solanaRecord(value);
  if (typeof entry.pubkey !== 'string' || !isSolanaAddress(entry.pubkey))
    throw new Error('Unexpected Kamino strategy address.');
  const account = solanaRecord(entry.account);
  solanaLamports(account.lamports);
  const bytes = solanaAccountData(account.data);
  if (
    account.owner !== SOLANA_KAMINO_LIQUIDITY_PROGRAM ||
    account.executable !== false ||
    account.space !== 4064 ||
    bytes.length !== 40
  )
    throw new Error('Unexpected Kamino strategy.');
  const decimals = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(
    32,
    true,
  );
  if (decimals > 18n) throw new Error('Unsupported Kamino share precision.');
  const mint = solanaAddressString(bytes.subarray(0, 32));
  if (bytes.subarray(0, 32).every((byte) => byte === 0)) throw new Error('Missing share mint.');
  return { strategy: entry.pubkey, mint, decimals: Number(decimals), account };
}
