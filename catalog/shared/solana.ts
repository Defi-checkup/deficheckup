import {
  isSolanaAddress,
  solanaRecord,
  solanaLamports,
  solanaAccountData,
  SOLANA_ACCOUNT_CAP,
} from '@deficheckup/engine';

export function solanaAccounts(value: unknown) {
  const result = solanaRecord(value);
  const context = solanaRecord(result.context);
  if (
    typeof context.slot !== 'number' ||
    !Number.isSafeInteger(context.slot) ||
    context.slot < 0 ||
    !Array.isArray(result.value) ||
    (result.truncated !== undefined && typeof result.truncated !== 'boolean')
  )
    throw new Error('Unexpected Solana account list.');
  const seen = new Set<string>();
  const accounts = result.value.slice(0, SOLANA_ACCOUNT_CAP).map((entry: unknown) => {
    const e = solanaRecord(entry);
    if (typeof e.pubkey !== 'string' || !isSolanaAddress(e.pubkey) || seen.has(e.pubkey))
      throw new Error('Unexpected Solana account address.');
    seen.add(e.pubkey);
    const account = solanaRecord(e.account);
    const lamports = solanaLamports(account.lamports);
    if (account.executable !== false) throw new Error('Unexpected executable account.');
    return { pubkey: e.pubkey, account, lamports };
  });
  return {
    accounts,
    truncated: result.truncated === true || result.value.length > SOLANA_ACCOUNT_CAP,
  };
}

export function solanaSysvar(value: unknown): DataView {
  const account = solanaRecord(solanaRecord(value).value);
  if (
    account.owner !== 'Sysvar1111111111111111111111111111111111111' ||
    account.executable !== false
  )
    throw new Error('Unexpected sysvar.');
  const bytes = solanaAccountData(account.data);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

// Solana's documented base fee is 5,000 lamports per signature, checked 2026-11-01:
// https://solana.com/docs/core/fees. One account per single-signature transaction is assumed.
// A wallet may batch instructions, add priority fees, or require additional signatures.
export const SOLANA_BASE_FEE = 5_000n;
export const SOLANA_FEE_NOTE =
  'Fee estimate: one signature per account, 0.000005 SOL each. Priority fees and extra signatures cost more; batching can cost less.';
