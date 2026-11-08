import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCheckContext, runChecks } from '@deficheckup/engine';
import { zksyncLiteCheck } from '../../../catalog/zksync-lite/check';
import { mintPass, PASS_SECONDS } from '../../../proxy/src/scan-pass';
import { MAX_WALLETS } from './inputs';
import { createProxySession, MAX_PASS_SECONDS, VERIFICATION_FAILURE } from './proxy-session';

const PROXY = 'https://proxy.deficheckup.test';
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
afterEach(() => vi.restoreAllMocks());
async function setup() {
  const grant = await mintPass('offline-browser-session-signing-material');
  const token = vi.fn(async () => TOKEN);
  const onFailure = vi.fn();
  const fetchFn = vi.fn<typeof fetch>(async (url) =>
    Response.json(
      String(url).endsWith('/scan-pass')
        ? grant
        : String(url).endsWith('/solana')
          ? { result: {} }
          : { tokens: [] },
    ),
  );
  const options = { proxyUrl: PROXY, token, onFailure, fetchFn };
  return { ...options, grant, session: createProxySession(options) };
}

describe('scanner proxy session', () => {
  it('matches the proxy lifetime and accepts its latest permitted expiry', async () => {
    expect(MAX_PASS_SECONDS).toBe(PASS_SECONDS);
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const { session, fetchFn, onFailure } = await setup();
    await session.authorize();
    await session.fetch(`${PROXY}/safe`);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('requests one token per scan, covers 10 sequential wallet deadlines and retries, and isolates other providers', async () => {
    const started = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(started);
    const { session, token, fetchFn, grant, onFailure } = await setup();
    // Model the entire exchange timeout before delivery, then each engine wallet deadline.
    now.mockReturnValue(started + 5_000);
    await Promise.all([session.authorize(), session.authorize()]);
    const ctx = createCheckContext({ proxyUrl: PROXY, fetchFn: session.fetch });
    for (let wallet = 0; wallet < MAX_WALLETS; wallet++) {
      now.mockReturnValue(started + 5_000 + (wallet + 1) * 10_000);
      await Promise.all([
        ctx.proxy('safe', { wallet }),
        ctx.proxy('zksync-lite', { wallet }),
        ctx.solanaRpc('getAccountInfo', [String(wallet)]),
      ]);
    }
    // A last in-flight request or retry still fits after all wallet deadlines.
    now.mockReturnValue(started + 5_000 + MAX_WALLETS * 10_000 + 5_000);
    await ctx.proxy('safe', { retry: true });
    await ctx.fetchJson('https://api.merkl.xyz/test', { input: 'public-fixture' });
    expect(token).toHaveBeenCalledTimes(1);
    const exchanges = fetchFn.mock.calls.filter(([url]) => String(url).endsWith('/scan-pass'));
    expect(exchanges).toHaveLength(1);
    expect(JSON.parse(exchanges[0]![1]!.body as string)).toEqual({ token: TOKEN });
    const protectedCalls = fetchFn.mock.calls.filter(
      ([url]) => String(url).startsWith(PROXY) && !String(url).endsWith('/scan-pass'),
    );
    expect(protectedCalls).toHaveLength(MAX_WALLETS * 3 + 1);
    for (const [, init] of protectedCalls) {
      expect(new Headers(init?.headers).get('x-scan-pass')).toBe(grant.pass);
      expect(init?.credentials).toBe('omit');
      expect(init?.redirect).toBe('error');
    }
    expect(new Headers(fetchFn.mock.calls.at(-1)![1]?.headers).has('x-scan-pass')).toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
    const next = createProxySession({ proxyUrl: PROXY, token, fetchFn, onFailure });
    await next.authorize();
    expect(token).toHaveBeenCalledTimes(2);
  });

  it('reports a plain failure once and leaves proxy checks as errors while other checks finish', async () => {
    const { token, fetchFn, onFailure, ...options } = await setup();
    token.mockRejectedValue(new Error('Blocked script'));
    const session = createProxySession({ ...options, token, fetchFn, onFailure });
    await session.authorize();
    const ctx = createCheckContext({ proxyUrl: PROXY, fetchFn: session.fetch });
    const { runs } = await runChecks(
      [
        zksyncLiteCheck,
        {
          ...zksyncLiteCheck,
          id: 'independent-read',
          check: async () => ({ kind: 'nothing' }),
        },
      ],
      ['0x000000000000000000000000000000000000dEaD'],
      ctx,
    );
    expect(runs.map((run) => run.outcome.kind)).toEqual(['error', 'nothing']);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(VERIFICATION_FAILURE);
    expect(token).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fails closed for rejected, malformed and expired grants without retrying token exchange', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    for (const answer of [
      new Response(null, { status: 403 }),
      Response.json({}),
      Response.json({ pass: 'invalid', expiresAt: Date.now() / 1000 + MAX_PASS_SECONDS }),
      Response.json({
        ...(await mintPass(
          'offline-browser-session-signing-material',
          Date.now() - MAX_PASS_SECONDS * 1000,
        )),
      }),
      Response.json(await mintPass('offline-browser-session-signing-material', Date.now() + 1_000)),
    ]) {
      const { session, token, fetchFn, onFailure } = await setup();
      fetchFn.mockResolvedValue(answer);
      await session.authorize();
      await expect(session.fetch(`${PROXY}/safe`, { method: 'POST' })).rejects.toThrow(
        VERIFICATION_FAILURE,
      );
      expect(token).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledExactlyOnceWith(VERIFICATION_FAILURE);
    }
  });

  it('expires in memory, never refreshes mid-scan, and reports proxy rejection', async () => {
    const { session, grant, token, fetchFn, onFailure } = await setup();
    await session.authorize();
    vi.spyOn(Date, 'now').mockReturnValue(grant.expiresAt * 1000);
    await expect(session.fetch(`${PROXY}/solana`)).rejects.toThrow(VERIFICATION_FAILURE);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(token).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
    const second = await setup();
    await second.session.authorize();
    second.fetchFn.mockResolvedValue(new Response(null, { status: 403 }));
    await second.session.fetch(`${PROXY}/safe`);
    await expect(second.session.fetch(`${PROXY}/safe`)).rejects.toThrow(VERIFICATION_FAILURE);
    expect(second.onFailure).toHaveBeenCalledOnce();
  });
});
