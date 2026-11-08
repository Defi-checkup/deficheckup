import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  amountToNumber,
  isEvmAddress,
  type Check,
  type CheckContext,
  type EvmAddress,
  type Finding,
} from '@deficheckup/engine';

// zkSync Lite shut down on 2026-05-04. What was left on it is paid on Ethereum by the sunset claim
// distributor, a transparent proxy (admin 0xDc7009bCAabD4069391C0aa9445D58a759fE1c7d) whose
// implementation 0xfB94f8a45E81fa9f6256Ddb0EEc0735b8520CdeA is verified on Sourcify (read on
// 2026-11-01): claimTo(index, claimant, token, amount, proof) pays the claimant whoever sends it,
// isClaimed(index) says whether a leaf was paid, there is no deadline and no sweep, and the owner
// can pause it. It held 5,498.7 ETH that day.
const DISTRIBUTOR: EvmAddress = '0x0a14B696350546110a0D8acDb86226983af9D2a0';

// Measured on 2026-11-01: 48 real claims that day used 66,887 to 122,642 gas each. We use the
// highest. Every token is its own claim.
const CLAIM_GAS = 122_642n;

/** Balances worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

const NATIVE = '0x0000000000000000000000000000000000000000';

const distributorAbi = [
  {
    type: 'function',
    name: 'isClaimed',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface LiteToken {
  claimIndex: number;
  tokenAddress: EvmAddress;
  symbol: string;
  decimals: number;
  amount: bigint;
}

/** The proxy's answer, or null when its shape is not the expected one. */
function parseTokens(answer: unknown): LiteToken[] | null {
  const tokens = (answer as { tokens?: unknown } | null)?.tokens;
  if (!Array.isArray(tokens)) return null;
  const parsed: LiteToken[] = [];
  for (const t of tokens as Record<string, unknown>[]) {
    const { claimIndex, tokenAddress, symbol, decimals, rawBalance } = t ?? {};
    if (
      typeof claimIndex !== 'number' ||
      !Number.isSafeInteger(claimIndex) ||
      claimIndex < 0 ||
      typeof tokenAddress !== 'string' ||
      !isEvmAddress(tokenAddress) ||
      typeof symbol !== 'string' ||
      typeof decimals !== 'number' ||
      !Number.isSafeInteger(decimals) ||
      decimals < 0 ||
      typeof rawBalance !== 'string' ||
      !/^[0-9]+$/.test(rawBalance)
    ) {
      return null;
    }
    parsed.push({ claimIndex, tokenAddress, symbol, decimals, amount: BigInt(rawBalance) });
  }
  return parsed;
}

/** What the distributor still holds of this token. */
function distributorHolds(token: LiteToken, ctx: CheckContext): Promise<unknown> {
  return token.tokenAddress === NATIVE
    ? ctx.nativeBalance('ethereum', DISTRIBUTOR)
    : ctx.readContract({
        network: 'ethereum',
        to: token.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [DISTRIBUTOR],
      });
}

export const zksyncLiteCheck: Check = {
  id: 'zksync-lite',
  name: 'zkSync Lite balances left at the shutdown',
  networks: ['ethereum'],
  category: 'closed-network',
  status: { kind: 'closed-with-claim', since: '2026-05-04' },
  officialLink: 'https://lite.zksync.io',
  deadline: null,
  contracts: evmContracts('ethereum', DISTRIBUTOR),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    let answer: unknown;
    try {
      // lite.zksync.io lists every balance an address can claim, but does not answer browsers.
      answer = await ctx.proxy('zksync-lite', { address });
    } catch {
      return { kind: 'error', reason: 'Could not reach the zkSync Lite claim list.' };
    }
    const tokens = parseTokens(answer);
    if (tokens === null) {
      return { kind: 'error', reason: 'Unexpected answer from the zkSync Lite claim list.' };
    }
    if (tokens.length === 0) return { kind: 'nothing' };

    const read = (functionName: 'isClaimed' | 'paused', args?: readonly unknown[]) =>
      ctx.readContract({
        network: 'ethereum',
        to: DISTRIBUTOR,
        abi: distributorAbi,
        functionName,
        ...(args ? { args } : {}),
      });
    const [paused, ...states] = await Promise.allSettled([
      read('paused'),
      ...tokens.map((t) => read('isClaimed', [BigInt(t.claimIndex)])),
    ]);
    if (paused.status !== 'fulfilled' || typeof paused.value !== 'boolean') {
      return { kind: 'error', reason: 'Could not read the zkSync Lite claim contract.' };
    }

    let unreadable = 0;
    const open: LiteToken[] = [];
    tokens.forEach((token, i) => {
      const state = states[i]!;
      if (state.status !== 'fulfilled' || typeof state.value !== 'boolean') unreadable += 1;
      else if (!state.value) open.push(token);
    });

    const notices: string[] = [];
    const findings = (
      await Promise.all(
        open.map(async (token): Promise<Finding | null> => {
          const [held, price, claimCostUsd] = await Promise.all([
            distributorHolds(token, ctx).catch(() => undefined),
            lookupPrice(
              ctx,
              'ethereum',
              token.tokenAddress === NATIVE ? 'native' : token.tokenAddress,
            ),
            ctx.gasCostUsd('ethereum', CLAIM_GAS),
          ]);
          const amount = { raw: token.amount, decimals: token.decimals, symbol: token.symbol };
          const valuation = valueAtPrice(amount, price);
          const { valueUsd } = valuation;
          // A failed read counts even for dust: it may not be dust once its price is known.
          if (typeof held !== 'bigint') {
            unreadable += 1;
            return null;
          }
          if (valueUsd !== null && valueUsd < DUST_USD) return null;
          if (held < token.amount) {
            notices.push(
              `${amountToNumber(amount)} ${token.symbol} cannot be paid: the claim contract holds less than that.`,
            );
            return null;
          }
          return {
            title: `${token.symbol} left on zkSync Lite`,
            network: 'ethereum',
            amount,
            ...valuation,
            claimCostUsd,
            deadline: null,
            heldBy: DISTRIBUTOR,
            note: paused.value
              ? 'Claims are paused by the contract owner right now; check again later.'
              : 'Each token is its own claim. Anyone can send it, and the funds always go to your address.',
          };
        }),
      )
    ).filter((finding): finding is Finding => finding !== null);

    const [first, ...rest] = findings;
    const missing = 'Some zkSync Lite balances could not be checked.';
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(unreadable > 0 ? { partial: missing } : {}),
        ...(notices.length > 0 ? { notices } : {}),
      };
    }
    if (unreadable > 0) return { kind: 'error', reason: missing };
    if (notices.length > 0) return { kind: 'lost', reason: notices.join(' ') };
    return open.length === 0 ? { kind: 'nothing', alreadyClaimed: true } : { kind: 'nothing' };
  },
};
