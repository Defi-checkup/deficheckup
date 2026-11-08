// Solana's official program IDs, checked on mainnet and against solana-program/stake and
// solana-program/token on 2026-11-01. Clock and stake history are read as bytes to preserve u64s.
export const SOLANA_STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
export const SOLANA_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const SOLANA_TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const SOLANA_CLOCK = 'SysvarC1ock11111111111111111111111111111111';
export const SOLANA_STAKE_HISTORY = 'SysvarStakeHistory1111111111111111111111111';
export const SOLANA_SYSVAR_OWNER = 'Sysvar1111111111111111111111111111111111111';
export const SOLANA_ACCOUNT_CAP = 500;

// StakeStateV2's bincode layout: u32 variant + u64 rent reserve + Authorized { staker,
// withdrawer }. Both public keys are 32 bytes: staker at 12, withdrawer at 44. Only the
// withdrawer filter grants withdrawal authority. See solana-program/stake/interface/src/state.rs.
export function solanaStakeParams(address: string) {
  return [
    SOLANA_STAKE_PROGRAM,
    {
      encoding: 'base64',
      commitment: 'finalized',
      withContext: true,
      filters: [{ dataSize: 200 }, { memcmp: { offset: 44, bytes: address } }],
    },
  ] as const;
}

export function solanaTokenParams(address: string, program: string) {
  return [
    address,
    { programId: program },
    { encoding: 'jsonParsed', commitment: 'finalized' },
  ] as const;
}

export function solanaSysvarParams(address: string) {
  return [address, { encoding: 'base64', commitment: 'finalized' }] as const;
}

/** Decodes only canonical, bounded base64. atob is available in browsers and Workers. */
export function solanaAccountData(value: unknown): Uint8Array {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value[1] !== 'base64' ||
    typeof value[0] !== 'string' ||
    value[0].length > 22_000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value[0])
  ) {
    throw new Error('Unexpected Solana account data.');
  }
  return Uint8Array.from(atob(value[0]), (char) => char.charCodeAt(0));
}

export function solanaRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Unexpected Solana data.');
  return value as Record<string, unknown>;
}

export function solanaLamports(value: unknown): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Unsafe Solana lamport balance.');
  return BigInt(value);
}
