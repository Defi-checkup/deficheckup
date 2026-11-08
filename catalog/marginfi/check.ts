import {
  isSolanaAddress,
  solanaMarginfiParams,
  solanaMarginfiAccount,
  marginfiShares,
  SOLANA_MARGINFI_PROGRAM,
  type Check,
  type PositionFinding,
} from '@deficheckup/engine';
import { solanaAccounts } from '../shared/solana';

export const marginfiCheck: Check = {
  id: 'marginfi',
  name: 'marginfi accounts (Project 0)',
  networks: ['solana'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.marginfi.com',
  verifiedOn: '2026-11-02',
  deadline: null,
  contracts: [{ network: 'solana', address: SOLANA_MARGINFI_PROGRAM }],
  async check(address, ctx) {
    if (!isSolanaAddress(address)) return { kind: 'error', reason: 'Not a valid Solana address.' };
    try {
      const { accounts, truncated } = solanaAccounts(
        await ctx.solanaRpc('getProgramAccounts', solanaMarginfiParams(address)),
      );
      let incomplete = truncated;
      const findings: PositionFinding[] = [];
      const notices: string[] = [];
      for (const entry of accounts) {
        try {
          const view = solanaMarginfiAccount(entry.account, address);
          let assets = false;
          let liabilities = false;
          // LendingAccount starts at 72; 16 repr(C) Balance slots of 104 bytes.
          // active at +0, signed i128 asset shares at +40 and liabilities at +56.
          for (let i = 0; i < 16; i++) {
            const offset = 72 + i * 104;
            if (view.getUint8(offset) === 0) continue;
            const asset = marginfiShares(view, offset + 40);
            const liability = marginfiShares(view, offset + 56);
            const premium = marginfiShares(view, offset + 72);
            if (asset < 0n || liability < 0n || premium < 0n)
              throw new Error('Negative balance shares.');
            assets ||= asset > 0n;
            liabilities ||= liability > 0n || premium > 0n;
          }
          const flags = view.getBigUint64(1800, true);
          if (assets)
            findings.push({
              title: 'Asset shares recorded in a marginfi account',
              network: 'solana',
              amount: null,
              valueUsd: null,
              claimCostUsd: null,
              deadline: null,
              heldBy: entry.pubkey,
              note: `Positive asset shares were read in active balance slots. Open the official migration page for Project 0 to calculate token amounts, net equity and withdrawal availability. ${liabilities ? 'This account also has borrowing or an accrued borrowing premium; its assets are not a free withdrawal balance. ' : ''}${flags !== 0n ? 'Account state flags are set; restrictions require inspection in the app. ' : ''}No USD value or refundable rent is counted. Bank liquidity, account health, protocol restrictions and fees still apply.`,
            });
          else if (liabilities)
            notices.push(
              `${entry.pubkey}: borrowing or an accrued borrowing premium is recorded, without positive asset shares. It is not counted as recoverable funds.`,
            );
        } catch {
          incomplete = true;
        }
      }
      const partial = incomplete
        ? 'Some marginfi accounts could not be read or the 500-account limit was reached.'
        : undefined;
      if (!findings.length) {
        if (partial) return { kind: 'error', reason: [partial, ...notices].join(' ') };
        return { kind: 'nothing', ...(notices.length ? { note: notices.join(' ') } : {}) };
      }
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(partial ? { partial } : {}),
        ...(notices.length ? { notices } : {}),
      };
    } catch {
      return { kind: 'error', reason: 'marginfi accounts could not be read.' };
    }
  },
};
