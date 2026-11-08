import {
  isSolanaAddress,
  solanaRecord,
  solanaKaminoStrategiesParams,
  solanaKaminoStrategy,
  solanaTokenParams,
  SOLANA_KAMINO_LIQUIDITY_PROGRAM,
  SOLANA_TOKEN_PROGRAM,
  KAMINO_STRATEGY_CAP,
  type Check,
  type Finding,
} from '@deficheckup/engine';
import { solanaAccounts } from '../shared/solana';

export const kaminoLiquidityCheck: Check = {
  id: 'kamino-liquidity',
  name: 'Kamino liquidity strategy shares',
  networks: ['solana'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.kamino.finance',
  deadline: null,
  contracts: [
    { network: 'solana', address: SOLANA_KAMINO_LIQUIDITY_PROGRAM },
    { network: 'solana', address: SOLANA_TOKEN_PROGRAM },
  ],
  verifiedOn: '2026-11-02',
  async check(address, ctx) {
    if (!isSolanaAddress(address)) return { kind: 'error', reason: 'Not a valid Solana address.' };
    try {
      // Match the official SDK's SPL Token share accounts. No LIVE-only strategy filter: old
      // strategies can also hold overlooked shares. This does not cover farms or lending.
      const [registryAnswer, tokensAnswer] = await Promise.all([
        ctx.solanaRpc('getProgramAccounts', solanaKaminoStrategiesParams()),
        ctx.solanaRpc('getTokenAccountsByOwner', solanaTokenParams(address, SOLANA_TOKEN_PROGRAM)),
      ]);
      const registry = solanaRecord(registryAnswer);
      const slot = solanaRecord(registry.context).slot;
      if (
        !Number.isSafeInteger(slot) ||
        (slot as number) < 0 ||
        !Array.isArray(registry.value) ||
        (registry.truncated !== undefined && typeof registry.truncated !== 'boolean')
      )
        throw new Error('Unexpected strategy registry.');
      const { accounts, truncated } = solanaAccounts(tokensAnswer);
      let incomplete =
        truncated || registry.truncated === true || registry.value.length > KAMINO_STRATEGY_CAP;
      const strategies = new Map<string, ReturnType<typeof solanaKaminoStrategy>>();
      const seen = new Set<string>();
      for (const value of registry.value.slice(0, KAMINO_STRATEGY_CAP)) {
        const strategy = solanaKaminoStrategy(value);
        if (strategies.has(strategy.mint) || seen.has(strategy.strategy))
          throw new Error('Duplicate strategy.');
        strategies.set(strategy.mint, strategy);
        seen.add(strategy.strategy);
      }
      const findings: Finding[] = [];
      for (const entry of accounts) {
        try {
          if (entry.account.owner !== SOLANA_TOKEN_PROGRAM) throw new Error('Wrong token program.');
          const parsed = solanaRecord(solanaRecord(entry.account.data).parsed);
          const info = solanaRecord(parsed.info);
          const amount = solanaRecord(info.tokenAmount).amount;
          if (
            parsed.type !== 'account' ||
            info.owner !== address ||
            typeof info.mint !== 'string' ||
            !isSolanaAddress(info.mint) ||
            typeof amount !== 'string' ||
            !/^[0-9]+$/.test(amount) ||
            BigInt(amount) > (1n << 64n) - 1n ||
            (info.state !== 'initialized' && info.state !== 'frozen')
          )
            throw new Error('Unexpected share account.');
          const strategy = strategies.get(info.mint);
          if (!strategy || BigInt(amount) === 0n) continue;
          findings.push({
            title: 'Kamino liquidity strategy shares in a token account',
            network: 'solana',
            amount: { raw: BigInt(amount), decimals: strategy.decimals, symbol: 'Kamino shares' },
            valueUsd: null,
            claimCostUsd: null,
            deadline: null,
            heldBy: entry.pubkey,
            note: `Share mint: ${strategy.mint}. Strategy: ${strategy.strategy}. These are receipt tokens, not their underlying asset amounts. Open Kamino to calculate their value and check strategy status, withdrawal restrictions and fees. ${info.state === 'frozen' ? 'This token account is frozen; do not assume its shares can be redeemed. ' : ''}Staked shares and lending positions are outside this check.`,
          });
        } catch {
          incomplete = true;
        }
      }
      const partial = incomplete
        ? 'Some Kamino shares could not be checked, or the 500-token-account or 6000-strategy limit was reached.'
        : undefined;
      if (!findings.length)
        return partial ? { kind: 'error', reason: partial } : { kind: 'nothing' };
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(partial ? { partial } : {}),
      };
    } catch {
      return {
        kind: 'error',
        reason: 'Kamino strategy registry or token accounts could not be read.',
      };
    }
  },
};
