import {
  lookupPrice,
  valueAtPrice,
  isSolanaAddress,
  solanaAddressBytes,
  solanaAccountData,
  SOLANA_STAKE_PROGRAM,
  SOLANA_CLOCK,
  SOLANA_STAKE_HISTORY,
  solanaStakeParams,
  solanaSysvarParams,
  type Check,
  type Finding,
} from '@deficheckup/engine';
import { solanaAccounts, solanaSysvar, SOLANA_BASE_FEE, SOLANA_FEE_NOTE } from '../shared/solana';
import { effectiveStake, stakeHistory, U64_MAX } from './activation';

export const solanaStakeCheck: Check = {
  id: 'solana-stake',
  name: 'Solana native stake accounts',
  networks: ['solana'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://solana.com/staking',
  deadline: null,
  contracts: [{ network: 'solana', address: SOLANA_STAKE_PROGRAM }],
  verifiedOn: '2026-11-01',
  async check(address, ctx) {
    if (!isSolanaAddress(address)) return { kind: 'error', reason: 'Not a valid Solana address.' };
    try {
      // These are the only RPC calls. Their fixed filters are also enforced by the proxy.
      const [answer, clockAnswer, historyAnswer] = await Promise.all([
        ctx.solanaRpc('getProgramAccounts', solanaStakeParams(address)),
        ctx.solanaRpc('getAccountInfo', solanaSysvarParams(SOLANA_CLOCK)),
        ctx.solanaRpc('getAccountInfo', solanaSysvarParams(SOLANA_STAKE_HISTORY)),
      ]);
      const { accounts, truncated } = solanaAccounts(answer);
      const clock = solanaSysvar(clockAnswer);
      if (clock.byteLength !== 40) throw new Error('Unexpected clock.');
      const epoch = clock.getBigUint64(16, true);
      const now = clock.getBigInt64(32, true);
      const history = stakeHistory(solanaSysvar(historyAnswer), epoch);
      const authority = solanaAddressBytes(address);
      const notices: string[] = [];
      let unreadable = 0;
      const available: { pubkey: string; raw: bigint; custodianRequired: boolean }[] = [];
      for (const entry of accounts) {
        try {
          if (entry.account.owner !== SOLANA_STAKE_PROGRAM) throw new Error('Wrong program.');
          const bytes = solanaAccountData(entry.account.data);
          if (bytes.length !== 200 || !authority.every((b, i) => bytes[44 + i] === b))
            throw new Error('Wrong withdrawer.');
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const variant = view.getUint32(0, true);
          if (variant !== 1 && variant !== 2) throw new Error('Unknown stake state.');
          const custodianRequired =
            view.getBigInt64(76, true) > now || view.getBigUint64(84, true) > epoch;
          if (custodianRequired && !authority.every((b, i) => bytes[92 + i] === b)) {
            notices.push(
              `${entry.pubkey}: a stake lockup is still in force. Withdrawal needs its expiry or the custodian's signature.`,
            );
            continue;
          }
          if (variant === 2) {
            const d = {
              stake: view.getBigUint64(156, true),
              activation: view.getBigUint64(164, true),
              deactivation: view.getBigUint64(172, true),
            };
            // Before deactivation the program reserves the whole delegation, including activating
            // stake. This check counts full withdrawals only, never active stake or excess top-ups.
            if (
              d.stake > 0n &&
              (d.deactivation === U64_MAX ||
                epoch < d.deactivation ||
                effectiveStake(d, epoch, history) > 0n)
            ) {
              notices.push(
                `${entry.pubkey}: ${d.deactivation === U64_MAX ? 'stake is active or activating. Deactivate it first in a trusted wallet' : 'stake is still deactivating. Wait for cooldown to finish'}. Cooldown normally takes one epoch (about two days), but can take longer. This balance is not counted as withdrawable.`,
              );
              continue;
            }
          }
          if (entry.lamports > 0n)
            available.push({ pubkey: entry.pubkey, raw: entry.lamports, custodianRequired });
        } catch {
          unreadable++;
        }
      }
      const partial =
        truncated || unreadable > 0
          ? 'Some Solana stake accounts could not be read or the 500-account limit was reached.'
          : undefined;
      if (!available.length) {
        if (partial) return { kind: 'error', reason: [partial, ...notices].join(' ') };
        return {
          kind: 'nothing',
          ...(notices.length
            ? { note: `No stake can be fully withdrawn now. ${notices.join(' ')}` }
            : {}),
        };
      }
      const price = await lookupPrice(ctx, 'solana', 'native');
      const findings = available.map(({ pubkey, raw, custodianRequired }): Finding => {
        const amount = { raw, decimals: 9, symbol: 'SOL' };
        return {
          title: 'SOL in a withdrawable native stake account',
          network: 'solana',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd: price.usd === null ? null : (Number(SOLANA_BASE_FEE) / 1e9) * price.usd,
          deadline: null,
          heldBy: pubkey,
          note: `Includes all account lamports, including the rent reserve, when the account is fully withdrawn and closed. The withdrawer's signature is required in a trusted wallet. ${custodianRequired ? 'Your address is also the lockup custodian: the wallet must include its custodian authorization. ' : ''}${SOLANA_FEE_NOTE}`,
        };
      });
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(notices.length ? { notices } : {}),
        ...(partial ? { partial } : {}),
      };
    } catch {
      return {
        kind: 'error',
        reason: 'Solana stake accounts, clock or stake history could not be read.',
      };
    }
  },
};
