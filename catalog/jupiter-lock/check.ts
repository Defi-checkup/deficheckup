import {
  isSolanaAddress,
  solanaRecord,
  solanaTokenParams,
  solanaJupiterLockParams,
  solanaJupiterLockAccount,
  SOLANA_JUPITER_LOCK_PROGRAM,
  SOLANA_TOKEN_PROGRAM,
  SOLANA_TOKEN_2022_PROGRAM,
  JUPITER_LOCK_READ_CAP,
  type Check,
  type PositionFinding,
} from '@deficheckup/engine';
import { solanaAccounts } from '../shared/solana';

export const jupiterLockCheck: Check = {
  id: 'jupiter-lock',
  name: 'Jupiter Lock recipient escrows',
  networks: ['solana'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://lock.jup.ag/',
  verifiedOn: '2026-11-02',
  deadline: null,
  contracts: [
    { network: 'solana', address: SOLANA_JUPITER_LOCK_PROGRAM },
    { network: 'solana', address: SOLANA_TOKEN_PROGRAM },
    { network: 'solana', address: SOLANA_TOKEN_2022_PROGRAM },
  ],
  async check(address, ctx) {
    if (!isSolanaAddress(address)) return { kind: 'error', reason: 'Not a valid Solana address.' };
    try {
      const { accounts, truncated } = solanaAccounts(
        await ctx.solanaRpc('getProgramAccounts', solanaJupiterLockParams(address)),
      );
      let incomplete = truncated;
      const escrows: { pubkey: string; state: ReturnType<typeof solanaJupiterLockAccount> }[] = [];
      for (const entry of accounts) {
        try {
          const state = solanaJupiterLockAccount(entry.account, address);
          if (state.unclaimed > 0n) escrows.push({ pubkey: entry.pubkey, state });
        } catch {
          incomplete = true;
        }
      }
      incomplete ||= escrows.length > JUPITER_LOCK_READ_CAP;
      // Each escrow uses one existing owner-filtered token read. Start all five at once;
      // the proxy still makes exactly one outbound request for each route call.
      const inspected = await Promise.all(
        escrows.slice(0, JUPITER_LOCK_READ_CAP).map(async (escrow) => {
          try {
            const program = escrow.state.token2022
              ? SOLANA_TOKEN_2022_PROGRAM
              : SOLANA_TOKEN_PROGRAM;
            const tokens = solanaAccounts(
              await ctx.solanaRpc(
                'getTokenAccountsByOwner',
                solanaTokenParams(escrow.pubkey, program),
              ),
            );
            let funded = false;
            let restricted = false;
            for (const token of tokens.accounts) {
              if (token.account.owner !== program) throw new Error('Wrong token program.');
              const parsed = solanaRecord(solanaRecord(token.account.data).parsed);
              const info = solanaRecord(parsed.info);
              const amount = solanaRecord(info.tokenAmount).amount;
              if (
                parsed.type !== 'account' ||
                info.owner !== escrow.pubkey ||
                typeof info.mint !== 'string' ||
                !isSolanaAddress(info.mint) ||
                typeof amount !== 'string' ||
                !/^[0-9]+$/.test(amount) ||
                BigInt(amount) > (1n << 64n) - 1n ||
                (info.state !== 'initialized' && info.state !== 'frozen')
              )
                throw new Error('Unexpected escrow token account.');
              if (info.mint === escrow.state.mint && BigInt(amount) > 0n) {
                funded = true;
                restricted ||= info.state === 'frozen';
              }
            }
            return { escrow, funded, restricted, incomplete: tokens.truncated };
          } catch {
            return { escrow, funded: false, restricted: false, incomplete: true };
          }
        }),
      );
      const findings: PositionFinding[] = [];
      for (const result of inspected) {
        incomplete ||= result.incomplete;
        if (!result.funded) continue;
        findings.push({
          title: 'Funded Jupiter Lock escrow naming you as recipient',
          network: 'solana',
          amount: null,
          valueUsd: null,
          claimCostUsd: null,
          deadline: null,
          heldBy: result.escrow.pubkey,
          note: `Mint: ${result.escrow.state.mint}. The escrow records an unclaimed allocation and holds tokens of that mint. Open Jupiter Lock to check the vesting schedule and the amount you can claim now. ${result.escrow.state.cancelled ? 'This escrow records a cancellation; the remaining recipient entitlement requires review in the app. ' : ''}${result.restricted ? 'A matching token account is frozen. ' : ''}${result.escrow.state.token2022 ? 'Token-2022 transfer fees, hooks or other restrictions may apply. ' : ''}Locked allocations, cancellation rules, token restrictions and fees can affect recovery. No withdrawable token amount, USD value or refundable rent is counted. Unsolicited escrows can contain spam tokens.`,
        });
      }
      const partial = incomplete
        ? 'Some Jupiter Lock escrows or token balances could not be checked. Limits are 500 recipient accounts and five token lookups for unclaimed allocations.'
        : undefined;
      if (!findings.length)
        return partial ? { kind: 'error', reason: partial } : { kind: 'nothing' };
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(partial ? { partial } : {}),
      };
    } catch {
      return { kind: 'error', reason: 'Jupiter Lock recipient escrows could not be read.' };
    }
  },
};
