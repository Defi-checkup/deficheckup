import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { creamCheck } from './check';
import { CREAM_MARKETS } from './markets';

// Recorded shapes, placeholder wallet. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const CR_AAVE = CREAM_MARKETS.find((m) => m.name === 'AAVE')!.market;
const CR_ETH = CREAM_MARKETS.find((m) => m.name === 'ETH')!.market;

interface Chain {
  balances?: Record<string, bigint>;
  rates?: Record<string, bigint>;
  failBalance?: string;
  failRate?: string;
}

function fakeContext({ balances = {}, rates = {}, failBalance, failRate }: Chain) {
  const readContract = vi.fn(async ({ functionName, to }: ReadRequest) => {
    if (functionName === 'balanceOf') {
      if (to === failBalance) throw new Error('reverted');
      return balances[to] ?? 0n;
    }
    if (functionName === 'exchangeRateStored') {
      if (to === failRate) throw new Error('reverted');
      return rates[to] ?? 0n;
    }
    throw new Error(`unexpected ${functionName}`);
  });
  const ctx: CheckContext = {
    readContract,
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
    fetchJson: async () => undefined,
  };
  return { ctx, readContract };
}

// crAAVE on 2026-11-01: 997,064,981,235 crTokens of a public supplier were worth 208.372 AAVE.
const AAVE_POSITION = {
  balances: { [CR_AAVE]: 997_064_981_235n },
  rates: { [CR_AAVE]: 208_985_355_472_750_172_819_381_878n },
};

describe('cream check', () => {
  it('reports nothing without crTokens, reading every market with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await creamCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledTimes(CREAM_MARKETS.length);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        to: CREAM_MARKETS[0]!.market,
        functionName: 'balanceOf',
        args: [WALLET],
      }),
    );
  });

  it('says a supply is lost, with the amount and the Comptroller in full', async () => {
    const { ctx } = fakeContext(AAVE_POSITION);

    const outcome = await creamCheck.check(WALLET, ctx);

    expect(outcome.kind).toBe('lost');
    if (outcome.kind === 'lost') {
      expect(outcome.reason).toContain('cannot be taken out: 208.372 AAVE.');
      expect(outcome.reason).toContain('0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258');
      expect(outcome.reason).toContain('since 2021-11-01');
    }
  });

  it('lists every market with a balance', async () => {
    const { ctx } = fakeContext({
      balances: { ...AAVE_POSITION.balances, [CR_ETH]: 5_000_000_000n },
      rates: { ...AAVE_POSITION.rates, [CR_ETH]: 2n * 10n ** 26n },
    });

    const outcome = await creamCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({ kind: 'lost' });
    if (outcome.kind === 'lost')
      expect(outcome.reason).toContain('cannot be taken out: 1 ETH, 208.372 AAVE.');
  });

  it('still says lost when the exchange rate cannot be read', async () => {
    const { ctx } = fakeContext({ ...AAVE_POSITION, failRate: CR_AAVE });

    const outcome = await creamCheck.check(WALLET, ctx);

    expect(outcome.kind).toBe('lost');
    if (outcome.kind === 'lost') expect(outcome.reason).toContain('crAAVE tokens of unknown value');
  });

  it('returns an error, not nothing, when a market cannot be read', async () => {
    const { ctx } = fakeContext({ failBalance: CR_ETH });

    expect(await creamCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('says lost and warns when other markets could not be read', async () => {
    const { ctx } = fakeContext({ ...AAVE_POSITION, failBalance: CR_ETH });

    const outcome = await creamCheck.check(WALLET, ctx);

    expect(outcome.kind).toBe('lost');
    if (outcome.kind === 'lost') expect(outcome.reason).toContain('could not be read');
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await creamCheck.check('0x123', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
