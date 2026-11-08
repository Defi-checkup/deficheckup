import type { CheckContext } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { merklCheck } from './check';

// Recorded response shape from api.merkl.xyz/v4 (2026-11-01), placeholder values and address.
const WALLET = '0x000000000000000000000000000000000000dEaD';

function reward(symbol: string, amount: string, claimed: string, price: number | null = 1) {
  return {
    amount,
    claimed,
    pending: '0',
    token: {
      chainId: 1,
      address: '0x1111111111111111111111111111111111111111',
      decimals: 18,
      symbol,
      price,
    },
    proofs: [],
  };
}

function fakeContext(answer: unknown) {
  const fetchJson = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const gasCostUsd = vi.fn(async (network: string) => (network === 'ethereum' ? 3 : 0.01));
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
    gasCostUsd,
    fetchJson,
  };
  return { ctx, fetchJson, gasCostUsd };
}

describe('merkl check', () => {
  it('asks Merkl once for the 14 networks it serves (not Blast), with the full address', async () => {
    const { ctx, fetchJson } = fakeContext([]);

    expect(await merklCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(fetchJson).toHaveBeenCalledOnce();
    const [url] = fetchJson.mock.calls[0] as unknown as [string];
    expect(url).toMatch(
      new RegExp(`^https://api\\.merkl\\.xyz/v4/users/${WALLET}/rewards\\?chainId=`),
    );
    const ids = url.split('chainId=')[1]!.split(',');
    expect(ids).toHaveLength(14);
    expect(ids).not.toContain('81457');
  });

  it('finds what was earned and not claimed yet, on the right network', async () => {
    const { ctx, gasCostUsd } = fakeContext([
      {
        chain: { id: 1 },
        rewards: [reward('COMP', '3000000000000000000', '1000000000000000000', 25)],
      },
      { chain: { id: 42161 }, rewards: [reward('ARB', '5000000000000000000', '0', 0.5)] },
    ]);

    expect(await merklCheck.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'COMP rewards from Merkl',
          network: 'ethereum',
          amount: { raw: 2_000_000_000_000_000_000n, decimals: 18, symbol: 'COMP' },
          valueUsd: 50,
          claimCostUsd: 3,
          deadline: null,
        },
        {
          title: 'ARB rewards from Merkl',
          network: 'arbitrum',
          amount: { raw: 5_000_000_000_000_000_000n, decimals: 18, symbol: 'ARB' },
          valueUsd: 2.5,
          claimCostUsd: 0.01,
          deadline: null,
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 145_000n);
  });

  it('skips rewards already claimed, priced dust, and chains it does not support', async () => {
    const { ctx } = fakeContext([
      {
        chain: { id: 1 },
        rewards: [reward('DONE', '10', '10'), reward('DUST', '1000000000000000', '0', 1)],
      },
      { chain: { id: 146 }, rewards: [reward('S', '5000000000000000000', '0')] },
    ]);

    expect(await merklCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('keeps a reward with no price', async () => {
    for (const price of [null, Number.POSITIVE_INFINITY]) {
      const { ctx } = fakeContext([
        { chain: { id: 8453 }, rewards: [reward('NEW', '1', '0', price)] },
      ]);
      expect(await merklCheck.check(WALLET, ctx)).toMatchObject({
        kind: 'found',
        findings: [{ network: 'base', valueUsd: null }],
      });
    }
  });

  it('does not call it nothing when the API fails or a reward is unreadable', async () => {
    expect(await merklCheck.check(WALLET, fakeContext(new Error('503')).ctx)).toMatchObject({
      kind: 'error',
    });
    const broken = [
      {
        chain: { id: 1 },
        rewards: [{ amount: '1e18', claimed: '0', token: { symbol: 'X', decimals: 18 } }],
      },
    ];
    expect(await merklCheck.check(WALLET, fakeContext(broken).ctx)).toMatchObject({
      kind: 'error',
    });
  });

  it('treats a missing reward list or malformed chain as incomplete and keeps readable rewards', async () => {
    for (const broken of [{ chain: { id: 1 } }, { rewards: [] }]) {
      expect(await merklCheck.check(WALLET, fakeContext([broken]).ctx)).toMatchObject({
        kind: 'error',
      });
      expect(
        await merklCheck.check(
          WALLET,
          fakeContext([
            broken,
            { chain: { id: 1 }, rewards: [reward('OK', '1000000000000000000', '0')] },
          ]).ctx,
        ),
      ).toMatchObject({ kind: 'found', partial: expect.any(String) });
    }
    for (const patch of [
      { amount: 1 },
      { amount: '1', claimed: '2' },
      { token: { symbol: 1, decimals: 18 } },
      { token: { symbol: ' ', decimals: 18 } },
    ]) {
      const entry = { ...reward('BAD', '1', '0'), ...patch };
      expect(
        await merklCheck.check(WALLET, fakeContext([{ chain: { id: 1 }, rewards: [entry] }]).ctx),
      ).toMatchObject({ kind: 'error' });
    }
    for (const decimals of [-1, 1.5, 37]) {
      const entry = reward('BAD', '1', '0');
      entry.token.decimals = decimals;
      expect(
        await merklCheck.check(WALLET, fakeContext([{ chain: { id: 1 }, rewards: [entry] }]).ctx),
      ).toMatchObject({ kind: 'error' });
    }
  });

  it('reports an error for an invalid address, without calling the API', async () => {
    const { ctx, fetchJson } = fakeContext([]);

    expect(await merklCheck.check('merkl.eth', ctx)).toMatchObject({ kind: 'error' });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('names networks for malformed rewards and reward lists without extra requests', async () => {
    const { ctx, fetchJson } = fakeContext([
      { chain: { id: 1 }, rewards: [{ amount: 'broken' }] },
      { chain: { id: 8453 } },
      { chain: { id: 1 }, rewards: [{ amount: 'broken again' }] },
    ]);
    expect(await merklCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'error',
      failedNetworks: ['ethereum', 'base'],
    });
    expect(fetchJson).toHaveBeenCalledOnce();
    const partial = await merklCheck.check(
      WALLET,
      fakeContext([
        { chain: { id: 8453 }, rewards: [{ amount: 'broken' }] },
        { chain: { id: 1 }, rewards: [reward('OK', '1000000000000000000', '0')] },
      ]).ctx,
    );
    expect(partial).toMatchObject({ kind: 'found', failedNetworks: ['base'] });
  });

  it('omits network attribution for a failed request or any malformed entry with an unknown network', async () => {
    for (const answer of [
      new Error('503'),
      [{ chain: { id: 1 }, rewards: [{ amount: 'broken' }] }, { rewards: [] }],
    ]) {
      const outcome = await merklCheck.check(WALLET, fakeContext(answer).ctx);
      expect(outcome.kind).toBe('error');
      expect(outcome).not.toHaveProperty('failedNetworks');
    }
  });
});
