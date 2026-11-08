import { describe, expect, it, vi } from 'vitest';
import {
  SOLANA_CLOCK,
  SOLANA_STAKE_HISTORY,
  SOLANA_TOKEN_PROGRAM,
  SOLANA_TOKEN_2022_PROGRAM,
  solanaStakeParams,
  solanaTokenParams,
  solanaSysvarParams,
  solanaDlmmParams,
  solanaDlmmPoolsParams,
  solanaKaminoStrategiesParams,
  solanaMarginfiParams,
  solanaJupiterLockParams,
} from '@deficheckup/engine';
import { createApp, type ProxyEnv } from './app';
import { routeBindings, passHeaders } from './rate-limit.test-helpers';
import stake from '../../catalog/solana-stake/recorded.json';
import rent from '../../catalog/solana-rent/recorded.json';
import dlmm from '../../catalog/meteora-dlmm/recorded.json';
import marginfi from '../../catalog/marginfi/recorded.json';
import jupiterLock from '../../catalog/jupiter-lock/recorded.json';
import { recordedRegistry } from '../../catalog/kamino-liquidity/fixtures';

const ORIGIN = 'https://deficheckup.com';
function setup(result: unknown = stake.accounts) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ jsonrpc: '2.0', id: 1, result }));
  const cache = { match: vi.fn(), put: vi.fn() } as unknown as Cache;
  const app = createApp({ fetchFn, cache });
  const env: ProxyEnv = {
    ALLOWED_ORIGINS: ORIGIN,
    LIMITER: { limit: async () => ({ success: true }) },
    ...routeBindings(),
  };
  const post = async (body: unknown, origin = ORIGIN) =>
    app.request(
      '/solana',
      {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', ...(await passHeaders()) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      env,
    );
  return { fetchFn, cache, env, post };
}

describe('Solana proxy', () => {
  it('allows only the exact Jupiter Lock recipient query, with no caching or extra outbound calls', async () => {
    const params = solanaJupiterLockParams(jupiterLock.address);
    const { post, fetchFn, cache } = setup(jupiterLock.response.result);
    const response = await post({ method: 'getProgramAccounts', params });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    for (const options of [
      { ...params[1], filters: params[1].filters.slice(0, 2) },
      { ...params[1], dataSlice: { offset: 8, length: 32 } },
      {
        ...params[1],
        filters: [
          { dataSize: 296 },
          { memcmp: { offset: 72, bytes: jupiterLock.address } },
          params[1].filters[2],
        ],
      },
      { ...params[1], filters: [{ dataSize: 297 }, ...params[1].filters.slice(1)] },
    ])
      expect(
        (await post({ method: 'getProgramAccounts', params: [params[0], options] })).status,
      ).toBe(400);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('rejects Jupiter Lock account identity and layout mismatches from upstream', async () => {
    for (const change of ['discriminator', 'recipient', 'owner', 'size', 'duplicate']) {
      const result = structuredClone(jupiterLock.response.result);
      const a = result.value[0]!.account;
      const b = Uint8Array.from(atob(a.data[0]!), (char) => char.charCodeAt(0));
      if (change === 'discriminator') b[0] = b[0]! ^ 1;
      if (change === 'recipient') b[8] = b[8]! ^ 1;
      a.data[0] = change === 'size' ? '' : btoa(String.fromCharCode(...b));
      if (change === 'owner') a.owner = SOLANA_TOKEN_PROGRAM;
      if (change === 'duplicate') result.value.push(result.value[0]!);
      const { post } = setup(result);
      expect(
        (
          await post({
            method: 'getProgramAccounts',
            params: solanaJupiterLockParams(jupiterLock.address),
          })
        ).status,
      ).toBe(502);
    }
  });
  it('reads the fixed Kamino registry and authority-filtered marginfi accounts with one outbound request', async () => {
    for (const [params, result] of [
      [solanaKaminoStrategiesParams(), recordedRegistry()],
      [solanaMarginfiParams(marginfi.address), marginfi.response.result],
    ] as const) {
      const { post, fetchFn, cache } = setup(result);
      const response = await post({ method: 'getProgramAccounts', params });
      expect(response.status).toBe(200);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cache.match).not.toHaveBeenCalled();
      expect(cache.put).not.toHaveBeenCalled();
      const text = JSON.stringify(await response.json());
      expect(text).not.toContain('rentEpoch');
      expect(text).not.toContain('apiVersion');
    }
  });
  it('rejects arbitrary Kamino registry shapes and marginfi authority offsets before upstream', async () => {
    const registry = structuredClone(solanaKaminoStrategiesParams());
    const account = structuredClone(solanaMarginfiParams(marginfi.address));
    const variants = [
      [registry[0], { ...registry[1], dataSlice: { offset: 720, length: 32 } }],
      [registry[0], { ...registry[1], filters: registry[1].filters.slice(0, 1) }],
      [registry[0], { ...registry[1], extra: true }],
      [
        account[0],
        {
          ...account[1],
          filters: [
            account[1].filters[0],
            { memcmp: { offset: 8, bytes: marginfi.address } },
            account[1].filters[2],
          ],
        },
      ],
    ];
    const { post, fetchFn } = setup();
    for (const params of variants)
      expect((await post({ method: 'getProgramAccounts', params })).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('rejects invalid registry accounts and wrong marginfi authority or discriminator', async () => {
    for (const bad of ['owner', 'size', 'data', 'duplicate']) {
      const result = recordedRegistry();
      if (bad === 'owner') result.value[0]!.account.owner = SOLANA_TOKEN_PROGRAM;
      if (bad === 'size') result.value[0]!.account.space = 40;
      if (bad === 'data') result.value[0]!.account.data[0] = '';
      if (bad === 'duplicate') result.value.push(result.value[0]!);
      const { post } = setup(result);
      expect(
        (await post({ method: 'getProgramAccounts', params: solanaKaminoStrategiesParams() }))
          .status,
      ).toBe(502);
    }
    for (const offset of [0, 40]) {
      const result = structuredClone(marginfi.response.result);
      const a = result.value[0]!.account;
      const b = Uint8Array.from(atob(a.data[0]!), (char) => char.charCodeAt(0));
      b[offset] = b[offset]! ^ 1;
      a.data[0] = btoa(String.fromCharCode(...b));
      const { post } = setup(result);
      expect(
        (
          await post({
            method: 'getProgramAccounts',
            params: solanaMarginfiParams(marginfi.address),
          })
        ).status,
      ).toBe(502);
    }
  });
  it('forwards DLMM position and pool reads once, strips extra fields and never caches them', async () => {
    for (const [method, params, result] of [
      ['getProgramAccounts', solanaDlmmParams(dlmm.empty.address), dlmm.empty.response.result],
      [
        'getMultipleAccounts',
        solanaDlmmPoolsParams(dlmm.pool.addresses),
        dlmm.pool.response.result,
      ],
    ] as const) {
      const { post, fetchFn, cache } = setup(result);
      const response = await post({ method, params });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const text = JSON.stringify(await response.json());
      expect(text).toContain('space');
      expect(text).not.toContain('rentEpoch');
      expect(text).not.toContain('apiVersion');
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cache.put).not.toHaveBeenCalled();
      expect(cache.match).not.toHaveBeenCalled();
    }
  });
  it('rejects alternate DLMM filters, slices, programs and pool lists before upstream', async () => {
    const params = structuredClone(solanaDlmmParams(dlmm.empty.address));
    const variants = [
      [params[0], { ...params[1], filters: [{ dataSize: 8120 }, params[1].filters[1]] }],
      [params[0], { ...params[1], dataSlice: { offset: 0, length: 72 } }],
      [
        params[0],
        {
          ...params[1],
          filters: [params[1].filters[0], { memcmp: { offset: 8, bytes: dlmm.empty.address } }],
        },
      ],
      [dlmm.empty.address, params[1]],
    ];
    const { post, fetchFn } = setup();
    for (const params of variants)
      expect((await post({ method: 'getProgramAccounts', params })).status).toBe(400);
    for (const keys of [
      [],
      ['invalid'],
      Array.from({ length: 11 }, () => dlmm.empty.address),
      [dlmm.empty.address, dlmm.empty.address],
    ])
      expect(
        (await post({ method: 'getMultipleAccounts', params: solanaDlmmPoolsParams(keys) })).status,
      ).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('validates the DLMM discriminator, owner, authority and original size before forwarding', async () => {
    for (const change of ['owner', 'authority', 'discriminator', 'size', 'lamports', 'duplicate']) {
      const result = structuredClone(dlmm.empty.response.result);
      const a = result.value[0]!.account;
      if (change === 'owner') a.owner = SOLANA_TOKEN_PROGRAM;
      if (change === 'authority' || change === 'discriminator') {
        const b = Uint8Array.from(atob(a.data[0]!), (char) => char.charCodeAt(0));
        const i = change === 'authority' ? 40 : 0;
        b[i] = b[i]! ^ 1;
        a.data[0] = btoa(String.fromCharCode(...b));
      }
      if (change === 'size') a.space = 72;
      if (change === 'lamports') a.lamports = Number.MAX_SAFE_INTEGER + 1;
      if (change === 'duplicate') result.value.push(result.value[0]!);
      const { post } = setup(result);
      expect(
        (await post({ method: 'getProgramAccounts', params: solanaDlmmParams(dlmm.empty.address) }))
          .status,
      ).toBe(502);
    }
    for (const change of ['owner', 'discriminator', 'size', 'length']) {
      const result = structuredClone(dlmm.pool.response.result);
      if (change === 'owner') result.value[0]!.owner = SOLANA_TOKEN_PROGRAM;
      if (change === 'size') result.value[0]!.space = 80;
      if (change === 'length') result.value = [];
      if (change === 'discriminator') {
        const b = Uint8Array.from(atob(result.value[0]!.data[0]!), (char) => char.charCodeAt(0));
        b[0] = 0;
        result.value[0]!.data[0] = btoa(String.fromCharCode(...b));
      }
      const { post } = setup(result);
      expect(
        (
          await post({
            method: 'getMultipleAccounts',
            params: solanaDlmmPoolsParams(dlmm.pool.addresses),
          })
        ).status,
      ).toBe(502);
    }
  });
  it('forwards the exact stake read, sanitizes fields and never touches cache', async () => {
    const { fetchFn, post, cache } = setup();
    const params = solanaStakeParams(stake.address);
    const response = await post({ method: 'getProgramAccounts', params });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ result: stake.accounts });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.mainnet-beta.solana.com',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getProgramAccounts', params }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it('uses Helius only when the secret is supplied by the environment', async () => {
    const { fetchFn, post, env } = setup(stake.clock);
    env.HELIUS_API_KEY = 'test-key';
    expect(
      (await post({ method: 'getAccountInfo', params: solanaSysvarParams(SOLANA_CLOCK) })).status,
    ).toBe(200);
    expect(fetchFn.mock.calls[0]![0]).toBe('https://mainnet.helius-rpc.com/?api-key=test-key');
  });
  it('accepts only the two fixed sysvars and preserves base64 data', async () => {
    for (const [key, value] of [
      [SOLANA_CLOCK, stake.clock],
      [SOLANA_STAKE_HISTORY, stake.history],
    ] as const) {
      const { post } = setup(value);
      const response = await post({ method: 'getAccountInfo', params: solanaSysvarParams(key) });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ result: value });
    }
  });
  it('accepts both token programs with owner-only filters and strips unrelated fields', async () => {
    for (const [program, result] of [
      [SOLANA_TOKEN_PROGRAM, rent.tokens],
      [SOLANA_TOKEN_2022_PROGRAM, rent.tokens2022],
    ] as const) {
      const { post } = setup(result);
      const response = await post({
        method: 'getTokenAccountsByOwner',
        params: solanaTokenParams(rent.address, program),
      });
      expect(response.status).toBe(200);
      const clean = JSON.stringify(await response.json());
      expect(clean).toContain(rent.address);
      expect(clean).not.toContain('uiAmount');
      expect(clean).not.toContain('rentEpoch');
    }
  });
  it('rejects alternate stake offsets, filters, programs, methods, extra keys and malformed input before upstream', async () => {
    const variants: unknown[] = [
      {},
      [],
      null,
      '{broken',
      'x'.repeat(1025),
      { method: 'sendTransaction', params: [] },
      { method: 'simulateTransaction', params: [] },
      { method: 'getAccountInfo', params: solanaSysvarParams(stake.address) },
      { method: 'getProgramAccounts', params: [] },
      {
        method: 'getTokenAccountsByOwner',
        params: solanaTokenParams('invalid', SOLANA_TOKEN_PROGRAM),
      },
      { method: 'getTokenAccountsByOwner', params: solanaTokenParams(rent.address, 'constructor') },
      {
        method: 'getProgramAccounts',
        params: solanaStakeParams(stake.address),
        endpoint: 'https://evil.example',
      },
    ];
    const normal = JSON.parse(JSON.stringify(solanaStakeParams(stake.address))) as unknown[];
    for (const mutate of [
      (p: unknown[]) => {
        (p[1] as { filters: unknown[] }).filters[1] = {
          memcmp: { offset: 12, bytes: stake.address },
        };
      },
      (p: unknown[]) => {
        (p[1] as { filters: unknown[] }).filters = [];
      },
      (p: unknown[]) => {
        p[0] = SOLANA_TOKEN_PROGRAM;
      },
      (p: unknown[]) => {
        Object.assign(p[1] as object, { encoding: 'jsonParsed' });
      },
      (p: unknown[]) => {
        Object.assign(p[1] as object, { extra: true });
      },
    ]) {
      const params = structuredClone(normal);
      mutate(params);
      variants.push({ method: 'getProgramAccounts', params });
    }
    const { post, fetchFn } = setup();
    for (const body of variants) expect((await post(body)).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('shares the CORS and per-IP limit middleware', async () => {
    const { post, fetchFn, env } = setup();
    const body = { method: 'getProgramAccounts', params: solanaStakeParams(stake.address) };
    expect((await post(body, 'https://evil.example')).status).toBe(403);
    env.LIMITER = { limit: async () => ({ success: false }) };
    expect((await post(body)).status).toBe(429);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('rejects RPC errors and oversized bodies without echoing provider error messages or keys', async () => {
    for (const bad of [
      Response.json({ jsonrpc: '2.0', id: 1, error: { message: rent.address + ' test-key' } }),
      Response.json({ jsonrpc: '2.0', id: 2, result: stake.accounts }),
      new Response('x'.repeat(2_000_001)),
    ]) {
      const { post, fetchFn } = setup();
      fetchFn.mockResolvedValueOnce(bad);
      const response = await post({
        method: 'getProgramAccounts',
        params: solanaStakeParams(stake.address),
      });
      expect(response.status).toBe(502);
      const text = await response.text();
      expect(text).not.toContain(rent.address);
      expect(text).not.toContain('test-key');
    }
  });
  it('rejects wrong withdrawers, owners and unsafe account balances', async () => {
    for (const change of ['withdrawer', 'owner', 'lamports', 'duplicate']) {
      const result = structuredClone(stake.accounts);
      if (change === 'withdrawer') {
        const bytes = Uint8Array.from(atob(result.value[0]!.account.data[0]!), (c) =>
          c.charCodeAt(0),
        );
        bytes[44] = bytes[44]! ^ 1;
        result.value[0]!.account.data[0] = btoa(String.fromCharCode(...bytes));
      }
      if (change === 'owner') result.value[0]!.account.owner = SOLANA_TOKEN_PROGRAM;
      if (change === 'lamports') result.value[0]!.account.lamports = Number.MAX_SAFE_INTEGER + 1;
      if (change === 'duplicate') result.value.push(result.value[0]!);
      const { post } = setup(result);
      expect(
        (await post({ method: 'getProgramAccounts', params: solanaStakeParams(stake.address) }))
          .status,
      ).toBe(502);
    }
  });
  it('validates token ownership, balances and close authorities before forwarding', async () => {
    for (const bad of ['owner', 'amount', 'closeAuthority']) {
      const result = structuredClone(rent.tokens);
      const info = result.value[0]!.account.data.parsed.info;
      if (bad === 'owner') info.owner = stake.address;
      if (bad === 'amount') info.tokenAmount.amount = 'NaN';
      if (bad === 'closeAuthority') Object.assign(info, { closeAuthority: 'invalid' });
      const { post } = setup(result);
      expect(
        (
          await post({
            method: 'getTokenAccountsByOwner',
            params: solanaTokenParams(rent.address, SOLANA_TOKEN_PROGRAM),
          })
        ).status,
      ).toBe(502);
    }
  });
});
