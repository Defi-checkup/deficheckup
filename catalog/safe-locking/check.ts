import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type Finding,
} from '@deficheckup/engine';

// SafeTokenLock on Ethereum, read on-chain on 2026-11-01: SAFE_TOKEN() is SAFE and
// COOLDOWN_PERIOD() is 86,400 s (one day). getUser(holder) returns what is still locked and what was
// unlocked but not withdrawn yet; unlocks are queued from unlockStart to unlockEnd, and each matures
// one day after it was asked for. Safe{Pass}, the points program that rewarded locking, was
// discontinued, so many holders left SAFE here.
const SAFE_LOCK = '0x0a7CB434f96f65972D46A5c1A64a9654dC9959b2';
const SAFE_TOKEN = '0x5aFE3855358E112B5647B952709E6165e1c1eEEe';

// Measured on 2026-11-01 with eth_estimateGas from real holders: unlock(all) 51,929 gas and
// withdraw(0) 71,101 gas with one unlock in the queue (53,831 for a holder whose storage was
// already warm).
const UNLOCK_GAS = 51_929n;
const WITHDRAW_GAS = 71_101n;
// Estimate, not measured: withdraw(0) walks every matured unlock in the queue, reading and clearing
// one storage slot each. No public holder with several queued unlocks was found to measure it.
const WITHDRAW_GAS_PER_EXTRA_UNLOCK = 10_000n;

/** Gas of withdraw(0) for a queue of this many unlocks. */
function withdrawGas(unlocks: number): bigint {
  return WITHDRAW_GAS + WITHDRAW_GAS_PER_EXTRA_UNLOCK * BigInt(Math.max(unlocks - 1, 0));
}

const lockAbi = [
  {
    type: 'function',
    name: 'getUser',
    stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }],
    outputs: [
      {
        name: 'user',
        type: 'tuple',
        components: [
          { name: 'locked', type: 'uint96' },
          { name: 'unlocked', type: 'uint96' },
          { name: 'unlockStart', type: 'uint32' },
          { name: 'unlockEnd', type: 'uint32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getUnlock',
    stateMutability: 'view',
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'index', type: 'uint32' },
    ],
    outputs: [
      {
        name: 'unlockInfo',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint96' },
          { name: 'maturesAt', type: 'uint64' },
        ],
      },
    ],
  },
] as const;

interface User {
  locked: bigint;
  unlocked: bigint;
  unlockStart: number;
  unlockEnd: number;
}

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.locked === 'bigint' &&
    typeof user.unlocked === 'bigint' &&
    typeof user.unlockStart === 'number' &&
    typeof user.unlockEnd === 'number'
  );
}

export const safeLockingCheck: Check = {
  id: 'safe-locking',
  name: 'SAFE token locking',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.safe.global',
  deadline: null,
  contracts: evmContracts('ethereum', SAFE_LOCK, SAFE_TOKEN),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const user = await ctx.readContract({
      network: 'ethereum',
      to: SAFE_LOCK,
      abi: lockAbi,
      functionName: 'getUser',
      args: [address],
    });
    if (!isUser(user)) {
      return { kind: 'error', reason: 'Unexpected response from the SAFE locking contract.' };
    }
    if (user.locked === 0n && user.unlocked === 0n) return { kind: 'nothing' };

    const queued = Math.max(user.unlockEnd - user.unlockStart, 0);
    // The newest unlock matures last: if it is ready, everything unlocked is ready.
    const [latest, price, unlockCost, withdrawCost] = await Promise.all([
      user.unlocked > 0n && user.unlockEnd > user.unlockStart
        ? ctx
            .readContract({
              network: 'ethereum',
              to: SAFE_LOCK,
              abi: lockAbi,
              functionName: 'getUnlock',
              args: [address, user.unlockEnd - 1],
            })
            .catch(() => null)
        : null,
      lookupPrice(ctx, 'ethereum', SAFE_TOKEN),
      // Unlocking the rest adds one more unlock to the queue the withdrawal walks.
      ctx.gasCostUsd('ethereum', UNLOCK_GAS + withdrawGas(queued + 1)),
      ctx.gasCostUsd('ethereum', withdrawGas(queued)),
    ]);

    const value = (raw: bigint) => valueAtPrice({ raw, decimals: 18, symbol: 'SAFE' }, price);
    const findings: Finding[] = [];

    if (user.unlocked > 0n) {
      const maturesAt =
        latest &&
        typeof latest === 'object' &&
        typeof (latest as { maturesAt?: unknown }).maturesAt === 'bigint'
          ? Number((latest as { maturesAt: bigint }).maturesAt) * 1000
          : null;
      const note =
        maturesAt === null
          ? 'When it can be withdrawn could not be read: unlocks need a one-day cooldown.'
          : maturesAt > Date.now()
            ? `Part of it is still in the one-day cooldown, until ${new Date(maturesAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
            : undefined;
      findings.push({
        title: 'SAFE unlocked but never withdrawn',
        network: 'ethereum',
        amount: { raw: user.unlocked, decimals: 18, symbol: 'SAFE' },
        ...value(user.unlocked),
        claimCostUsd: withdrawCost,
        deadline: null,
        heldBy: SAFE_LOCK,
        ...(note ? { note } : {}),
      });
    }
    if (user.locked > 0n) {
      findings.push({
        title: 'SAFE still locked',
        network: 'ethereum',
        amount: { raw: user.locked, decimals: 18, symbol: 'SAFE' },
        ...value(user.locked),
        claimCostUsd: unlockCost,
        deadline: null,
        heldBy: SAFE_LOCK,
        note: 'Unlock it first, then withdraw it after a one-day cooldown: two transactions.',
      });
    }

    const [first, ...rest] = findings;
    return { kind: 'found', findings: [first!, ...rest] };
  },
};
