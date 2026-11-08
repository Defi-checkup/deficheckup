import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type CheckFinding,
} from '@deficheckup/engine';
import { evmContracts } from '../shared/contracts';
import { abi } from './abi';

// Official deployment and current proxy implementation verified on Sourcify, 2026-11-02.
// balanceOf, owner enumeration, status, checkpoint hints and getClaimableEther were read at
// the explicit block in recorded.json. getClaimableEther = 30134264486219968 wei for request
// 140174; claimWithdrawal passed eth_call without sending a transaction.
export const WITHDRAWAL_QUEUE = '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1';
const IMPLEMENTATION = '0xE42C659Dc09109566720EA8b2De186c2Be7D94D9';
export const MAX_REQUESTS = 64;
// Estimate, not measured: one claimWithdrawal per request, without assuming batch savings.
const CLAIM_GAS = 150_000n;
const DISCOVERY_BUDGET_MS = 6_000;
const incomplete =
  'The Lido withdrawal list could not be checked completely. Review your requests in the official app.';

interface Status {
  amountOfStETH: bigint;
  amountOfShares: bigint;
  owner: string;
  timestamp: bigint;
  isFinalized: boolean;
  isClaimed: boolean;
}
const uint = (v: unknown): v is bigint => typeof v === 'bigint' && v >= 0n;
function status(v: unknown): v is Status {
  if (!v || typeof v !== 'object') return false;
  const s = v as Status;
  return (
    uint(s.amountOfStETH) &&
    uint(s.amountOfShares) &&
    uint(s.timestamp) &&
    typeof s.owner === 'string' &&
    isEvmAddress(s.owner) &&
    typeof s.isFinalized === 'boolean' &&
    typeof s.isClaimed === 'boolean'
  );
}
const uints = (v: unknown): v is bigint[] => Array.isArray(v) && v.every(uint);

export const lidoWithdrawalsCheck: Check = {
  id: 'lido-withdrawals',
  name: 'Lido finalized withdrawals',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://stake.lido.fi/withdrawals/claim',
  verifiedOn: '2026-11-02',
  deadline: null,
  contracts: evmContracts('ethereum', WITHDRAWAL_QUEUE, IMPLEMENTATION),

  async check(address, ctx) {
    if (!isEvmAddress(address)) return { kind: 'error', reason: 'Not a valid EVM address.' };
    const started = Date.now();
    const read = (functionName: string, args: unknown[] = []) =>
      ctx.readContract({ network: 'ethereum', to: WITHDRAWAL_QUEUE, abi, functionName, args });
    try {
      // getWithdrawalRequests copies the whole set. Preflight balanceOf before calling it:
      // large owners get an explicit incomplete result without requesting the unbounded list.
      const count = await read('balanceOf', [address]);
      if (!uint(count)) throw new Error('Invalid count');
      if (count === 0n) return { kind: 'nothing' };
      if (count > BigInt(MAX_REQUESTS) || Date.now() - started >= DISCOVERY_BUDGET_MS) {
        return { kind: 'error', reason: incomplete };
      }
      const [ids, lastCheckpoint] = await Promise.all([
        read('getWithdrawalRequests', [address]),
        read('getLastCheckpointIndex'),
      ]);
      if (
        !uints(ids) ||
        ids.length > MAX_REQUESTS ||
        BigInt(ids.length) !== count ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => id === 0n) ||
        !uint(lastCheckpoint)
      ) {
        throw new Error('Invalid enumeration');
      }
      if (Date.now() - started >= DISCOVERY_BUDGET_MS) return { kind: 'error', reason: incomplete };
      const sorted = [...ids].sort((a, b) => (a < b ? -1 : 1));
      const statuses = await read('getWithdrawalStatus', [sorted]);
      if (
        !Array.isArray(statuses) ||
        statuses.length !== sorted.length ||
        !statuses.every(status)
      ) {
        throw new Error('Invalid status');
      }
      // A concurrent transfer/claim invalidates this discovery rather than assigning someone
      // else's request to the input wallet. Nominal stETH is never used as claimable ETH.
      if (statuses.some((s) => s.owner.toLowerCase() !== address.toLowerCase() || s.isClaimed)) {
        throw new Error('Ownership changed');
      }
      const ready = sorted.filter((_, i) => statuses[i]!.isFinalized);
      const pending = sorted.length - ready.length;
      if (!ready.length)
        return {
          kind: 'nothing',
          note: 'Your Lido requests are still awaiting finalization. No ETH is claimable from them yet.',
        };
      if (lastCheckpoint === 0n || Date.now() - started >= DISCOVERY_BUDGET_MS) {
        return { kind: 'error', reason: incomplete };
      }
      const hints = await read('findCheckpointHints', [ready, 1n, lastCheckpoint]);
      if (
        !uints(hints) ||
        hints.length !== ready.length ||
        hints.some((h) => h === 0n || h > lastCheckpoint)
      ) {
        throw new Error('Invalid hints');
      }
      const amounts = await read('getClaimableEther', [ready, hints]);
      if (!uints(amounts) || amounts.length !== ready.length || amounts.some((a) => a === 0n)) {
        throw new Error('Invalid claimable amounts');
      }
      const [price, claimCostUsd] = await Promise.all([
        lookupPrice(ctx, 'ethereum', 'native'),
        ctx.gasCostUsd('ethereum', CLAIM_GAS).catch(() => null),
      ]);
      const findings: CheckFinding[] = amounts.map((raw, i) => {
        const amount = { raw, decimals: 18, symbol: 'ETH' };
        return {
          title: `ETH from finalized Lido request #${ready[i]}`,
          network: 'ethereum',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: null,
          heldBy: WITHDRAWAL_QUEUE,
          note: 'The current unstETH NFT owner can claim this ETH. Claiming burns the withdrawal NFT.',
        };
      });
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(pending
          ? {
              notices: [
                'Other Lido requests are still awaiting finalization and are not included in the claimable ETH.',
              ],
            }
          : {}),
      };
    } catch {
      return { kind: 'error', reason: incomplete };
    }
  },
};
