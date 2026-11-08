import {
  lookupPrice,
  valueAtPrice,
  isSolanaAddress,
  solanaAddressString,
  solanaDlmmParams,
  solanaDlmmPoolsParams,
  solanaDlmmPosition,
  solanaDlmmPool,
  solanaRecord,
  SOLANA_DLMM_PROGRAM,
  DLMM_POOL_CAP,
  type Check,
  type CheckFinding,
} from '@deficheckup/engine';
import { solanaAccounts, SOLANA_BASE_FEE, SOLANA_FEE_NOTE } from '../shared/solana';

export const meteoraDlmmCheck: Check = {
  id: 'meteora-dlmm',
  name: 'Meteora DLMM positions',
  networks: ['solana'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://www.meteora.ag',
  deadline: null,
  contracts: [{ network: 'solana', address: SOLANA_DLMM_PROGRAM }],
  verifiedOn: '2026-11-02',
  async check(address, ctx) {
    if (!isSolanaAddress(address)) return { kind: 'error', reason: 'Not a valid Solana address.' };
    try {
      const { accounts, truncated } = solanaAccounts(
        await ctx.solanaRpc('getProgramAccounts', solanaDlmmParams(address)),
      );
      const findings: CheckFinding[] = [];
      const notices: string[] = [];
      let incomplete = truncated;
      const positions: {
        pubkey: string;
        pool: string;
        lower: number;
        upper: number;
        liquidity: boolean;
      }[] = [];
      for (const entry of accounts) {
        try {
          const { bytes, view, extended } = solanaDlmmPosition(entry.account, address);
          const lower = view.getInt32(7912, true);
          const upper = view.getInt32(7916, true);
          if (extended || upper < lower || upper - lower >= 70 || bytes[8033]! > 1) {
            incomplete = true;
            notices.push(
              `${entry.pubkey}: extended or unsupported position; inspect it in Meteora.`,
            );
            continue;
          }
          let liquidity = false;
          let pending = false;
          // PositionV2 inline bins: u128 shares, then 70 UserRewardInfo and 70 FeeInfo.
          // The official PositionExtension::is_empty checks shares AND pending fees/rewards.
          for (let i = 0; i < 70; i++) {
            liquidity ||=
              view.getBigUint64(72 + i * 16, true) !== 0n ||
              view.getBigUint64(80 + i * 16, true) !== 0n;
            for (const offset of [1192 + i * 48 + 32, 4552 + i * 48 + 32]) {
              pending ||=
                view.getBigUint64(offset, true) !== 0n ||
                view.getBigUint64(offset + 8, true) !== 0n;
            }
          }
          if (liquidity || pending) {
            positions.push({
              pubkey: entry.pubkey,
              pool: solanaAddressString(bytes.subarray(8, 40)),
              lower,
              upper,
              liquidity,
            });
          } else if (entry.lamports > 0n) {
            findings.push({
              title: 'SOL rent in an empty Meteora DLMM position',
              network: 'solana',
              amount: { raw: entry.lamports, decimals: 9, symbol: 'SOL' },
              valueUsd: null,
              claimCostUsd: null,
              deadline: null,
              heldBy: entry.pubkey,
              note: `No liquidity shares or pending fees or rewards remain. Closing the position through Meteora can return its actual lamport balance to its owner. ${SOLANA_FEE_NOTE}`,
            });
          }
        } catch {
          incomplete = true;
        }
      }
      const pools = [...new Set(positions.filter((p) => p.liquidity).map((p) => p.pool))];
      // Price and pool reads are independent. Starting them together keeps the second RPC
      // from consuming the time needed to preserve rent findings when pricing is slow.
      const pricePromise = findings.some((finding) => finding.amount !== null)
        ? lookupPrice(ctx, 'solana', 'native')
        : Promise.resolve(null);
      const selected = pools.slice(0, DLMM_POOL_CAP);
      const activeBins = new Map<string, number>();
      incomplete ||= pools.length > DLMM_POOL_CAP;
      if (selected.length) {
        try {
          const result = solanaRecord(
            await ctx.solanaRpc('getMultipleAccounts', solanaDlmmPoolsParams(selected)),
          );
          const slot = solanaRecord(result.context).slot;
          if (
            !Number.isSafeInteger(slot) ||
            (slot as number) < 0 ||
            !Array.isArray(result.value) ||
            result.value.length !== selected.length
          )
            throw new Error('Unexpected pool response.');
          for (const [i, value] of result.value.entries()) {
            try {
              activeBins.set(selected[i]!, solanaDlmmPool(value).getInt32(76, true));
            } catch {
              incomplete = true;
            }
          }
        } catch {
          incomplete = true;
        }
      }
      for (const position of positions) {
        const active = activeBins.get(position.pool);
        const outOfRange =
          active !== undefined && (active < position.lower || active > position.upper);
        findings.push({
          title: position.liquidity
            ? `Meteora DLMM liquidity${outOfRange ? ' outside its position range' : ''}`
            : 'Meteora DLMM position with pending fees or rewards',
          network: 'solana',
          amount: null,
          valueUsd: null,
          claimCostUsd: null,
          deadline: null,
          heldBy: position.pubkey,
          note: `Nonzero ${position.liquidity ? 'liquidity shares' : 'pending fees or rewards'} were read on-chain. Open Meteora to calculate token amounts and check withdrawal conditions, locks and any separate fee owner. ${outOfRange ? 'The pool active bin is outside this position range; that does not mean the position is empty. ' : ''}${position.liquidity && active === undefined ? 'The current range status could not be checked. ' : ''}No token value or refundable rent is counted for this position.`,
        });
      }
      const partial = incomplete
        ? 'Some positions or pool ranges could not be checked. Extended positions are unsupported; limits are 500 positions and 10 pool range reads.'
        : undefined;
      if (!findings.length) {
        if (partial) return { kind: 'error', reason: [partial, ...notices].join(' ') };
        return { kind: 'nothing' };
      }
      if (findings.some((finding) => finding.amount !== null)) {
        const price = (await pricePromise)!;
        for (const finding of findings) {
          if (finding.amount === null) continue;
          Object.assign(finding, valueAtPrice(finding.amount, price));
          finding.claimCostUsd =
            price.usd === null ? null : (Number(SOLANA_BASE_FEE) / 1e9) * price.usd;
        }
      }
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(partial ? { partial } : {}),
        ...(notices.length ? { notices } : {}),
      };
    } catch {
      return { kind: 'error', reason: 'Meteora DLMM positions could not be read.' };
    }
  },
};
