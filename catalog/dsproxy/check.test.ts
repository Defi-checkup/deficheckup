import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { ETHEREUM_TOKENS } from '../shared/tokens';
import { dsproxyCheck } from './check';

// Recorded shapes, placeholder addresses. Never a real user's wallet or proxy.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const PROXY = '0x3333333333333333333333333333333333333333';
const ZERO = '0x0000000000000000000000000000000000000000';
const DAI = ETHEREUM_TOKENS.find((t) => t.symbol === 'DAI')!.address;

interface Chain {
  proxy?: string;
  owner?: string;
  balances?: Record<string, bigint>;
  failToken?: string;
}

function fakeContext({ proxy = ZERO, owner = WALLET, balances = {}, failToken }: Chain) {
  const readContract = vi.fn(async ({ functionName, to }: ReadRequest) => {
    if (functionName === 'proxies') return proxy;
    if (functionName === 'owner') return owner;
    if (functionName === 'balanceOf') {
      if (to === failToken) throw new Error('reverted');
      return balances[to] ?? 0n;
    }
    throw new Error(`unexpected ${functionName}`);
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 10_000);
  const ctx: CheckContext = {
    readContract,
    nativeBalance: async () => balances.native ?? 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy: async () => {
      throw new Error('unexpected proxy');
    },
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    priceUsd: async (_network, token) => (token === 'native' ? 3000 : 1),
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readContract, gasCostUsd };
}

describe('dsproxy check', () => {
  it('reports nothing without a proxy, asking the registry with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await dsproxyCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4',
        functionName: 'proxies',
        args: [WALLET],
      }),
    );
  });

  it('finds tokens left in the proxy, with the proxy in full', async () => {
    const { ctx, gasCostUsd } = fakeContext({
      proxy: PROXY,
      balances: { [DAI]: 12n * 10n ** 18n },
    });

    expect(await dsproxyCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'DAI in your DSProxy',
          network: 'ethereum',
          amount: { raw: 12n * 10n ** 18n, decimals: 18, symbol: 'DAI' },
          valueUsd: 12,
          claimCostUsd: 15,
          deadline: null,
          heldBy: PROXY,
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 150_000n);
  });

  it('matches the owner without caring about letter case', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      owner: WALLET.toLowerCase(),
      balances: { native: 10n ** 17n },
    });

    expect(await dsproxyCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'ETH in your DSProxy', valueUsd: 300 }],
    });
  });

  it('reports nothing when the proxy now belongs to someone else', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      owner: '0x4444444444444444444444444444444444444444',
      balances: { [DAI]: 10n ** 18n },
    });

    expect(await dsproxyCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('reports nothing for an empty proxy', async () => {
    const { ctx } = fakeContext({ proxy: PROXY });

    expect(await dsproxyCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('does not call it nothing when a balance could not be read', async () => {
    const { ctx } = fakeContext({ proxy: PROXY, failToken: DAI });

    expect(await dsproxyCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found when another balance fails, and says so', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      balances: { native: 10n ** 17n },
      failToken: DAI,
    });

    expect(await dsproxyCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some balances of your DSProxy could not be read.',
    });
  });

  it('reports an error for an invalid address, without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await dsproxyCheck.check('vitalik', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
