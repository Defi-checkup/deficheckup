import {
  isSolanaAddress,
  solanaAddressBytes,
  solanaRecord,
  solanaAccountData,
  solanaLamports,
  SOLANA_STAKE_PROGRAM,
  SOLANA_TOKEN_PROGRAM,
  SOLANA_TOKEN_2022_PROGRAM,
  SOLANA_CLOCK,
  SOLANA_STAKE_HISTORY,
  SOLANA_SYSVAR_OWNER,
  SOLANA_ACCOUNT_CAP,
  solanaStakeParams,
  solanaTokenParams,
  solanaSysvarParams,
  SOLANA_DLMM_PROGRAM,
  DLMM_POOL_CAP,
  solanaDlmmParams,
  solanaDlmmPoolsParams,
  solanaDlmmPosition,
  solanaDlmmPool,
  SOLANA_KAMINO_LIQUIDITY_PROGRAM,
  KAMINO_STRATEGY_CAP,
  solanaKaminoStrategiesParams,
  solanaKaminoStrategy,
  SOLANA_MARGINFI_PROGRAM,
  solanaMarginfiParams,
  solanaMarginfiAccount,
  SOLANA_JUPITER_LOCK_PROGRAM,
  solanaJupiterLockParams,
  solanaJupiterLockAccount,
} from '@deficheckup/engine';

// Compare the complete request shape, including nested keys: no extra filters, encodings,
// programs, account lookups, transactions or user-selected RPC destinations.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export function solanaRequest(body: Record<string, unknown>) {
  if (
    Object.keys(body).length !== 2 ||
    typeof body.method !== 'string' ||
    !Array.isArray(body.params)
  )
    return null;
  const { method, params } = body;
  let expected: readonly unknown[] | undefined;
  let address: string | undefined;
  if (method === 'getProgramAccounts') {
    if (params[0] === SOLANA_KAMINO_LIQUIDITY_PROGRAM) {
      expected = solanaKaminoStrategiesParams();
      return canonical(params) === canonical(expected)
        ? { method, params: expected, address }
        : null;
    }
    const options = solanaRecord(params[1]);
    const filters = options.filters;
    if (!Array.isArray(filters)) return null;
    const filter = solanaRecord(filters[1]);
    const memcmp = solanaRecord(filter.memcmp);
    if (typeof memcmp.bytes !== 'string' || !isSolanaAddress(memcmp.bytes)) return null;
    address = memcmp.bytes;
    expected =
      params[0] === SOLANA_DLMM_PROGRAM
        ? solanaDlmmParams(address)
        : params[0] === SOLANA_MARGINFI_PROGRAM
          ? solanaMarginfiParams(address)
          : params[0] === SOLANA_JUPITER_LOCK_PROGRAM
            ? solanaJupiterLockParams(address)
            : solanaStakeParams(address);
  } else if (method === 'getMultipleAccounts') {
    const keys = params[0];
    if (
      !Array.isArray(keys) ||
      keys.length < 1 ||
      keys.length > DLMM_POOL_CAP ||
      new Set(keys).size !== keys.length ||
      !keys.every((key) => typeof key === 'string' && isSolanaAddress(key))
    )
      return null;
    expected = solanaDlmmPoolsParams(keys as string[]);
  } else if (method === 'getAccountInfo') {
    if (params[0] !== SOLANA_CLOCK && params[0] !== SOLANA_STAKE_HISTORY) return null;
    expected = solanaSysvarParams(params[0]);
  } else if (method === 'getTokenAccountsByOwner') {
    if (typeof params[0] !== 'string' || !isSolanaAddress(params[0])) return null;
    address = params[0];
    const filter = solanaRecord(params[1]);
    if (filter.programId !== SOLANA_TOKEN_PROGRAM && filter.programId !== SOLANA_TOKEN_2022_PROGRAM)
      return null;
    expected = solanaTokenParams(address, filter.programId);
  }
  return expected && canonical(params) === canonical(expected)
    ? { method, params: expected, address }
    : null;
}

function account(value: unknown, owner: string) {
  const a = solanaRecord(value);
  solanaLamports(a.lamports);
  if (a.owner !== owner || a.executable !== false) throw new Error('Unexpected Solana owner.');
  return { data: a.data, lamports: a.lamports, owner, executable: false };
}

export function solanaResult(
  request: NonNullable<ReturnType<typeof solanaRequest>>,
  result: unknown,
) {
  const r = solanaRecord(result);
  const context = solanaRecord(r.context);
  if (typeof context.slot !== 'number' || !Number.isSafeInteger(context.slot) || context.slot < 0)
    throw new Error('Unexpected slot.');
  const cleanContext = { slot: context.slot };
  if (request.method === 'getAccountInfo') {
    const a = account(r.value, SOLANA_SYSVAR_OWNER);
    const bytes = solanaAccountData(a.data);
    if (bytes.length !== (request.params[0] === SOLANA_CLOCK ? 40 : 16_392))
      throw new Error('Unexpected sysvar size.');
    return { context: cleanContext, value: a };
  }
  if (request.method === 'getMultipleAccounts') {
    if (!Array.isArray(r.value) || r.value.length !== (request.params[0] as string[]).length)
      throw new Error('Unexpected DLMM pool list.');
    const value = r.value.map((entry: unknown) => {
      if (entry === null) return null;
      const a = account(entry, SOLANA_DLMM_PROGRAM);
      const space = solanaRecord(entry).space;
      solanaDlmmPool({ ...a, space });
      return { ...a, space };
    });
    return { context: cleanContext, value };
  }
  if (!Array.isArray(r.value)) throw new Error('Unexpected account list.');
  if (
    request.method === 'getProgramAccounts' &&
    request.params[0] === SOLANA_KAMINO_LIQUIDITY_PROGRAM
  ) {
    const seen = new Set<string>();
    const mints = new Set<string>();
    const value = r.value.slice(0, KAMINO_STRATEGY_CAP).map((entry: unknown) => {
      const parsed = solanaKaminoStrategy(entry);
      if (seen.has(parsed.strategy) || mints.has(parsed.mint))
        throw new Error('Duplicate strategy.');
      seen.add(parsed.strategy);
      mints.add(parsed.mint);
      const a = account(parsed.account, SOLANA_KAMINO_LIQUIDITY_PROGRAM);
      return { pubkey: parsed.strategy, account: { ...a, space: 4064 } };
    });
    return {
      context: cleanContext,
      value,
      ...(r.value.length > KAMINO_STRATEGY_CAP ? { truncated: true } : {}),
    };
  }
  const seen = new Set<string>();
  const value = r.value.slice(0, SOLANA_ACCOUNT_CAP).map((entry: unknown) => {
    const e = solanaRecord(entry);
    if (typeof e.pubkey !== 'string' || !isSolanaAddress(e.pubkey) || seen.has(e.pubkey))
      throw new Error('Unexpected account address.');
    seen.add(e.pubkey);
    if (request.method === 'getProgramAccounts') {
      if (request.params[0] === SOLANA_JUPITER_LOCK_PROGRAM) {
        const a = account(e.account, SOLANA_JUPITER_LOCK_PROGRAM);
        solanaJupiterLockAccount(a, request.address!);
        return { pubkey: e.pubkey, account: a };
      }
      if (request.params[0] === SOLANA_MARGINFI_PROGRAM) {
        const a = account(e.account, SOLANA_MARGINFI_PROGRAM);
        solanaMarginfiAccount(a, request.address!);
        return { pubkey: e.pubkey, account: a };
      }
      if (request.params[0] === SOLANA_DLMM_PROGRAM) {
        const a = account(e.account, SOLANA_DLMM_PROGRAM);
        const space = solanaRecord(e.account).space;
        solanaDlmmPosition({ ...a, space }, request.address!);
        return { pubkey: e.pubkey, account: { ...a, space } };
      }
      const a = account(e.account, SOLANA_STAKE_PROGRAM);
      const bytes = solanaAccountData(a.data);
      const authority = solanaAddressBytes(request.address!);
      if (bytes.length !== 200 || !authority.every((b, i) => bytes[44 + i] === b))
        throw new Error('Wrong stake withdrawer.');
      return { pubkey: e.pubkey, account: a };
    }
    const program = (request.params[1] as { programId: string }).programId;
    const a = account(e.account, program);
    const data = solanaRecord(a.data);
    const parsed = solanaRecord(data.parsed);
    const info = solanaRecord(parsed.info);
    const tokenAmount = solanaRecord(info.tokenAmount);
    if (
      parsed.type !== 'account' ||
      info.owner !== request.address ||
      typeof info.mint !== 'string' ||
      !isSolanaAddress(info.mint) ||
      typeof tokenAmount.amount !== 'string' ||
      !/^[0-9]+$/.test(tokenAmount.amount) ||
      (info.state !== 'initialized' && info.state !== 'frozen') ||
      typeof info.isNative !== 'boolean' ||
      (info.closeAuthority !== undefined &&
        (typeof info.closeAuthority !== 'string' || !isSolanaAddress(info.closeAuthority))) ||
      (info.extensions !== undefined && !Array.isArray(info.extensions))
    )
      throw new Error('Unexpected token account.');
    return {
      pubkey: e.pubkey,
      account: {
        ...a,
        data: {
          parsed: {
            type: 'account',
            info: {
              owner: info.owner,
              mint: info.mint,
              tokenAmount: { amount: tokenAmount.amount },
              state: info.state,
              isNative: info.isNative,
              ...(info.closeAuthority !== undefined ? { closeAuthority: info.closeAuthority } : {}),
              ...(info.extensions !== undefined ? { extensions: info.extensions } : {}),
            },
          },
        },
      },
    };
  });
  return {
    context: cleanContext,
    value,
    ...(r.value.length > SOLANA_ACCOUNT_CAP ? { truncated: true } : {}),
  };
}
