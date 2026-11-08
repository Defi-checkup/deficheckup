import {
  lookupPrice,
  valueAtPrice,
  EVM_NETWORKS,
  createSafePacer,
  safeWithin,
  SAFE_CHECK_BUDGET_MS,
  SAFE_REQUEST_SPACING_MS,
  isEvmAddress,
  toChecksumAddress,
  type Check,
  type CheckContext,
  type EvmAddress,
  type EvmNetwork,
  type Finding,
} from '@deficheckup/engine';

// Safe's transaction service, asked through our proxy (proxy/src/app.ts) with our API key. Checked
// on 2026-11-01: it serves 13 of our 15 networks (not Blast, not Flow EVM), and without a key each
// IP gets 5,000 requests a month, which would not last.
const SAFE_NETWORKS: readonly EvmNetwork[] = [
  'ethereum',
  'arbitrum',
  'optimism',
  'base',
  'polygon',
  'gnosis',
  'bsc',
  'avalanche',
  'zksync',
  'linea',
  'scroll',
  'mantle',
  'celo',
];

// A wallet in a few dozen Safes is rare; past this the scan says it is partial.
const MAX_SAFES = 20;
// Allow the last proxy response to travel back before this check returns.
const SAFE_RESPONSE_MARGIN_MS = 250;

// Estimate, not measured: execTransaction with one transfer. Simulating it needs the owners'
// signatures.
const TRANSFER_GAS = 90_000n;

/** Balances worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

/**
 * A token with no price is kept only if its symbol looks like a ticker. Spam slips past the
 * service's filter with lookalike letters: on 2026-11-01 a token named "ЕRС20" in Cyrillic.
 */
const PLAIN_SYMBOL = /^[A-Za-z0-9+-]{1,11}$/;

// Read from the Safe contract itself (same in every Safe version since 1.0): the service's copy of
// owners and threshold can lag, and reading it would spend quota.
const safeAbi = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface SafeBalance {
  tokenAddress: string | null;
  token: { symbol?: string; decimals?: number } | null;
  balance?: string;
}

/** Owner lists in one proxy call. A null result means no per-network answers were available. */
async function ownedSafes(
  ctx: CheckContext,
  owner: EvmAddress,
): Promise<{ network: EvmNetwork; safes: unknown }[] | null> {
  const answer = (await ctx
    .proxy('safe', { kind: 'owner-safes', address: owner })
    .catch(() => null)) as { lists?: Record<string, unknown> } | null;
  // Without per-network answers, a proxy failure cannot identify affected networks.
  if (!answer?.lists || typeof answer.lists !== 'object' || Array.isArray(answer.lists))
    return null;
  return SAFE_NETWORKS.map((network) => ({ network, safes: answer?.lists?.[network] ?? null }));
}

// One queue per scan, shared by wallets. It is discarded with the context, with no persistence.
const balancePacers = new WeakMap<CheckContext, ReturnType<typeof createSafePacer>>();

function safeBalances(
  ctx: CheckContext,
  network: EvmNetwork,
  safe: EvmAddress,
  deadline: number,
): Promise<unknown> {
  let pace = balancePacers.get(ctx);
  if (!pace) {
    pace = createSafePacer();
    balancePacers.set(ctx, pace);
  }
  // Leave a slot after the final owner request even if it answered immediately.
  return pace(
    () =>
      safeWithin(
        ctx.proxy('safe', {
          kind: 'balances',
          network,
          address: safe,
          budgetMs: Math.max(0, deadline - Date.now() - SAFE_RESPONSE_MARGIN_MS),
        }),
        deadline,
        null,
      ),
    deadline,
    Date.now() + SAFE_REQUEST_SPACING_MS,
  );
}

/**
 * Who has to sign, in words. A signers read that failed never falls back to "you own": the
 * wallet might share the Safe with owners who can move the funds without it.
 */
function describeSafe(owners: string[] | null, threshold: unknown): string | null {
  if (owners === null || typeof threshold !== 'bigint') return null;
  const n = owners.length;
  // A Safe set up through its contract always has 1 <= threshold <= owners; anything else is a
  // bad read, not a Safe to describe.
  if (threshold < 1n || threshold > BigInt(n)) return null;
  if (threshold > 1n) return `in a Safe you co-own (needs ${threshold} of ${n} signatures)`;
  if (n > 1) return `in a Safe you share (any of its ${n} owners can move it)`;
  return 'in a Safe you own';
}

/** The owner list, or null when the answer is not a non-empty list of addresses. */
function ownerList(answer: unknown): string[] | null {
  if (!Array.isArray(answer) || answer.length === 0) return null;
  return answer.every((o): o is string => typeof o === 'string' && isEvmAddress(o)) ? answer : null;
}

async function readSafe(
  ctx: CheckContext,
  network: EvmNetwork,
  safe: EvmAddress,
  wallet: EvmAddress,
  deadline: number,
): Promise<{ findings: Finding[]; failed: boolean; signersUnknown: boolean }> {
  const read = (functionName: 'getOwners' | 'getThreshold') =>
    ctx.readContract({ network, to: safe, abi: safeAbi, functionName }).catch(() => undefined);
  const [balances, owners, threshold] = await Promise.all([
    safeBalances(ctx, network, safe, deadline).catch(() => undefined),
    read('getOwners'),
    read('getThreshold'),
  ]);
  // Every entry must be readable: a token balance without its symbol or decimals cannot be valued.
  const readable =
    Array.isArray(balances) &&
    balances.every(
      (entry: SafeBalance | null) =>
        typeof entry?.balance === 'string' &&
        /^\d+$/.test(entry.balance) &&
        (entry.tokenAddress === null ||
          (typeof entry.token?.symbol === 'string' &&
            entry.token.symbol.trim() !== '' &&
            Number.isSafeInteger(entry.token.decimals) &&
            entry.token.decimals! >= 0 &&
            entry.token.decimals! <= 36)),
    );
  if (!readable) return { findings: [], failed: true, signersUnknown: false };

  // The service can list a Safe the wallet was removed from; a valid owner list has the last word.
  const list = ownerList(owners);
  if (list && !list.some((o) => o.toLowerCase() === wallet.toLowerCase())) {
    return { findings: [], failed: false, signersUnknown: false };
  }
  const described = describeSafe(list, threshold);
  const where = described ?? 'in a Safe that lists you as an owner (could not read who signs)';
  const native = EVM_NETWORKS[network].chain.nativeCurrency;

  const findings = await Promise.all(
    (balances as SafeBalance[]).flatMap((entry) => {
      if (!entry.balance || !/^\d+$/.test(entry.balance) || entry.balance === '0') return [];
      const isNative = entry.tokenAddress === null;
      const symbol = isNative ? native.symbol : entry.token?.symbol;
      const decimals = isNative ? native.decimals : entry.token?.decimals;
      if (!symbol || typeof decimals !== 'number') return [];

      return [
        (async (): Promise<Finding> => {
          const amount = { raw: BigInt(entry.balance!), decimals, symbol };
          const [price, claimCostUsd] = await Promise.all([
            lookupPrice(ctx, network, isNative ? 'native' : entry.tokenAddress!),
            ctx.gasCostUsd(network, TRANSFER_GAS),
          ]);
          return {
            title: `${symbol} ${where}`,
            network,
            amount,
            ...valueAtPrice(amount, price),
            claimCostUsd,
            deadline: null,
            heldBy: safe,
          };
        })(),
      ];
    }),
  );
  return { findings, failed: false, signersUnknown: described === null };
}

export const safeOwnerCheck: Check = {
  id: 'safe-owner',
  name: 'Safes you own',
  networks: SAFE_NETWORKS,
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.safe.global',
  deadline: null,
  // Safes and their tokens are discovered per user, never enumerated here.
  contracts: [],
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }
    const deadline = Date.now() + SAFE_CHECK_BUDGET_MS;
    const owner = toChecksumAddress(address); // the service rejects lowercase addresses

    const lists = await safeWithin(ownedSafes(ctx, owner), deadline, null);
    if (!lists) return { kind: 'error', reason: 'Some Safes or networks could not be read.' };

    // A list that is missing or holds anything but addresses counts as a network not read.
    const valid = (safes: unknown): safes is EvmAddress[] =>
      Array.isArray(safes) && safes.every((x) => typeof x === 'string' && isEvmAddress(x));
    const failedNetworks = new Set(lists.filter((l) => !valid(l.safes)).map((l) => l.network));
    const safes = lists.flatMap(({ network, safes }) =>
      valid(safes) ? safes.map((safe) => ({ network, safe })) : [],
    );
    const scanned = safes.slice(0, MAX_SAFES);
    const results = await Promise.all(
      scanned.map(({ network, safe }) =>
        safeWithin(readSafe(ctx, network, safe, owner, deadline), deadline, {
          findings: [],
          failed: true,
          signersUnknown: false,
        }),
      ),
    );
    results.forEach((result, index) => {
      if (result.failed) failedNetworks.add(scanned[index]!.network);
    });

    const notes: string[] = [];
    if (failedNetworks.size > 0) notes.push('Some Safes or networks could not be read.');
    if (safes.length > scanned.length) {
      notes.push(`Only ${scanned.length} of your ${safes.length} Safes were checked.`);
      safes.slice(scanned.length).forEach(({ network }) => failedNetworks.add(network));
    }

    const kept = results
      .flatMap((r) => r.findings)
      .filter((f) =>
        f.valueUsd === null ? PLAIN_SYMBOL.test(f.amount.symbol) : f.valueUsd >= DUST_USD,
      );
    const unknownSigners = new Set(
      results.filter((r) => r.signersUnknown).flatMap((r) => r.findings.map((f) => f.heldBy)),
    );
    if (kept.some((f) => unknownSigners.has(f.heldBy))) {
      notes.push('For some Safes it is unknown who else can sign.');
      results.forEach((result, index) => {
        if (result.signersUnknown && result.findings.some((f) => kept.includes(f))) {
          failedNetworks.add(scanned[index]!.network);
        }
      });
    }
    const failures = SAFE_NETWORKS.filter((network) => failedNetworks.has(network));
    const [first, ...rest] = kept;
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(notes.length > 0 ? { partial: notes.join(' '), failedNetworks: failures } : {}),
      };
    }
    if (notes.length > 0) {
      return { kind: 'error', reason: notes.join(' '), failedNetworks: failures };
    }
    return { kind: 'nothing' };
  },
};
