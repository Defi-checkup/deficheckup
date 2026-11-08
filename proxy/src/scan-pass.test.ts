import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type ProxyEnv } from './app';
import { routeBindings, TEST_SIGNING_SECRET } from './rate-limit.test-helpers';
import { mintPass, PASS_SECONDS, SITEVERIFY, validPass } from './scan-pass';

// Cloudflare's public always-pass test secret and dummy token, never a real widget credential.
const SECRET = '1x0000000000000000000000000000000AA';
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const ORIGIN = 'http://localhost:4321';
// Shaped like a real secret key (not a test key), so the answer's hostname and action are enforced.
const REAL_SHAPED_SECRET = `0x4AAAAAAA${'B'.repeat(27)}`;
const success = { success: true, hostname: 'localhost', action: 'scan' };
function setup(answer: unknown = success, secret = SECRET) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      Response.json(String(url) === SITEVERIFY ? answer : { tokens: [] }),
    );
  const cache = { match: vi.fn(), put: vi.fn() } as unknown as Cache;
  const app = createApp({ fetchFn, cache });
  const env: ProxyEnv = {
    ALLOWED_ORIGINS: ORIGIN,
    LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ...routeBindings(),
    TURNSTILE_SECRET_KEY: secret,
  };
  const post = (path: string, body: unknown, pass?: string, origin = ORIGIN) =>
    app.request(
      path,
      {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.7',
          ...(pass === undefined ? {} : { 'x-scan-pass': pass }),
        },
        body: JSON.stringify(body),
      },
      env,
      { waitUntil: () => undefined, passThroughOnException: () => undefined, props: {} },
    );
  return { post, fetchFn, cache, env, app };
}
afterEach(() => vi.restoreAllMocks());

describe('scan verification and anonymous passes', () => {
  it('accepts the signed lifetime exactly, rejects any longer grant and expires at the boundary', async () => {
    const now = 1_800_000_000_000;
    const { pass, expiresAt } = await mintPass(TEST_SIGNING_SECRET, now);
    expect(expiresAt).toBe(now / 1000 + PASS_SECONDS);
    expect(await validPass(pass, TEST_SIGNING_SECRET, now)).toBe(true);
    expect(await validPass(pass, TEST_SIGNING_SECRET, expiresAt * 1000 - 1)).toBe(true);
    expect(await validPass(pass, TEST_SIGNING_SECRET, expiresAt * 1000)).toBe(false);
    const future = await mintPass(TEST_SIGNING_SECRET, now + 1_000);
    expect(await validPass(future.pass, TEST_SIGNING_SECRET, now)).toBe(false);
  });

  it('verifies once without forwarding personal fields, then reuses the pass without Siteverify or storage', async () => {
    const { post, fetchFn, cache } = setup();
    const started = Math.floor(Date.now() / 1000);
    const response = await post('/scan-pass', { token: TOKEN });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    const { pass, expiresAt } = (await response.json()) as { pass: string; expiresAt: number };
    expect(expiresAt).toBeGreaterThanOrEqual(started + PASS_SECONDS);
    expect(expiresAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + PASS_SECONDS);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(SITEVERIFY);
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual' });
    expect(JSON.parse(init!.body as string)).toEqual({ secret: SECRET, response: TOKEN });
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    expect(cache.put).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) {
      expect(
        (
          await post(
            '/zksync-lite',
            { address: '0x000000000000000000000000000000000000dEaD' },
            pass,
          )
        ).status,
      ).toBe(200);
    }
    expect(fetchFn.mock.calls.filter(([url]) => url === SITEVERIFY)).toHaveLength(1);
    for (const [, cached] of vi.mocked(cache.put).mock.calls) {
      expect(await cached.text()).toBe('{"tokens":[]}');
    }
    expect(await mintPass(TEST_SIGNING_SECRET)).not.toEqual({ pass, expiresAt });
  });

  it('rejects missing, malformed, tampered, expired and future passes on all protected routes before cache or provider calls', async () => {
    const { pass } = await mintPass(TEST_SIGNING_SECRET);
    const expired = await mintPass(TEST_SIGNING_SECRET, Date.now() - PASS_SECONDS * 1000);
    const future = await mintPass(TEST_SIGNING_SECRET, Date.now() + 60_000);
    const wrongKey = await mintPass('a-different-offline-signing-secret-material');
    for (const candidate of [
      undefined,
      '',
      'invalid',
      pass.slice(0, -1),
      pass.slice(0, -1) + (pass.endsWith('0') ? '1' : '0'),
      expired.pass,
      future.pass,
      wrongKey.pass,
    ]) {
      for (const route of ['/safe', '/solana', '/zksync-lite']) {
        const { post, fetchFn, cache } = setup();
        const response = await post(route, {}, candidate);
        expect(response.status).toBe(403);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(fetchFn).not.toHaveBeenCalled();
        expect(cache.match).not.toHaveBeenCalled();
      }
    }
  });

  it.each([
    { success: false, 'error-codes': ['invalid-input-response'] },
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { success: true, hostname: 'evil.example', action: 'scan' },
    { success: true, hostname: 'localhost', action: 'another-action' },
    { success: true, hostname: 'localhost' },
    null,
    {},
  ])(
    'never issues a pass for a failed, expired, duplicate or mismatched validation: %j',
    async (answer) => {
      const { post, fetchFn } = setup(answer, REAL_SHAPED_SECRET);
      const response = await post('/scan-pass', { token: TOKEN });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Scan verification failed.' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts the test-key answer (hostname example.com, no action) only because it is local', async () => {
    const { post } = setup({
      success: true,
      hostname: 'example.com',
      metadata: { result_with_testing_key: true },
    });
    expect((await post('/scan-pass', { token: TOKEN })).status).toBe(200);
  });

  it('uses Siteverify single-use semantics without a token store or retry', async () => {
    const { post, fetchFn } = setup();
    fetchFn
      .mockResolvedValueOnce(Response.json(success))
      .mockResolvedValueOnce(
        Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
      );
    expect((await post('/scan-pass', { token: TOKEN })).status).toBe(200);
    expect((await post('/scan-pass', { token: TOKEN })).status).toBe(403);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('fails closed on Siteverify errors, malformed JSON and redirects without echoing or logging', async () => {
    const logs = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = logs.map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
    for (const response of [
      new Response('sensitive provider answer', { status: 500 }),
      new Response(null, { status: 302, headers: { location: 'https://evil.example' } }),
      new Response('malformed'),
      null,
    ]) {
      const { post, fetchFn } = setup();
      if (response) fetchFn.mockResolvedValue(response);
      else fetchFn.mockRejectedValue(new Error('sensitive provider error'));
      const result = await post('/scan-pass', { token: TOKEN });
      expect(result.status).toBe(502);
      expect(await result.text()).not.toMatch(/sensitive|DUMMY|203\.0\.113|localhost/);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
    const { post } = setup();
    const response = await post('/scan-pass', { token: TOKEN });
    const { pass } = (await response.json()) as { pass: string };
    await post('/zksync-lite', { address: '0x000000000000000000000000000000000000dEaD' }, pass);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('bounds tokens, rejects extra scan fields and allows the documented maximum token size', async () => {
    for (const body of [
      {},
      { token: '' },
      { token: 12 },
      { token: 'x'.repeat(2049) },
      { token: TOKEN, address: '0x000000000000000000000000000000000000dEaD' },
    ]) {
      const { post, fetchFn } = setup();
      expect((await post('/scan-pass', body)).status).toBe(400);
      expect(fetchFn).not.toHaveBeenCalled();
    }
    expect((await setup().post('/scan-pass', { token: 'x'.repeat(2048) })).status).toBe(200);
  });

  it('requires secrets, refuses official test secrets on deployed hosts and preserves rate limits', async () => {
    for (const missing of ['TURNSTILE_SECRET_KEY', 'SCAN_PASS_SECRET'] as const) {
      const { post, env, fetchFn } = setup();
      delete env[missing];
      expect((await post('/scan-pass', { token: TOKEN })).status).toBe(503);
      expect(fetchFn).not.toHaveBeenCalled();
    }
    const { post, env, fetchFn } = setup();
    env.ALLOWED_ORIGINS = 'https://deficheckup.com';
    expect(
      (await post('/scan-pass', { token: TOKEN }, undefined, env.ALLOWED_ORIGINS)).status,
    ).toBe(503);
    expect(fetchFn).not.toHaveBeenCalled();
    env.ALLOWED_ORIGINS = ORIGIN;
    vi.mocked(env.LIMITER.limit).mockResolvedValue({ success: false });
    expect((await post('/scan-pass', { token: TOKEN })).status).toBe(429);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('permits the pass header in preflight without calling Siteverify', async () => {
    const { app, env, fetchFn } = setup();
    const response = await app.request(
      '/safe',
      { method: 'OPTIONS', headers: { origin: ORIGIN } },
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type, x-scan-pass');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
