import {
  lookupPrice,
  valueAtPrice,
  isSolanaAddress,
  solanaRecord,
  SOLANA_TOKEN_PROGRAM,
  SOLANA_TOKEN_2022_PROGRAM,
  solanaTokenParams,
  type Check,
} from '@deficheckup/engine';
import { solanaAccounts, SOLANA_BASE_FEE, SOLANA_FEE_NOTE } from '../shared/solana';

// Only extensions whose closure rules were read in the official Token-2022 processor on
// 2026-11-01. Confidential balances and unknown extensions need further inspection.
const SIMPLE_EXTENSIONS = new Set([
  'immutableOwner',
  'memoTransfer',
  'cpiGuard',
  'nonTransferableAccount',
  'transferHookAccount',
  'pausableAccount',
]);

export const solanaRentCheck: Check = {
  id: 'solana-rent',
  name: 'Solana empty token account rent',
  networks: ['solana'],
  category: 'rent',
  status: { kind: 'open' },
  officialLink: 'https://solana.com/docs/tokens/basics/close-account',
  deadline: null,
  contracts: [
    { network: 'solana', address: SOLANA_TOKEN_PROGRAM },
    { network: 'solana', address: SOLANA_TOKEN_2022_PROGRAM },
  ],
  verifiedOn: '2026-11-01',
  async check(address, ctx) {
    if (!isSolanaAddress(address)) return { kind: 'error', reason: 'Not a valid Solana address.' };
    const programs = [SOLANA_TOKEN_PROGRAM, SOLANA_TOKEN_2022_PROGRAM];
    const answers = await Promise.allSettled(
      programs.map((program) =>
        ctx.solanaRpc('getTokenAccountsByOwner', solanaTokenParams(address, program)),
      ),
    );
    let raw = 0n;
    let count = 0;
    let incomplete = false;
    const notices: string[] = [];
    const seen = new Set<string>();
    for (const [index, answer] of answers.entries()) {
      if (answer.status === 'rejected') {
        incomplete = true;
        continue;
      }
      try {
        const { accounts, truncated } = solanaAccounts(answer.value);
        incomplete ||= truncated;
        for (const entry of accounts) {
          try {
            if (seen.has(entry.pubkey)) throw new Error('Duplicate account.');
            seen.add(entry.pubkey);
            if (entry.account.owner !== programs[index]) throw new Error('Wrong token program.');
            const parsed = solanaRecord(solanaRecord(entry.account.data).parsed);
            const info = solanaRecord(parsed.info);
            const tokenAmount = solanaRecord(info.tokenAmount);
            if (
              parsed.type !== 'account' ||
              info.owner !== address ||
              typeof info.mint !== 'string' ||
              !isSolanaAddress(info.mint) ||
              typeof tokenAmount.amount !== 'string' ||
              !/^[0-9]+$/.test(tokenAmount.amount) ||
              typeof info.isNative !== 'boolean' ||
              (info.state !== 'initialized' && info.state !== 'frozen') ||
              (info.closeAuthority !== undefined &&
                (typeof info.closeAuthority !== 'string' || !isSolanaAddress(info.closeAuthority)))
            )
              throw new Error('Unexpected token account.');
            if (BigInt(tokenAmount.amount) !== 0n) continue;
            if (info.closeAuthority !== undefined && info.closeAuthority !== address) {
              notices.push(
                `${entry.pubkey}: another close authority must sign. Its rent is not counted.`,
              );
              continue;
            }
            if (info.extensions !== undefined && !Array.isArray(info.extensions))
              throw new Error('Unexpected extensions.');
            let closable = true;
            const extensions = new Set<string>();
            for (const value of (info.extensions ?? []) as unknown[]) {
              const extension = solanaRecord(value);
              const name = extension.extension;
              if (typeof name !== 'string' || extensions.has(name))
                throw new Error('Unexpected extension.');
              extensions.add(name);
              if (name === 'transferFeeAmount') {
                const amount = solanaRecord(extension.state).withheldAmount;
                if (typeof amount !== 'string' || !/^[0-9]+$/.test(amount))
                  throw new Error('Unexpected withheld amount.');
                if (BigInt(amount) > 0n) {
                  closable = false;
                  notices.push(
                    `${entry.pubkey}: withheld transfer fees must be harvested before closure. Its rent is not counted.`,
                  );
                }
              } else if (!SIMPLE_EXTENSIONS.has(name)) {
                closable = false;
                incomplete = true;
                notices.push(
                  `${entry.pubkey}: an unsupported or confidential Token-2022 extension needs inspection before closure. Its rent is not counted.`,
                );
              }
            }
            if (!closable || entry.lamports === 0n) continue;
            raw += entry.lamports;
            count++;
          } catch {
            incomplete = true;
          }
        }
      } catch {
        incomplete = true;
      }
    }
    const partial =
      'Some token accounts could not be checked, need extension inspection, or exceeded the 500-account limit per token program.';
    if (count === 0) {
      if (incomplete) return { kind: 'error', reason: [partial, ...notices].join(' ') };
      return { kind: 'nothing', ...(notices.length ? { note: notices.join(' ') } : {}) };
    }
    const price = await lookupPrice(ctx, 'solana', 'native');
    const amount = { raw, decimals: 9, symbol: 'SOL' };
    return {
      kind: 'found',
      findings: [
        {
          title: `SOL rent in ${count} empty token ${count === 1 ? 'account' : 'accounts'}`,
          network: 'solana',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd:
            price.usd === null ? null : (Number(SOLANA_BASE_FEE * BigInt(count)) / 1e9) * price.usd,
          deadline: null,
          note: `Closing these accounts returns their actual lamport balances. The owner's signature is required in a wallet or tool they trust. DeFi Checkup never asks you to connect or sign. ${SOLANA_FEE_NOTE}`,
        },
      ],
      ...(incomplete ? { partial } : {}),
      ...(notices.length ? { notices } : {}),
    };
  },
};
