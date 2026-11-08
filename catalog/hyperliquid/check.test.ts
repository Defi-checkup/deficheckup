import type { CheckContext } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { decimalToAmount, hyperliquidCheck, spotPrices } from './check';

// Recorded response shapes from api.hyperliquid.xyz (2026-11-01), placeholder values and address.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const VAULT = '0x5555555555555555555555555555555555555555';

const EMPTY: Record<string, unknown> = {
  clearinghouseState: { withdrawable: '0.0' },
  spotClearinghouseState: { balances: [] },
  delegatorSummary: {
    delegated: '0.0',
    undelegated: '0.0',
    totalPendingWithdrawal: '0.0',
    nPendingWithdrawals: 0,
  },
  userVaultEquities: [],
  // Shaped like the real answer: the market list is NOT in the same order as the pairs, there is a
  // second token named HYPE, and one market (FAKE) is too thin to trust its price.
  spotMetaAndAssetCtxs: [
    {
      tokens: [
        { name: 'USDC', index: 0 },
        { name: 'PURR', index: 1 },
        { name: 'HYPE', index: 150 },
        { name: 'HYPE', index: 400 },
        { name: 'FAKE', index: 401 },
      ],
      universe: [
        { name: 'PURR/USDC', tokens: [1, 0] },
        { name: '@107', tokens: [150, 0] },
        { name: '@300', tokens: [400, 0] },
        { name: '@301', tokens: [401, 0] },
      ],
    },
    [
      { coin: '@300', markPx: '0.08', dayNtlVlm: '12.4' },
      { coin: '@301', markPx: '3715.0', dayNtlVlm: '148.6' },
      { coin: '@107', markPx: '40.0', dayNtlVlm: '38966110.6' },
      { coin: 'PURR/USDC', markPx: '0.2', dayNtlVlm: '946567.7' },
    ],
  ],
};

function fakeContext(answers: Record<string, unknown> = {}, failing: string[] = []) {
  const fetchJson = vi.fn(async (_url: string, body?: unknown) => {
    const type = (body as { type: string }).type;
    if (failing.includes(type)) throw new Error('HTTP 429');
    return { ...EMPTY, ...answers }[type];
  });
  const ctx: CheckContext = {
    readContract: async () => 0n,
    nativeBalance: async () => 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy: async () => {
      throw new Error('unexpected proxy');
    },
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    priceUsd: async () => null,
    gasCostUsd: async () => null,
    fetchJson,
  };
  return { ctx, fetchJson };
}

describe('decimalToAmount', () => {
  it('keeps every digit of a decimal string', () => {
    expect(decimalToAmount('1019.97983005', 'USDC')).toEqual({
      raw: 101_997_983_005n,
      decimals: 8,
      symbol: 'USDC',
    });
    expect(decimalToAmount('2', 'HYPE')).toEqual({ raw: 2n, decimals: 0, symbol: 'HYPE' });
  });

  it('rejects anything that is not a plain positive decimal', () => {
    expect(decimalToAmount('-1.5', 'X')).toBeNull();
    expect(decimalToAmount('1e5', 'X')).toBeNull();
  });
});

describe('spotPrices', () => {
  it('matches markets by name, trusts only liquid ones, and finds the real HYPE', () => {
    const prices = spotPrices(EMPTY.spotMetaAndAssetCtxs);

    expect(prices.byToken.get(1)).toBe(0.2);
    expect(prices.byToken.get(150)).toBe(40);
    expect(prices.byToken.has(400)).toBe(false); // the other HYPE: $12 of volume
    expect(prices.byToken.has(401)).toBe(false); // $148 of volume, marked at $3,715
    expect(prices.hype).toBe(40);
  });

  it('falls back to USDC only when the answer has an unexpected shape', () => {
    expect(spotPrices(undefined)).toEqual({ byToken: new Map([[0, 1]]), hype: null });
    for (const field of ['markPx', 'dayNtlVlm']) {
      const answer = structuredClone(EMPTY.spotMetaAndAssetCtxs) as [
        unknown,
        Record<string, string>[],
      ];
      for (const ctx of answer[1]) ctx[field] = 'Infinity';
      expect(spotPrices(answer)).toEqual({ byToken: new Map([[0, 1]]), hype: null });
    }
  });
});

describe('hyperliquid check', () => {
  it('reports nothing for an empty account, asking with the full address', async () => {
    const { ctx, fetchJson } = fakeContext();

    expect(await hyperliquidCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(fetchJson).toHaveBeenCalledWith('https://api.hyperliquid.xyz/info', {
      type: 'delegatorSummary',
      user: WALLET,
    });
  });

  it('finds funds in all four places: perps, spot, staking and vaults', async () => {
    const { ctx } = fakeContext({
      clearinghouseState: { withdrawable: '12.5' },
      spotClearinghouseState: {
        balances: [
          { coin: 'USDC', token: 0, total: '3.0' },
          { coin: 'PURR', token: 1, total: '100.0' },
        ],
      },
      delegatorSummary: {
        delegated: '2.07',
        undelegated: '0.0',
        totalPendingWithdrawal: '0.5',
        nPendingWithdrawals: 1,
      },
      userVaultEquities: [{ vaultAddress: VAULT, equity: '50.25' }],
    });

    const outcome = await hyperliquidCheck.check(WALLET, ctx);

    expect(outcome.kind).toBe('found');
    if (outcome.kind !== 'found') return;
    expect(outcome.findings.map((f) => [f.title, f.valueUsd])).toEqual([
      ['USDC withdrawable from your Hyperliquid perps account', 12.5],
      ['USDC in your Hyperliquid spot account', 3],
      ['PURR in your Hyperliquid spot account', 20],
      ['HYPE staked on Hyperliquid', expect.closeTo(82.8, 6)],
      ['HYPE on its way from staking to your spot account', 20],
      ['USDC in a Hyperliquid vault', 50.25],
    ]);
    expect(outcome.findings.every((f) => f.network === 'hyperliquid')).toBe(true);
    expect(outcome.findings.at(-1)?.heldBy).toBe(VAULT);
  });

  it('keeps a token with no known price, and drops priced dust', async () => {
    const { ctx } = fakeContext({
      spotClearinghouseState: {
        balances: [
          { coin: 'PURR', token: 1, total: '0.01' }, // $0.002
          { coin: 'FAKE', token: 401, total: '2.0' }, // thin market: no price, not $7,430
        ],
      },
    });

    expect(await hyperliquidCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'FAKE in your Hyperliquid spot account', valueUsd: null }],
    });
  });

  it('still reports what it found when another request fails', async () => {
    const { ctx } = fakeContext({ clearinghouseState: { withdrawable: '5.0' } }, [
      'userVaultEquities',
    ]);

    expect(await hyperliquidCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Hyperliquid balances could not be read.',
    });
  });

  it('does not call it nothing when a request failed', async () => {
    const { ctx } = fakeContext({}, ['delegatorSummary']);

    expect(await hyperliquidCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('does not silently discard malformed spot, staking or vault amounts', async () => {
    for (const answers of [
      { spotClearinghouseState: { balances: [{ coin: 'USDC', total: 'invalid' }] } },
      { delegatorSummary: { delegated: '0', undelegated: 'invalid', totalPendingWithdrawal: '0' } },
      { userVaultEquities: [{ vaultAddress: VAULT, equity: 'invalid' }] },
    ]) {
      expect(await hyperliquidCheck.check(WALLET, fakeContext(answers).ctx)).toMatchObject({
        kind: 'error',
      });
      expect(
        await hyperliquidCheck.check(
          WALLET,
          fakeContext({ ...answers, clearinghouseState: { withdrawable: '5' } }).ctx,
        ),
      ).toMatchObject({ kind: 'found', partial: expect.any(String) });
    }
  });

  it('reports an error for an invalid address, without calling the API', async () => {
    const { ctx, fetchJson } = fakeContext();

    expect(await hyperliquidCheck.check('0x12', ctx)).toMatchObject({ kind: 'error' });
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
