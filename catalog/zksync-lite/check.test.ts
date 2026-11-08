import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { zksyncLiteCheck } from './check';

// Placeholder wallet and the shape of the proxy's answer (recorded on 2026-11-01).
const WALLET = '0x000000000000000000000000000000000000dEaD';
const DISTRIBUTOR = '0x0a14B696350546110a0D8acDb86226983af9D2a0';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const NATIVE = '0x0000000000000000000000000000000000000000';

const ETH_TOKEN = {
  claimIndex: 139,
  tokenAddress: NATIVE,
  symbol: 'ETH',
  decimals: 18,
  rawBalance: '50000000000000000',
};
const DAI_TOKEN = {
  claimIndex: 439,
  tokenAddress: DAI,
  symbol: 'DAI',
  decimals: 18,
  rawBalance: '25000000000000000000',
};

interface Chain {
  tokens?: unknown;
  claimed?: number[];
  paused?: boolean;
  held?: bigint;
  failProxy?: boolean;
  failIndex?: number;
  failHeld?: boolean;
}

function fakeContext({
  tokens = [ETH_TOKEN, DAI_TOKEN],
  claimed = [],
  paused = false,
  held = 10n ** 24n,
  failProxy,
  failIndex,
  failHeld,
}: Chain) {
  const proxy = vi.fn(async () => {
    if (failProxy) throw new Error('down');
    return { tokens };
  });
  const readContract = vi.fn(async ({ functionName, args }: ReadRequest) => {
    if (functionName === 'paused') return paused;
    if (functionName === 'isClaimed') {
      const index = Number(args![0]);
      if (index === failIndex) throw new Error('reverted');
      return claimed.includes(index);
    }
    if (functionName === 'balanceOf') {
      if (failHeld) throw new Error('reverted');
      return held;
    }
    throw new Error(`unexpected ${functionName}`);
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 100_000);
  const ctx: CheckContext = {
    readContract,
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    nativeBalance: async () => {
      if (failHeld) throw new Error('reverted');
      return held;
    },
    priceUsd: async (_network, token) => (token === 'native' ? 2000 : 1),
    gasCostUsd,
    fetchJson: async () => {
      throw new Error('unexpected fetchJson');
    },
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy,
  };
  return { ctx, proxy, readContract, gasCostUsd };
}

describe('zksync-lite check', () => {
  it('asks the proxy with the full address and reports nothing without balances', async () => {
    const { ctx, proxy, readContract } = fakeContext({ tokens: [] });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(proxy).toHaveBeenCalledWith('zksync-lite', { address: WALLET });
    expect(readContract).not.toHaveBeenCalled();
  });

  it('finds every token not claimed yet, one claim each', async () => {
    const { ctx, gasCostUsd } = fakeContext({});

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'ETH left on zkSync Lite',
          network: 'ethereum',
          amount: { raw: 50_000_000_000_000_000n, decimals: 18, symbol: 'ETH' },
          valueUsd: 100,
          claimCostUsd: 1.22642,
          deadline: null,
          heldBy: DISTRIBUTOR,
          note: 'Each token is its own claim. Anyone can send it, and the funds always go to your address.',
        },
        {
          title: 'DAI left on zkSync Lite',
          network: 'ethereum',
          amount: { raw: 25n * 10n ** 18n, decimals: 18, symbol: 'DAI' },
          valueUsd: 25,
          claimCostUsd: 1.22642,
          deadline: null,
          heldBy: DISTRIBUTOR,
          note: 'Each token is its own claim. Anyone can send it, and the funds always go to your address.',
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 122_642n);
  });

  it('says already claimed when every balance was paid', async () => {
    const { ctx } = fakeContext({ claimed: [139, 439] });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toEqual({
      kind: 'nothing',
      alreadyClaimed: true,
    });
  });

  it('drops priced dust', async () => {
    const { ctx } = fakeContext({ tokens: [{ ...DAI_TOKEN, rawBalance: '1000' }] });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('warns when claims are paused', async () => {
    const { ctx } = fakeContext({ paused: true, tokens: [DAI_TOKEN] });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ note: expect.stringContaining('paused') as string }],
    });
  });

  it('reports a balance the contract cannot cover as lost, not found', async () => {
    const { ctx } = fakeContext({ tokens: [DAI_TOKEN], held: 10n ** 18n });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toMatchObject({ kind: 'lost' });
  });

  it('returns an error, not nothing, when the list or the contract cannot be read', async () => {
    expect(await zksyncLiteCheck.check(WALLET, fakeContext({ failProxy: true }).ctx)).toMatchObject(
      { kind: 'error' },
    );
    expect(
      await zksyncLiteCheck.check(WALLET, fakeContext({ tokens: [{ claimIndex: 'x' }] }).ctx),
    ).toMatchObject({ kind: 'error' });
    expect(
      await zksyncLiteCheck.check(WALLET, fakeContext({ tokens: [DAI_TOKEN], failIndex: 439 }).ctx),
    ).toMatchObject({ kind: 'error' });
  });

  it('reports an unreadable contract balance as an error, even for dust', async () => {
    const { ctx } = fakeContext({ tokens: [{ ...DAI_TOKEN, rawBalance: '1000' }], failHeld: true });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found and says when some balances could not be checked', async () => {
    const { ctx } = fakeContext({ failIndex: 439 });

    expect(await zksyncLiteCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { symbol: 'ETH' } }],
      partial: 'Some zkSync Lite balances could not be checked.',
    });
  });

  it('rejects an invalid address without asking anyone', async () => {
    const { ctx, proxy } = fakeContext({});

    expect(await zksyncLiteCheck.check('0xnope', ctx)).toMatchObject({ kind: 'error' });
    expect(proxy).not.toHaveBeenCalled();
  });
});
