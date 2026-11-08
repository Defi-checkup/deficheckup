import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCheckContext,
  SAFE_CHECK_BUDGET_MS,
  SAFE_REQUESTS_PER_SECOND,
  SAFE_REQUEST_SPACING_MS,
  SAFE_PROXY_BUDGET_MS,
} from '@deficheckup/engine';
import { safeOwnerCheck } from '../../catalog/safe-owner/check';
import { createApp, SAFE_SERVICES, type ProxyEnv } from './app';
import { routeBindings, passHeaders } from './rate-limit.test-helpers';

// Placeholder address and recorded answer shapes (lite.zksync.io, api.safe.global, 2026-11-01).
const ADDRESS = '0x000000000000000000000000000000000000dEaD';
const ORIGIN = 'https://deficheckup.com';

const LITE_ANSWER = {
  address: ADDRESS.toLowerCase(),
  tokens: [
    {
      claimIndex: 139,
      tokenAddress: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      displayBalance: '0.01',
      rawBalance: '11903367992254200',
      decimals: 18,
    },
  ],
};

/** A cache that behaves like caches.default: keyed by URL. */
function memoryCache() {
  const store = new Map<string, Response>();
  return {
    store,
    cache: {
      match: async (request: Request) => store.get(request.url)?.clone(),
      put: async (request: Request, response: Response) => {
        store.set(request.url, response);
      },
    } as unknown as Cache,
  };
}

function setup({
  answer = (): Response => Response.json(LITE_ANSWER),
  allowed = true,
  key,
}: { answer?: () => Response; allowed?: boolean; key?: string } = {}) {
  const fetchFn = vi.fn(async () => answer());
  const { cache, store } = memoryCache();
  const app = createApp({ fetchFn: fetchFn as unknown as typeof fetch, cache });
  const limit = vi.fn(async () => ({ success: allowed }));
  const env: ProxyEnv = {
    ALLOWED_ORIGINS: `${ORIGIN}, https://www.deficheckup.com`,
    LIMITER: { limit },
    ...routeBindings(),
    ...(key ? { SAFE_API_KEY: key } : {}),
  };
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => undefined,
    props: {},
  };
  async function post(path: string, body: unknown, origin: string | null = ORIGIN) {
    const response = await app.request(
      path,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.7',
          ...(await passHeaders()),
          ...(origin ? { origin } : {}),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      env,
      executionCtx,
    );
    await Promise.all(pending.splice(0));
    return response;
  }
  return { post, fetchFn, limit, store, app, env, executionCtx };
}

describe('proxy: access', () => {
  it('rejects other origins and requests without one', async () => {
    const { post, fetchFn } = setup();

    expect((await post('/zksync-lite', { address: ADDRESS }, 'https://evil.example')).status).toBe(
      403,
    );
    expect((await post('/zksync-lite', { address: ADDRESS }, null)).status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers the CORS preflight of our site', async () => {
    const { app, env, executionCtx } = setup();

    const response = await app.request(
      '/zksync-lite',
      { method: 'OPTIONS', headers: { origin: ORIGIN } },
      env,
      executionCtx,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('rate limits by IP, before reaching the upstream API', async () => {
    const { post, fetchFn, limit, env } = setup({ allowed: false });

    expect((await post('/zksync-lite', { address: ADDRESS })).status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(env.ZKSYNC_LITE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it.each([
    ['/safe', 'SAFE_LIMITER'],
    ['/solana', 'SOLANA_LIMITER'],
    ['/zksync-lite', 'ZKSYNC_LITE_LIMITER'],
  ] as const)('enforces %s separately, before provider calls', async (path, name) => {
    const { post, fetchFn, env } = setup();
    vi.mocked(env[name].limit).mockResolvedValue({ success: false });
    const response = await post(path, { address: ADDRESS });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Too many requests. Try again in a minute.' });
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(env.LIMITER.limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(env[name].limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    for (const other of ['SAFE_LIMITER', 'SOLANA_LIMITER', 'ZKSYNC_LITE_LIMITER'] as const)
      if (other !== name) expect(env[other].limit).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
    // Exhausting this route does not exhaust another route's binding.
    expect((await post(path === '/safe' ? '/solana' : '/safe', {})).status).toBe(400);
  });

  it('rejects unknown routes, bad JSON, oversized bodies and invalid addresses', async () => {
    const { post, fetchFn } = setup();

    expect((await post('/other', { address: ADDRESS })).status).toBe(404);
    expect((await post('/zksync-lite', 'not json')).status).toBe(400);
    expect((await post('/zksync-lite', { address: ADDRESS, pad: 'x'.repeat(2_000) })).status).toBe(
      400,
    );
    // Counted in bytes, not characters: 400 three-byte characters are 1,200 bytes.
    expect(
      (await post('/zksync-lite', { address: ADDRESS, pad: '\u6f22'.repeat(400) })).status,
    ).toBe(400);
    expect((await post('/zksync-lite', { address: '0x1234' })).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('proxy: /zksync-lite', () => {
  it('asks the eligibility API once, returns only the tokens, and caches by a hash', async () => {
    const { post, fetchFn, store } = setup();

    const response = await post('/zksync-lite', { address: ADDRESS });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(await response.json()).toEqual({
      tokens: [
        {
          claimIndex: 139,
          tokenAddress: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18,
          rawBalance: '11903367992254200',
        },
      ],
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://lite.zksync.io/api/eligibility',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ address: ADDRESS }) }),
    );
    const [key] = [...store.keys()];
    expect(key).toMatch(/^https:\/\/cache\.deficheckup\.internal\/zksync-lite\/[0-9a-f]{64}$/);
    expect(key!.toLowerCase()).not.toContain(ADDRESS.slice(2).toLowerCase());

    expect((await post('/zksync-lite', { address: ADDRESS })).status).toBe(200);
    expect(fetchFn).toHaveBeenCalledOnce();
    const hit = await post('/zksync-lite', { address: ADDRESS }, 'https://www.deficheckup.com');
    expect(hit.headers.get('cache-control')).toBe('no-store');
    expect(hit.headers.get('access-control-allow-origin')).toBe('https://www.deficheckup.com');
    expect(hit.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('bounds Safe and eligibility responses and rejects invalid token decimals', async () => {
    const oversized = setup({ answer: () => new Response(' '.repeat(2_000_001)) });
    expect((await oversized.post('/zksync-lite', { address: ADDRESS })).status).toBe(502);
    expect(
      (await oversized.post('/safe', { kind: 'balances', network: 'ethereum', address: ADDRESS }))
        .status,
    ).toBe(502);
    expect(oversized.store.size).toBe(0);
    for (const decimals of [-1, 37]) {
      const invalid = setup({
        answer: () => Response.json({ tokens: [{ ...LITE_ANSWER.tokens[0], decimals }] }),
      });
      expect((await invalid.post('/zksync-lite', { address: ADDRESS })).status).toBe(502);
    }
  });

  it('does not cache or pass on a failed or odd answer', async () => {
    const down = setup({ answer: () => new Response('down', { status: 500 }) });
    expect((await down.post('/zksync-lite', { address: ADDRESS })).status).toBe(502);
    expect(down.store.size).toBe(0);

    const odd = setup({ answer: () => Response.json({ tokens: [{ claimIndex: 'x' }] }) });
    expect((await odd.post('/zksync-lite', { address: ADDRESS })).status).toBe(502);
    expect(odd.store.size).toBe(0);
  });
});

const realTimeout = globalThis.setTimeout;

async function finish<T>(work: Promise<T> | T): Promise<T> {
  const pending = Promise.resolve(work);
  let settled = false;
  void pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  // Native crypto needs a real event-loop turn; the pacing and deadlines use fake timers.
  while (!settled) {
    await new Promise<void>((resolve) => realTimeout(resolve, 0));
    await vi.advanceTimersByTimeAsync(10);
  }
  return pending;
}

describe('proxy: /safe', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('paces all 13 networks within every rolling second and limits active requests', async () => {
    const starts: number[] = [];
    let active = 0;
    let peak = 0;
    const { post, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async () => {
      starts.push(Date.now());
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      active--;
      return Response.json({ safes: [] });
    });
    const began = Date.now();
    const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));
    expect(starts).toHaveLength(13);
    for (const [i, start] of starts.entries()) {
      expect(starts.filter((t) => t >= start && t < start + 1_000).length).toBeLessThanOrEqual(
        SAFE_REQUESTS_PER_SECOND,
      );
      if (i > 0) expect(start - starts[i - 1]!).toBeGreaterThanOrEqual(SAFE_REQUEST_SPACING_MS);
    }
    expect(peak).toBe(5);
    expect(Date.now() - began).toBeLessThanOrEqual(SAFE_PROXY_BUDGET_MS);
    expect(Object.values(((await response.json()) as { lists: object }).lists)).toEqual(
      Array.from({ length: 13 }, () => []),
    );
  });

  it('asks Safe with redirect: manual (Workers reject error) and reads a 3xx as a failure', async () => {
    const { post, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async (...args: unknown[]) => {
      const url = String(args[0]);
      return url.includes('/eth/')
        ? new Response(null, { status: 301, headers: { location: 'https://elsewhere.test/' } })
        : Response.json({ safes: [] });
    });
    const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));
    for (const call of fetchFn.mock.calls as unknown as [string, RequestInit][]) {
      expect(call[1].redirect).toBe('manual');
    }
    const { lists } = (await response.json()) as { lists: Record<string, unknown> };
    expect(lists.ethereum).toBeNull();
    expect(lists.arbitrum).toEqual([]);
  });

  it.each([false, true])(
    'retries an owner 429 once after Retry-After (still busy: %s)',
    async (busy) => {
      const attempts: number[] = [];
      const { post, fetchFn, store } = setup({ key: 'test-key' });
      fetchFn.mockImplementation(async (...args: unknown[]) => {
        const url = String(args[0]);
        if (url.includes('/eth/')) {
          attempts.push(Date.now());
          if (busy || attempts.length === 1)
            return new Response('private provider message', {
              status: 429,
              headers: { 'retry-after': '1' },
            });
        }
        return Response.json({ safes: [] });
      });
      const began = Date.now();
      const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));
      const { lists } = (await response.json()) as { lists: Record<string, unknown> };
      expect(attempts).toHaveLength(2);
      expect(attempts[1]! - attempts[0]!).toBeGreaterThanOrEqual(1_000);
      expect(lists.ethereum).toEqual(busy ? null : []);
      expect(lists.celo).toEqual([]);
      expect(fetchFn).toHaveBeenCalledTimes(14);
      expect(store.size).toBe(0);
      expect(Date.now() - began).toBeLessThanOrEqual(SAFE_PROXY_BUDGET_MS);
    },
  );

  it.each([
    { 'retry-after': '60' },
    { 'retry-after': '1', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2591751' },
  ])('does not shorten a retry delay that exceeds the budget: %j', async (headers) => {
    const { post, fetchFn } = setup({
      key: 'test-key',
      answer: () =>
        new Response('Monthly quota exceeded.', {
          status: 429,
          headers: headers as Record<string, string>,
        }),
    });
    const began = Date.now();
    const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));
    expect(fetchFn).toHaveBeenCalledTimes(13);
    expect(Object.values(((await response.json()) as { lists: object }).lists)).toEqual(
      Array(13).fill(null),
    );
    expect(Date.now() - began).toBeLessThanOrEqual(SAFE_PROXY_BUDGET_MS);
  });

  it.each([
    ['seconds', '2', 2_000],
    ['HTTP date', 'Mon, 02 Nov 2026 00:00:02 GMT', 2_000],
    ['missing', undefined, 1_000],
    ['malformed', 'invalid', 1_000],
    ['zero', '0', SAFE_REQUEST_SPACING_MS],
  ])('paces a balance retry using %s Retry-After', async (_case, retry, minimum) => {
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    const starts: number[] = [];
    const { post, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async () => {
      starts.push(Date.now());
      return starts.length === 1
        ? new Response(null, {
            status: 429,
            headers: retry === undefined ? {} : { 'retry-after': String(retry) },
          })
        : Response.json([]);
    });
    const began = Date.now();
    const response = await finish(
      post('/safe', { kind: 'balances', network: 'ethereum', address: ADDRESS }),
    );
    expect(response.status).toBe(200);
    expect(starts).toHaveLength(2);
    expect(starts[1]! - (_case === 'HTTP date' ? began : starts[0]!)).toBeGreaterThanOrEqual(
      Number(minimum),
    );
  });

  it('bounds a fully throttled fan-out and includes retries in the request rate', async () => {
    const starts: number[] = [];
    const { post, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async () => {
      starts.push(Date.now());
      return new Response(null, { status: 429 });
    });
    const began = Date.now();
    const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));
    expect(Object.values(((await response.json()) as { lists: object }).lists)).toEqual(
      Array(13).fill(null),
    );
    expect(Date.now() - began).toBeLessThanOrEqual(SAFE_PROXY_BUDGET_MS);
    expect(starts.length).toBeGreaterThan(13);
    expect(starts.length).toBeLessThanOrEqual(26);
    for (const start of starts) {
      expect(starts.filter((t) => t >= start && t < start + 1_000).length).toBeLessThanOrEqual(
        SAFE_REQUESTS_PER_SECOND,
      );
    }
    const calls = starts.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchFn).toHaveBeenCalledTimes(calls);
  });

  it('shortens late balance work and skips a retry beyond the remaining check budget', async () => {
    const starts: number[] = [];
    const { post, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async () => {
      starts.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 200));
      return new Response(null, { status: 429, headers: { 'retry-after': '1' } });
    });
    const response = await finish(
      post('/safe', {
        kind: 'balances',
        network: 'ethereum',
        address: ADDRESS,
        budgetMs: 500,
      }),
    );
    expect(response.status).toBe(503);
    expect(starts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(starts).toHaveLength(1);
    const expired = await finish(
      post('/safe', {
        kind: 'balances',
        network: 'ethereum',
        address: ADDRESS,
        budgetMs: 0,
      }),
    );
    expect(expired.status).toBe(502);
    expect(starts).toHaveLength(1);
  });

  it('bounds slow headers and bodies, skips expired jobs, and logs no provider data', async () => {
    const logs = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = logs.map((method) => vi.spyOn(console, method));
    try {
      for (const bodyStalls of [false, true]) {
        const { post, fetchFn, store } = setup({ key: 'test-key' });
        const signals: AbortSignal[] = [];
        let firstProviderStart: number | undefined;
        fetchFn.mockImplementation(async (...args: unknown[]) => {
          firstProviderStart ??= Date.now();
          signals.push((args[1] as RequestInit).signal as AbortSignal);
          if (!bodyStalls) return new Promise<Response>(() => undefined);
          return new Response(
            new ReadableStream({
              start() {
                /* no body arrives */
              },
            }),
          );
        });
        const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));
        // The provider budget starts after pass authentication, whose native crypto uses a
        // real event-loop turn while this test advances its fake clock in 10 ms steps.
        expect(firstProviderStart).toBeDefined();
        expect(Date.now() - firstProviderStart!).toBeLessThanOrEqual(SAFE_PROXY_BUDGET_MS);
        expect(Object.values(((await response.json()) as { lists: object }).lists)).toEqual(
          Array(13).fill(null),
        );
        expect(signals.every((signal) => signal.aborted)).toBe(true);
        expect(fetchFn.mock.calls.length).toBeLessThan(13);
        expect(store.size).toBe(0);
        const calls = fetchFn.mock.calls.length;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fetchFn).toHaveBeenCalledTimes(calls);
      }
      const retry = setup({
        key: 'test-key',
        answer: () => new Response('private key and address', { status: 429 }),
      });
      await finish(retry.post('/safe', { kind: 'owner-safes', address: ADDRESS }));
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it('shares spacing between simultaneous owner requests and balance retries', async () => {
    const starts: number[] = [];
    let balanceAttempts = 0;
    const { post, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async (...args: unknown[]) => {
      starts.push(Date.now());
      if (String(args[0]).includes('/balances/')) {
        balanceAttempts++;
        return balanceAttempts === 1 ? new Response(null, { status: 429 }) : Response.json([]);
      }
      return Response.json({ safes: [] });
    });
    await finish(
      Promise.all([
        post('/safe', { kind: 'owner-safes', address: ADDRESS }),
        post('/safe', { kind: 'balances', network: 'ethereum', address: ADDRESS }),
      ]),
    );
    expect(balanceAttempts).toBe(2);
    expect(starts).toHaveLength(15);
    starts.slice(1).forEach((start, i) => {
      expect(start - starts[i]!).toBeGreaterThanOrEqual(SAFE_REQUEST_SPACING_MS);
    });
  });

  it('runs 13 owner reads and 20 balances through the engine and proxy inside 10 seconds', async () => {
    const starts: number[] = [];
    const balanceStarts: number[] = [];
    let ownerReads = 0;
    const { app, env, executionCtx, fetchFn } = setup({ key: 'test-key' });
    fetchFn.mockImplementation(async (...args: unknown[]) => {
      starts.push(Date.now());
      const url = String(args[0]);
      if (url.includes('/owners/')) {
        // Existing public placeholders, on different networks: 7 * 2 + 6 = 20 Safes.
        ownerReads++;
        return Response.json({
          safes:
            ownerReads <= 7 ? [ADDRESS, '0x6666666666666666666666666666666666666666'] : [ADDRESS],
        });
      }
      balanceStarts.push(Date.now());
      return Response.json([]);
    });
    const ctx = createCheckContext({
      proxyUrl: 'https://proxy.example',
      fetchFn: (async (input, init) => {
        return app.request(
          new Request(input, {
            ...init,
            headers: {
              ...init?.headers,
              ...(await passHeaders()),
              origin: ORIGIN,
            },
          }),
          undefined,
          env,
          executionCtx,
        );
      }) as typeof fetch,
      readers: Object.fromEntries(
        [...SAFE_SERVICES.keys()].map((network) => [
          network,
          {
            readContract: async ({ functionName }: { functionName: string }) =>
              functionName === 'getOwners' ? [ADDRESS] : 1n,
            getGasPrice: async () => 1n,
          },
        ]),
      ),
    });
    const began = Date.now();
    const result = await finish(safeOwnerCheck.check(ADDRESS, ctx));
    expect(result).toEqual({ kind: 'nothing' });
    expect(starts).toHaveLength(33);
    expect(balanceStarts).toHaveLength(20);
    starts.slice(1).forEach((start, i) => {
      expect(start - starts[i]!).toBeGreaterThanOrEqual(SAFE_REQUEST_SPACING_MS);
    });
    expect(Date.now() - began).toBeLessThan(SAFE_CHECK_BUDGET_MS);
  });

  it('never reads a cached owner list and sends no-store on every response', async () => {
    const fetchFn = vi.fn(async () => Response.json({ safes: [] }));
    const match = vi.fn(async () => Response.json({ lists: { ethereum: [ADDRESS] } }));
    const app = createApp({ fetchFn, cache: { match } as unknown as Cache });
    const { env, executionCtx } = setup();
    const pending = app.request(
      '/safe',
      {
        method: 'POST',
        headers: { origin: ORIGIN, ...(await passHeaders()) },
        body: JSON.stringify({ kind: 'owner-safes', address: ADDRESS }),
      },
      env,
      executionCtx,
    );
    const response = await finish(pending);
    expect(match).not.toHaveBeenCalled();
    expect(((await response.json()) as { lists: { ethereum: string[] } }).lists.ethereum).toEqual(
      [],
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const denied = await app.request('/safe', {}, env, executionCtx);
    expect(denied.status).toBe(403);
    expect(denied.headers.get('cache-control')).toBe('no-store');
  });

  it("asks every network for the owner's Safes in one call, with the checksummed address and key", async () => {
    const { post, fetchFn, store } = setup({
      answer: () => Response.json({ safes: [] }),
      key: 'test-key',
    });

    const response = await finish(
      post('/safe', { kind: 'owner-safes', address: ADDRESS.toLowerCase() }),
    );

    const { lists } = (await response.json()) as { lists: Record<string, unknown> };
    expect(Object.keys(lists)).toHaveLength(SAFE_SERVICES.size);
    expect(lists.arbitrum).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(SAFE_SERVICES.size);
    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.safe.global/tx-service/arb1/api/v1/owners/${ADDRESS}/safes/`,
      expect.objectContaining({ headers: { authorization: 'Bearer test-key' } }),
    );
    // The lists name the user's own Safes: never cached.
    expect(store.size).toBe(0);
  });

  it('marks a network that failed or answered nonsense as null, and does not cache it', async () => {
    let call = 0;
    const { post, store } = setup({
      answer: () => (++call === 1 ? Response.json({ safes: [123] }) : Response.json({ safes: [] })),
    });

    const response = await finish(post('/safe', { kind: 'owner-safes', address: ADDRESS }));

    const { lists } = (await response.json()) as { lists: Record<string, unknown> };
    expect(Object.values(lists).filter((list) => list === null)).toHaveLength(1);
    expect(store.size).toBe(0);
  });

  it("asks for one Safe's balances without spam, and passes on only clean entries", async () => {
    const { post, fetchFn } = setup({
      answer: () =>
        Response.json([
          { tokenAddress: null, token: null, balance: '1', fiatBalance: '9' },
          {
            tokenAddress: ADDRESS,
            token: { symbol: 'X', decimals: 18, logoUri: 'x' },
            balance: '2',
          },
        ]),
    });

    const response = await post('/safe', {
      network: 'ethereum',
      kind: 'balances',
      address: ADDRESS,
    });

    expect(await response.json()).toEqual([
      { tokenAddress: null, token: null, balance: '1' },
      { tokenAddress: ADDRESS, token: { symbol: 'X', decimals: 18 }, balance: '2' },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.safe.global/tx-service/eth/api/v1/safes/${ADDRESS}/balances/?exclude_spam=true`,
      expect.objectContaining({ headers: {} }),
    );
  });

  it('rejects a malformed balance list instead of passing it on', async () => {
    for (const entry of [
      { tokenAddress: null, token: null, balance: 'broken' },
      { tokenAddress: ADDRESS, token: null, balance: '1000000' },
      { tokenAddress: ADDRESS, token: { symbol: ' ', decimals: 18 }, balance: '1' },
      { tokenAddress: ADDRESS, token: { symbol: 'X', decimals: 99 }, balance: '1' },
    ]) {
      const { post, store } = setup({ answer: () => Response.json([entry]) });

      expect(
        (await post('/safe', { network: 'ethereum', kind: 'balances', address: ADDRESS })).status,
      ).toBe(502);
      expect(store.size).toBe(0);
    }
  });

  it('only allows the known networks and questions, even inherited object keys', async () => {
    const { post, fetchFn } = setup();

    for (const body of [
      { network: 'solana', kind: 'balances', address: ADDRESS },
      { network: 'ethereum', kind: 'transactions', address: ADDRESS },
      { network: 'constructor', kind: 'balances', address: ADDRESS },
      { network: '__proto__', kind: 'balances', address: ADDRESS },
      { network: 'ethereum', kind: 'constructor', address: ADDRESS },
      { network: 'ethereum', kind: 'toString', address: ADDRESS },
    ]) {
      expect((await post('/safe', body)).status).toBe(400);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('says Safe is busy when it rate limits us', async () => {
    const { post, fetchFn } = setup({ answer: () => new Response('slow down', { status: 429 }) });

    expect(
      (await finish(post('/safe', { network: 'ethereum', kind: 'balances', address: ADDRESS })))
        .status,
    ).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
