import { encodeAbiParameters } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCheckContext, type EvmReader } from './context';
import { isEvmNetwork } from './networks';

const TOKEN = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

function priceResponse(coins: Record<string, { price: number }>) {
  return new Response(JSON.stringify({ coins }));
}

function fakeReader(overrides: Partial<EvmReader> = {}): EvmReader {
  return {
    readContract: async () => 0n,
    getGasPrice: async () => 0n,
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe('createCheckContext', () => {
  it('prices native SOL with DefiLlama and sends Solana reads only to the proxy body', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).includes('coins.llama.fi')
          ? priceResponse({ 'coingecko:solana': { price: 100 } })
          : Response.json({ result: { context: { slot: 1 }, value: [] } }),
      );
    const ctx = createCheckContext({ fetchFn, proxyUrl: 'https://proxy.example' });
    expect(await ctx.priceUsd('solana', 'native')).toBe(100);
    expect(await ctx.priceUsd('solana', 'other-token')).toBeNull();
    const params = ['11111111111111111111111111111111', { programId: 'token' }];
    expect(await ctx.solanaRpc('getTokenAccountsByOwner', params)).toEqual({
      context: { slot: 1 },
      value: [],
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://coins.llama.fi/prices/current/coingecko:solana',
      expect.any(Object),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      'https://proxy.example/solana',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ method: 'getTokenAccountsByOwner', params }),
      }),
    );
  });
  it('rejects Solana reads without a proxy and malformed RPC envelopes', async () => {
    await expect(createCheckContext().solanaRpc('getAccountInfo', [])).rejects.toThrow('No proxy');
    const ctx = createCheckContext({
      proxyUrl: 'https://proxy.example',
      fetchFn: async () => Response.json({ error: 'RPC failed' }),
    });
    await expect(ctx.solanaRpc('getAccountInfo', [])).rejects.toThrow('Unexpected');
  });
  it('rejects negative and overflowing upstream prices, while preserving zero', async () => {
    for (const [raw, expected] of [
      ['-1', null],
      ['1e400', null],
      ['0', 0],
    ] as const) {
      const ctx = createCheckContext({
        fetchFn: async () => new Response(`{"coins":{"ethereum:${TOKEN}":{"price":${raw}}}}`),
      });
      expect(await ctx.priceUsd('ethereum', TOKEN)).toBe(expected);
    }
  });
  it('sends reads to the reader of the requested network', async () => {
    const readContract = vi.fn(async () => 42n);
    const ctx = createCheckContext({ readers: { gnosis: fakeReader({ readContract }) } });

    const result = await ctx.readContract({
      network: 'gnosis',
      to: TOKEN,
      abi: [],
      functionName: 'balanceOf',
      args: ['0x000000000000000000000000000000000000dEaD'],
    });

    expect(result).toBe(42n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: TOKEN, functionName: 'balanceOf' }),
    );
  });

  it('reads native balances through the Multicall3 of each network', async () => {
    const readContract = vi.fn(async () => 5n);
    const ctx = createCheckContext({
      readers: { ethereum: fakeReader({ readContract }), zksync: fakeReader({ readContract }) },
    });
    const wallet = '0x000000000000000000000000000000000000dEaD';

    expect(await ctx.nativeBalance('ethereum', wallet)).toBe(5n);
    expect(await ctx.nativeBalance('zksync', wallet)).toBe(5n);
    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: '0xca11bde05977b3631167028862be2a173976ca11',
        functionName: 'getEthBalance',
        args: [wallet],
      }),
    );
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ address: '0xF9cda624FBC7e059355ce98a31693d299FACd963' }),
    );
  });

  it('rejects a native balance that is not a number, instead of reporting zero', async () => {
    const ctx = createCheckContext({
      readers: { base: fakeReader({ readContract: async () => '0x' }) },
    });

    await expect(
      ctx.nativeBalance('base', '0x000000000000000000000000000000000000dEaD'),
    ).rejects.toThrow('Unexpected response from Multicall3.');
  });

  it('calls a function by its selector through Multicall3 and decodes the outputs', async () => {
    const wallet = '0x000000000000000000000000000000000000dEaD';
    const returnData = encodeAbiParameters([{ type: 'uint256[]' }], [[7n, 8n]]);
    const readContract = vi.fn(async () => [{ success: true, returnData }]);
    const ctx = createCheckContext({ readers: { zksync: fakeReader({ readContract }) } });

    const result = await ctx.readSelector({
      network: 'zksync',
      to: TOKEN,
      selector: '0x64c73e00',
      inputs: [{ type: 'address' }],
      args: [wallet],
      outputs: [{ type: 'uint256[]' }],
    });

    expect(result).toEqual([[7n, 8n]]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xF9cda624FBC7e059355ce98a31693d299FACd963',
        functionName: 'tryAggregate',
        args: [
          true,
          [
            {
              target: TOKEN,
              callData: `0x64c73e00${wallet.slice(2).toLowerCase().padStart(64, '0')}`,
            },
          ],
        ],
      }),
    );
  });

  it('rejects a selector that is not 4 bytes and an empty answer', async () => {
    const ctx = createCheckContext({
      readers: { zksync: fakeReader({ readContract: async () => [{ returnData: '0x' }] }) },
    });
    const request = {
      network: 'zksync' as const,
      to: TOKEN as `0x${string}`,
      inputs: [],
      args: [],
      outputs: [{ type: 'uint256' }],
    };

    await expect(ctx.readSelector({ ...request, selector: '0x64c7' })).rejects.toThrow(
      'Not a 4-byte selector',
    );
    await expect(ctx.readSelector({ ...request, selector: '0x64c73e00' })).rejects.toThrow(
      'Unexpected response from Multicall3.',
    );
  });

  it('posts to the proxy route with the address in the body, never in the URL', async () => {
    const fetchFn = vi.fn(async () => Response.json({ tokens: [] }));
    const ctx = createCheckContext({ fetchFn, proxyUrl: 'https://proxy.example' });
    const body = { address: '0x000000000000000000000000000000000000dEaD' };

    expect(await ctx.proxy('zksync-lite', body)).toEqual({ tokens: [] });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://proxy.example/zksync-lite',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('rejects a proxy call when no proxy is configured', async () => {
    const fetchFn = vi.fn();
    const ctx = createCheckContext({ fetchFn });

    await expect(ctx.proxy('safe', {})).rejects.toThrow('No proxy configured.');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('asks DefiLlama with the network prefix, and only once per token', async () => {
    const fetchFn = vi.fn(async () => priceResponse({ [`ethereum:${TOKEN}`]: { price: 7.5 } }));
    const ctx = createCheckContext({ fetchFn });

    expect(await ctx.priceUsd('ethereum', TOKEN)).toBe(7.5);
    expect(await ctx.priceUsd('ethereum', TOKEN)).toBe(7.5);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(
      `https://coins.llama.fi/prices/current/ethereum:${TOKEN}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns null, never throws, when the price is missing or the request fails', async () => {
    const empty = createCheckContext({ fetchFn: async () => priceResponse({}) });
    const down = createCheckContext({
      fetchFn: async () => {
        throw new Error('offline');
      },
    });

    expect(await empty.priceUsd('ethereum', TOKEN)).toBeNull();
    expect(await down.priceUsd('ethereum', TOKEN)).toBeNull();
    expect(await empty.priceUsd('solana', 'anything')).toBeNull();
  });

  it('prices gas with the gas price and the native token', async () => {
    const ctx = createCheckContext({
      readers: { ethereum: fakeReader({ getGasPrice: async () => 10_000_000_000n }) }, // 10 gwei
      fetchFn: async () => priceResponse({ 'coingecko:ethereum': { price: 2000 } }),
    });

    // 100,000 gas x 10 gwei = 0.001 ETH = 2 USD
    expect(await ctx.gasCostUsd('ethereum', 100_000n)).toBeCloseTo(2, 10);
  });

  it('posts JSON to a public API and rejects an answer that is not 2xx', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 })))
      .mockResolvedValueOnce(new Response('busy', { status: 503 }));
    const ctx = createCheckContext({ fetchFn });

    expect(await ctx.fetchJson('https://api.example/info', { type: 'x' })).toEqual({ ok: 1 });
    const [, init] = fetchFn.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST', body: '{"type":"x"}' });
    await expect(ctx.fetchJson('https://api.example/info')).rejects.toThrow('503');
  });

  it('waits and tries once more when a public API rate-limits', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 })));
    const ctx = createCheckContext({ fetchFn });

    expect(await ctx.fetchJson('https://api.example/info', { type: 'x' })).toEqual({ ok: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('sends the same API request once per scan, and retries one that failed', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async () => new Response(JSON.stringify([1])));
    const ctx = createCheckContext({ fetchFn });

    await expect(ctx.fetchJson('https://api.example/info', { type: 'meta' })).rejects.toThrow();
    await Promise.all([
      ctx.fetchJson('https://api.example/info', { type: 'meta' }),
      ctx.fetchJson('https://api.example/info', { type: 'meta' }),
    ]);
    await ctx.fetchJson('https://api.example/info', { type: 'other' });

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('treats Hyperliquid as an API network: no RPC reader, no price, no gas', async () => {
    const ctx = createCheckContext();

    expect(isEvmNetwork('hyperliquid')).toBe(false);
    expect(isEvmNetwork('ethereum')).toBe(true);
    expect(await ctx.priceUsd('hyperliquid', 'native')).toBeNull();
    expect(await ctx.gasCostUsd('hyperliquid', 1n)).toBeNull();
  });

  it('asks for the gas price once per network, however many findings need it', async () => {
    const getGasPrice = vi.fn(async () => 10_000_000_000n);
    const ctx = createCheckContext({
      readers: { ethereum: fakeReader({ getGasPrice }) },
      fetchFn: async () => priceResponse({ 'coingecko:ethereum': { price: 2000 } }),
    });

    const costs = await Promise.all([
      ctx.gasCostUsd('ethereum', 100_000n),
      ctx.gasCostUsd('ethereum', 200_000n),
      ctx.gasCostUsd('ethereum', 70_000n),
    ]);

    expect(costs[1]).toBeCloseTo(4, 10);
    expect(getGasPrice).toHaveBeenCalledOnce();
  });

  it('asks again after a failed gas price, instead of keeping the failure', async () => {
    const getGasPrice = vi
      .fn<() => Promise<bigint>>()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue(10_000_000_000n);
    const ctx = createCheckContext({
      readers: { ethereum: fakeReader({ getGasPrice }) },
      fetchFn: async () => priceResponse({ 'coingecko:ethereum': { price: 2000 } }),
    });

    expect(await ctx.gasCostUsd('ethereum', 100_000n)).toBeNull();
    expect(await ctx.gasCostUsd('ethereum', 100_000n)).toBeCloseTo(2, 10);
    expect(getGasPrice).toHaveBeenCalledTimes(2);
  });

  it('returns null gas cost when the native price is unknown', async () => {
    const ctx = createCheckContext({
      readers: { ethereum: fakeReader({ getGasPrice: async () => 1n }) },
      fetchFn: async () => priceResponse({}),
    });

    expect(await ctx.gasCostUsd('ethereum', 100_000n)).toBeNull();
  });

  it('returns null gas cost, without throwing, when the gas price request fails', async () => {
    const ctx = createCheckContext({
      readers: {
        ethereum: fakeReader({
          getGasPrice: async () => {
            throw new Error('RPC down');
          },
        }),
      },
      fetchFn: async () => priceResponse({ 'coingecko:ethereum': { price: 2000 } }),
    });

    expect(await ctx.gasCostUsd('ethereum', 100_000n)).toBeNull();
  });

  it('gives up on a claim cost that takes too long, so a finding never times out', async () => {
    const ctx = createCheckContext({
      readers: { ethereum: fakeReader({ getGasPrice: () => new Promise(() => {}) }) },
      fetchFn: async () => priceResponse({ 'coingecko:ethereum': { price: 2000 } }),
      estimateTimeoutMs: 20,
    });

    expect(await ctx.gasCostUsd('ethereum', 100_000n)).toBeNull();
  });

  it('gives up on a price that takes too long', async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const ctx = createCheckContext({ fetchFn: hanging, estimateTimeoutMs: 20 });

    expect(await ctx.priceUsd('ethereum', TOKEN)).toBeNull();
  });

  it('retries once after a short delay and shares the result across concurrent and later callers', async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async () => priceResponse({ [`ethereum:${TOKEN}`]: { price: 7.5 } }));
    const ctx = createCheckContext({ fetchFn });
    const pending = Promise.all([
      ctx.priceUsd('ethereum', TOKEN),
      ctx.lookupPrice!('ethereum', TOKEN),
    ]);
    await vi.advanceTimersByTimeAsync(199);
    expect(fetchFn).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual([7.5, { status: 'known', usd: 7.5 }]);
    expect(await ctx.priceUsd('ethereum', TOKEN)).toBe(7.5);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps a valid missing-token response unknown and never retries it', async () => {
    const fetchFn = vi.fn(async () => priceResponse({}));
    const ctx = createCheckContext({ fetchFn });
    expect(await ctx.lookupPrice!('ethereum', TOKEN)).toEqual({ status: 'unknown', usd: null });
    expect(await ctx.priceUsd('ethereum', TOKEN)).toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it.each<[string, () => Promise<Response>]>([
    ['network error', () => Promise.reject(new Error('offline'))],
    ['HTTP 503', async () => new Response('busy', { status: 503 })],
    ['HTTP 204', async () => new Response(null, { status: 204 })],
    ['invalid JSON', async () => new Response('{')],
    ...[
      null,
      {},
      [],
      { coins: null },
      { coins: [] },
      { coins: { [`ethereum:${TOKEN}`]: {} } },
      { coins: { [`ethereum:${TOKEN}`]: { price: '7' } } },
      { coins: { [`ethereum:${TOKEN}`]: { price: -1 } } },
    ].map((body): [string, () => Promise<Response>] => [
      JSON.stringify(body),
      async () => Response.json(body),
    ]),
  ])(
    'marks %s unavailable after exactly two attempts, retaining null for old consumers',
    async (_label, send) => {
      vi.useFakeTimers();
      const fetchFn = vi.fn<typeof fetch>(send);
      const ctx = createCheckContext({ fetchFn });
      const pending = ctx.lookupPrice!('ethereum', TOKEN);
      await vi.runAllTimersAsync();
      expect(await pending).toEqual({ status: 'unavailable', usd: null });
      expect(await ctx.priceUsd('ethereum', TOKEN)).toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(2);
      // A new scan gets a new cache and can recover without any stored wallet state.
      const recovered = createCheckContext({
        fetchFn: async () => priceResponse({ [`ethereum:${TOKEN}`]: { price: 1 } }),
      });
      expect(await recovered.lookupPrice!('ethereum', TOKEN)).toEqual({ status: 'known', usd: 1 });
    },
  );

  it.each(['request', 'body'])(
    'bounds both attempts when the %s hangs, even if abort is ignored',
    async (stage) => {
      vi.useFakeTimers();
      const signals: AbortSignal[] = [];
      const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
        signals.push(init!.signal!);
        if (stage === 'request') return new Promise(() => {});
        return { status: 200, json: () => new Promise(() => {}) } as Response;
      });
      const ctx = createCheckContext({ fetchFn });
      const pending = ctx.lookupPrice!('ethereum', TOKEN);
      await vi.advanceTimersByTimeAsync(2000);
      expect(await pending).toEqual({ status: 'unavailable', usd: null });
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
    },
  );

  it('can recover from a timed-out first attempt within the original estimate budget', async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementation(async () => priceResponse({ [`ethereum:${TOKEN}`]: { price: 2 } }));
    const ctx = createCheckContext({ fetchFn });
    const pending = ctx.lookupPrice!('ethereum', TOKEN);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await pending).toEqual({ status: 'known', usd: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
