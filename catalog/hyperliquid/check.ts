import {
  amountToNumber,
  isEvmAddress,
  type Check,
  type CheckContext,
  type EvmAddress,
  type Finding,
  type TokenAmount,
} from '@deficheckup/engine';

// Hyperliquid's public info API. Checked on 2026-11-01: it answers browsers from any origin
// (access-control-allow-origin: *), so it needs no proxy.
const INFO_API = 'https://api.hyperliquid.xyz/info';
const USDC_TOKEN_INDEX = 0;

/** Balances worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

/** "1019.97983005" -> 101997983005n with 8 decimals. Exact: no floating point on the way. */
export function decimalToAmount(value: string, symbol: string): TokenAmount | null {
  if (typeof value !== 'string' || typeof symbol !== 'string' || !symbol.trim()) return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const [, whole = '0', fraction = ''] = match;
  return { raw: BigInt(whole + fraction), decimals: fraction.length, symbol };
}

interface SpotMeta {
  tokens: { name: string; index: number }[];
  universe: { name: string; tokens: [number, number] }[];
}
interface AssetCtx {
  coin?: string;
  markPx?: string;
  dayNtlVlm?: string;
}

/**
 * A spot market needs this much daily volume (USD) before its price is shown. Thin markets carry
 * absurd marks: on 2026-11-01 a token with $148 of daily volume was marked at $3,715.
 */
const LIQUID_VOLUME_USD = 1_000;

interface SpotPrices {
  /** USD price per spot token index. */
  byToken: Map<number, number>;
  /** USD price of HYPE, the token named HYPE with the most liquid USDC market. */
  hype: number | null;
}

/**
 * Prices each spot token from its USDC market. The API's two lists are not in the same order
 * (on 2026-11-01, 277 of 348 positions differed), so markets are matched by name, never by index.
 */
export function spotPrices(response: unknown): SpotPrices {
  const byToken = new Map<number, number>([[USDC_TOKEN_INDEX, 1]]);
  const volumes = new Map<number, number>();
  if (!Array.isArray(response) || response.length !== 2) return { byToken, hype: null };
  const [meta, ctxs] = response as [SpotMeta, AssetCtx[]];
  if (!Array.isArray(meta?.universe) || !Array.isArray(ctxs)) return { byToken, hype: null };

  const markets = new Map(ctxs.map((ctx) => [ctx.coin, ctx]));
  for (const pair of meta.universe) {
    const [base, quote] = pair.tokens ?? [];
    const market = markets.get(pair.name);
    if (base === undefined || quote !== USDC_TOKEN_INDEX || !market) continue;
    const mark = Number(market.markPx);
    const volume = Number(market.dayNtlVlm);
    if (
      !Number.isFinite(mark) ||
      !Number.isFinite(volume) ||
      !(mark > 0) ||
      !(volume >= LIQUID_VOLUME_USD)
    )
      continue;
    if (volume > (volumes.get(base) ?? 0)) {
      byToken.set(base, mark);
      volumes.set(base, volume);
    }
  }

  let hype: number | null = null;
  let hypeVolume = 0;
  for (const token of meta.tokens ?? []) {
    const volume = volumes.get(token.index) ?? 0;
    if (token.name === 'HYPE' && volume > hypeVolume) {
      hype = byToken.get(token.index) ?? null;
      hypeVolume = volume;
    }
  }
  return { byToken, hype };
}

function finding(
  title: string,
  amount: TokenAmount,
  price: number | null,
  heldBy?: EvmAddress,
): Finding {
  return {
    title,
    network: 'hyperliquid',
    amount,
    valueUsd: price === null ? null : amountToNumber(amount) * price,
    claimCostUsd: null, // moving funds inside Hyperliquid has no gas; withdrawals are priced in the app
    deadline: null,
    ...(heldBy ? { heldBy } : {}),
  };
}

async function settle(ctx: CheckContext, body: object): Promise<unknown | undefined> {
  try {
    return await ctx.fetchJson(INFO_API, body);
  } catch {
    return undefined;
  }
}

export const hyperliquidCheck: Check = {
  id: 'hyperliquid',
  name: 'Hyperliquid (perps, spot, staking and vaults)',
  networks: ['hyperliquid'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.hyperliquid.xyz',
  deadline: null,
  // API-only check: HyperCore has no fixed EVM contracts.
  contracts: [],
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const [perps, spot, staking, vaults, spotMeta] = await Promise.all([
      settle(ctx, { type: 'clearinghouseState', user: address }),
      settle(ctx, { type: 'spotClearinghouseState', user: address }),
      settle(ctx, { type: 'delegatorSummary', user: address }),
      settle(ctx, { type: 'userVaultEquities', user: address }),
      settle(ctx, { type: 'spotMetaAndAssetCtxs' }),
    ]);
    const prices = spotPrices(spotMeta);
    const hypePrice = prices.hype;

    const findings: Finding[] = [];
    let failed = 0;

    // Perps: what can be withdrawn without touching open positions.
    const withdrawable = (perps as { withdrawable?: string } | undefined)?.withdrawable;
    const perpsAmount = withdrawable === undefined ? null : decimalToAmount(withdrawable, 'USDC');
    if (!perpsAmount) failed++;
    else if (perpsAmount.raw > 0n) {
      findings.push(
        finding('USDC withdrawable from your Hyperliquid perps account', perpsAmount, 1),
      );
    }

    // Spot: every token with a balance.
    const balances = (spot as { balances?: { coin: string; token: number; total: string }[] })
      ?.balances;
    if (!Array.isArray(balances)) failed++;
    else {
      for (const balance of balances) {
        const amount = decimalToAmount(balance.total, balance.coin);
        if (!amount) {
          failed++;
          continue;
        }
        if (amount.raw === 0n) continue;
        const price = prices.byToken.get(balance.token) ?? null;
        findings.push(finding(`${balance.coin} in your Hyperliquid spot account`, amount, price));
      }
    }

    // Staking: delegated, not delegated yet, and on its way back to spot.
    const summary = staking as
      { delegated?: string; undelegated?: string; totalPendingWithdrawal?: string } | undefined;
    if (!summary || typeof summary.delegated !== 'string') failed++;
    else {
      const parts: [string | undefined, string][] = [
        [summary.delegated, 'HYPE staked on Hyperliquid'],
        [summary.undelegated, 'HYPE in your Hyperliquid staking account, not delegated'],
        [summary.totalPendingWithdrawal, 'HYPE on its way from staking to your spot account'],
      ];
      for (const [value, title] of parts) {
        const amount = value === undefined ? null : decimalToAmount(value, 'HYPE');
        if (!amount) failed++;
        else if (amount.raw > 0n) findings.push(finding(title, amount, hypePrice));
      }
    }

    // Vaults: one finding per vault with equity.
    if (!Array.isArray(vaults)) failed++;
    else {
      for (const vault of vaults as { vaultAddress?: string; equity?: string }[]) {
        const amount = vault.equity === undefined ? null : decimalToAmount(vault.equity, 'USDC');
        if (!amount) {
          failed++;
          continue;
        }
        if (amount.raw === 0n) continue;
        const where =
          vault.vaultAddress && isEvmAddress(vault.vaultAddress) ? vault.vaultAddress : undefined;
        findings.push(finding('USDC in a Hyperliquid vault', amount, 1, where));
      }
    }

    const kept = findings.filter((f) => f.valueUsd === null || f.valueUsd >= DUST_USD);
    const [first, ...rest] = kept;
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(failed > 0 ? { partial: 'Some Hyperliquid balances could not be read.' } : {}),
      };
    }
    if (failed > 0) {
      return { kind: 'error', reason: 'Some Hyperliquid balances could not be read.' };
    }
    return { kind: 'nothing' };
  },
};
