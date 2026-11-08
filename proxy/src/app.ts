import {
  createSafePacer,
  isEvmAddress,
  safeWithin,
  SAFE_PROXY_BUDGET_MS,
  toChecksumAddress,
} from '@deficheckup/engine';
import { Hono, type Context } from 'hono';
import { solanaRequest, solanaResult } from './solana';
import { boundedJson } from './json';
import { mintPass, validPass, signingConfigured, SCAN_ACTION, SITEVERIFY } from './scan-pass';

type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

/** The Worker's bindings. SAFE_API_KEY is a secret, so it is not in the generated Env. */
export type ProxyEnv = {
  ALLOWED_ORIGINS: string;
  LIMITER: RateLimiter;
  SAFE_LIMITER: RateLimiter;
  SOLANA_LIMITER: RateLimiter;
  ZKSYNC_LITE_LIMITER: RateLimiter;
  SAFE_API_KEY?: string;
  HELIUS_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SCAN_PASS_SECRET?: string;
};

/** What the app needs from the outside world, so tests can replace it. */
export interface Deps {
  fetchFn: typeof fetch;
  /** Cloudflare's edge cache, or undefined where there is none (tests). */
  cache: Cache | undefined;
}

type Ctx = Context<{ Bindings: ProxyEnv }>;

const CACHE_SECONDS = 600;
// Under the engine's 5 s for an API call, so a slow network upstream leaves time to answer with
// the others instead of the whole call timing out in the browser.
const UPSTREAM_TIMEOUT_MS = 3_000;
const MAX_BODY_BYTES = 1_024;
// Safe documents backoff, without specifying an initial delay or promising Retry-After.
const SAFE_RETRY_DELAY_MS = 1_000;
const SAFE_MAX_RETRY_DELAY_MS = 2_000;

const ZKSYNC_LITE_ELIGIBILITY = 'https://lite.zksync.io/api/eligibility';
const SAFE_TX_SERVICE = 'https://api.safe.global/tx-service';

// The networks the Safe check reads, by Safe's own short names (EIP-3770). A Map, so only these
// keys match: a plain object would also answer to "constructor" or "toString".
export const SAFE_SERVICES = new Map<string, string>([
  ['ethereum', 'eth'],
  ['arbitrum', 'arb1'],
  ['optimism', 'oeth'],
  ['base', 'base'],
  ['polygon', 'pol'],
  ['gnosis', 'gno'],
  ['bsc', 'bnb'],
  ['avalanche', 'avax'],
  ['zksync', 'zksync'],
  ['linea', 'linea'],
  ['scroll', 'scr'],
  ['mantle', 'mantle'],
  ['celo', 'celo'],
]);

function fail(c: Ctx, status: 400 | 403 | 404 | 413 | 429 | 502 | 503, error: string) {
  return c.json({ error }, status);
}

/**
 * The JSON body, or null when it is missing, not an object or larger than MAX_BODY_BYTES. The
 * stream is cut as soon as it passes the limit, so a large body never fills the Worker's memory.
 */
async function readBody(
  c: Ctx,
  maxBytes = MAX_BODY_BYTES,
): Promise<Record<string, unknown> | null> {
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > maxBytes) return null;
  const reader = c.req.raw.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A cache key that never holds an address: the route plus a hash of what was asked. */
async function cacheKey(route: string, parts: string[]): Promise<Request> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(parts.join('\n').toLowerCase()),
  );
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new Request(`https://cache.deficheckup.internal/${route}/${hex}`);
}

/**
 * Answers from the cache when it can. Otherwise runs `load` and keeps an answer it marks as
 * cacheable for CACHE_SECONDS.
 */
async function cached(
  c: Ctx,
  deps: Deps,
  key: Request,
  load: () => Promise<{ response: Response; cacheable: boolean }>,
): Promise<Response> {
  const hit = await deps.cache?.match(key);
  // A cached response has immutable headers: copy it so the CORS headers can be added.
  if (hit) return new Response(hit.body, hit);
  const { response, cacheable } = await load();
  if (cacheable && response.ok && deps.cache) {
    const copy = new Response(response.clone().body, response);
    copy.headers.set('cache-control', `public, max-age=${CACHE_SECONDS}`);
    c.executionCtx.waitUntil(deps.cache.put(key, copy));
  }
  return response;
}

function upstream(deps: Deps, url: string, init: RequestInit = {}): Promise<Response> {
  return deps.fetchFn(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

/** Retry-After is optional. Monthly reset is a duration in seconds, not a timestamp. */
function safeRetryDelay(response: Response): number {
  const retry = response.headers.get('retry-after');
  const parsed = retry === null ? NaN : Number(retry);
  const retryMs = Number.isFinite(parsed)
    ? Math.max(0, parsed * 1_000)
    : retry === null
      ? SAFE_RETRY_DELAY_MS
      : Math.max(0, Date.parse(retry) - Date.now());
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (response.headers.get('x-ratelimit-remaining') === '0' && reset > 0) {
    return Math.max(retryMs || SAFE_RETRY_DELAY_MS, reset * 1_000);
  }
  return Number.isFinite(retryMs) ? retryMs : SAFE_RETRY_DELAY_MS;
}

interface LiteToken {
  claimIndex: number;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  rawBalance: string;
}

function isLiteToken(value: unknown): value is LiteToken {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.claimIndex === 'number' &&
    Number.isSafeInteger(t.claimIndex) &&
    t.claimIndex >= 0 &&
    typeof t.tokenAddress === 'string' &&
    isEvmAddress(t.tokenAddress) &&
    typeof t.symbol === 'string' &&
    typeof t.decimals === 'number' &&
    Number.isSafeInteger(t.decimals) &&
    t.decimals >= 0 &&
    t.decimals <= 36 &&
    typeof t.rawBalance === 'string' &&
    /^[0-9]+$/.test(t.rawBalance)
  );
}

/** Safe's list of the Safes an owner has: `{ safes: [address, ...] }`, or null when malformed. */
function safeList(answer: unknown): string[] | null {
  const safes = (answer as { safes?: unknown } | null)?.safes;
  return Array.isArray(safes) && safes.every((s) => typeof s === 'string' && isEvmAddress(s))
    ? (safes as string[])
    : null;
}

/** Safe's balances of one Safe, or null when any entry is malformed. */
function safeBalances(answer: unknown) {
  if (!Array.isArray(answer)) return null;
  const balances = [];
  for (const entry of answer as Record<string, unknown>[]) {
    const { tokenAddress, token, balance } = entry ?? {};
    const tokenInfo = token as { symbol?: unknown; decimals?: unknown } | null;
    if (
      !(
        tokenAddress === null ||
        (typeof tokenAddress === 'string' && isEvmAddress(tokenAddress))
      ) ||
      // The native coin has no token; any other balance needs a symbol and sane decimals.
      !(tokenAddress === null
        ? token === null
        : typeof token === 'object' &&
          token !== null &&
          typeof tokenInfo?.symbol === 'string' &&
          tokenInfo.symbol.trim() !== '' &&
          typeof tokenInfo.decimals === 'number' &&
          Number.isSafeInteger(tokenInfo.decimals) &&
          tokenInfo.decimals >= 0 &&
          tokenInfo.decimals <= 36) ||
      typeof balance !== 'string' ||
      !/^[0-9]+$/.test(balance)
    ) {
      return null;
    }
    balances.push({
      tokenAddress,
      token: tokenInfo === null ? null : { symbol: tokenInfo.symbol, decimals: tokenInfo.decimals },
      balance,
    });
  }
  return balances;
}

export function createApp(deps: Deps) {
  const app = new Hono<{ Bindings: ProxyEnv }>();
  // Owner lists, balances and retries share one queue in this isolate. Separate isolates and
  // other clients of the Safe account still share quota upstream, so 429 remains possible.
  const paceSafe = createSafePacer();

  // Only the internal edge copy may be cached. Never persist scan responses in browsers.
  app.use('*', async (c, next) => {
    c.header('cache-control', 'no-store');
    c.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    c.header('x-content-type-options', 'nosniff');
    c.header('referrer-policy', 'no-referrer');
    await next();
    c.res.headers.set('cache-control', 'no-store');
  });

  // Browsers on our own site only. A script elsewhere can fake the header, which is why the rate
  // limit below exists; this check keeps other websites from using the proxy through their users.
  app.use('*', async (c, next) => {
    const allowed = c.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
    const origin = c.req.header('origin');
    if (!origin || !allowed.includes(origin)) return fail(c, 403, 'Origin not allowed.');
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'content-type, x-scan-pass',
      'access-control-max-age': '86400',
      vary: 'origin',
    };
    if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    await next();
    for (const [name, value] of Object.entries(cors)) c.res.headers.set(name, value);
  });

  // The IP is only the rate limiter's key: it is never stored or logged.
  app.use('*', async (c, next) => {
    const key = c.req.header('cf-connecting-ip') ?? 'unknown';
    const { success } = await c.env.LIMITER.limit({ key });
    if (!success) return fail(c, 429, 'Too many requests. Try again in a minute.');
    const routeLimiter =
      c.req.path === '/safe'
        ? c.env.SAFE_LIMITER
        : c.req.path === '/solana'
          ? c.env.SOLANA_LIMITER
          : c.req.path === '/zksync-lite'
            ? c.env.ZKSYNC_LITE_LIMITER
            : undefined;
    if (routeLimiter && !(await routeLimiter.limit({ key })).success)
      return fail(c, 429, 'Too many requests. Try again in a minute.');
    await next();
  });

  // No wallet, IP, cdata or other scan input is sent to Siteverify. Never retry a spent token.
  app.post('/scan-pass', async (c) => {
    const secret = c.env.TURNSTILE_SECRET_KEY;
    const signing = c.env.SCAN_PASS_SECRET;
    const hostname = new URL(c.req.header('origin')!).hostname;
    const testKey = /^[123]x0{31}AA$/.test(secret ?? '');
    if (
      !secret ||
      /TO_SET|PLACEHOLDER|REPLACE_ME/.test(secret) ||
      !signingConfigured(signing) ||
      (testKey && hostname !== 'localhost' && hostname !== '127.0.0.1')
    )
      return fail(c, 503, 'Scan verification is unavailable.');
    // Only this route accepts the documented 2048-character token plus JSON overhead.
    const body = await readBody(c, 2_200);
    const token = body?.token;
    if (
      !body ||
      Object.keys(body).length !== 1 ||
      typeof token !== 'string' ||
      !token.length ||
      token.length > 2048
    )
      return fail(c, 400, 'Expected a verification token.');
    try {
      const response = await deps.fetchFn(SITEVERIFY, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, response: token }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) return fail(c, 502, 'Scan verification did not answer.');
      const answer = (await boundedJson(response)) as {
        success?: unknown;
        hostname?: unknown;
        action?: unknown;
      } | null;
      // Cloudflare's test secrets answer hostname "example.com" and no action. They are accepted
      // only on localhost (checked above), so their answers skip the hostname and action match.
      if (
        answer?.success !== true ||
        (!testKey && (answer.hostname !== hostname || answer.action !== SCAN_ACTION))
      )
        return fail(c, 403, 'Scan verification failed.');
      return c.json(await mintPass(signing));
    } catch {
      return fail(c, 502, 'Scan verification did not answer.');
    }
  });

  // Check before reading a wallet body, touching cache or spending any provider quota.
  app.use('*', async (c, next) => {
    if (['/safe', '/solana', '/zksync-lite'].includes(c.req.path)) {
      const secret = c.env.SCAN_PASS_SECRET;
      if (!signingConfigured(secret)) return fail(c, 503, 'Scan verification is unavailable.');
      if (!(await validPass(c.req.header('x-scan-pass'), secret)))
        return fail(c, 403, 'A valid scan pass is required.');
    }
    await next();
  });

  // Every zkSync Lite balance an address can still claim. lite.zksync.io does not answer browsers.
  app.post('/zksync-lite', async (c) => {
    const body = await readBody(c);
    const address = body?.address;
    if (typeof address !== 'string' || !isEvmAddress(address)) {
      return fail(c, 400, 'Expected {"address": "0x..."}.');
    }
    return cached(c, deps, await cacheKey('zksync-lite', [address]), async () => {
      const response = await upstream(deps, ZKSYNC_LITE_ELIGIBILITY, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      }).catch(() => null);
      if (!response?.ok) {
        return { response: fail(c, 502, 'zkSync Lite did not answer.'), cacheable: false };
      }
      const answer = (await boundedJson(response).catch(() => null)) as { tokens?: unknown } | null;
      const tokens = answer?.tokens;
      if (!Array.isArray(tokens) || !tokens.every(isLiteToken)) {
        return { response: fail(c, 502, 'Unexpected answer from zkSync Lite.'), cacheable: false };
      }
      // Only what the check needs; the upstream also echoes the address back.
      const clean = tokens.map(({ claimIndex, tokenAddress, symbol, decimals, rawBalance }) => ({
        claimIndex,
        tokenAddress,
        symbol,
        decimals,
        rawBalance,
      }));
      return { response: c.json({ tokens: clean }), cacheable: true };
    });
  });

  // Safe's transaction service, with our API key. Two questions only:
  // - "owner-safes": the Safes an address owns, paced across 13 networks (at most 26 upstream
  //   requests with retries, under Cloudflare's 50 per call);
  // - "balances": what one Safe holds on one network.
  app.post('/safe', async (c) => {
    const body = await readBody(c);
    const { network, kind, address } = body ?? {};
    if (typeof address !== 'string' || !isEvmAddress(address)) {
      return fail(c, 400, 'Expected {"kind", "address"} and, for balances, "network".');
    }
    const checksum = toChecksumAddress(address); // the service rejects lowercase addresses
    const key = c.env.SAFE_API_KEY;
    // The engine can shorten a late balance request, including its retries. Never let a
    // caller extend the server budget. Missing or malformed hints keep the existing default.
    const budgetMs =
      typeof body?.budgetMs === 'number' && Number.isFinite(body.budgetMs)
        ? Math.max(0, Math.min(SAFE_PROXY_BUDGET_MS, body.budgetMs))
        : SAFE_PROXY_BUDGET_MS;
    const deadline = Date.now() + budgetMs;
    const ask = async (service: string, path: string) => {
      const failed = { status: 0, answer: null as unknown };
      const attempt = async (notBefore = 0) => {
        return safeWithin(
          paceSafe(
            async () => {
              // Queue time remains inside the original request deadline.
              if (Date.now() >= deadline) return null;
              const controller = new AbortController();
              const timer = setTimeout(
                () => controller.abort(),
                Math.min(UPSTREAM_TIMEOUT_MS, Math.max(0, deadline - Date.now())),
              );
              try {
                return await safeWithin(
                  (async () => {
                    const response = await deps.fetchFn(
                      `${SAFE_TX_SERVICE}/${service}/api/v1/${path}`,
                      {
                        headers: key ? { authorization: `Bearer ${key}` } : {},
                        signal: controller.signal,
                        // Each redirect is a subrequest and could bypass pacing or forward the key.
                        // Workers reject redirect: 'error'; 'manual' returns the 3xx, read as a failure.
                        redirect: 'manual',
                      },
                    );
                    const retryDelay = response.status === 429 ? safeRetryDelay(response) : 0;
                    if (!response.ok) await response.body?.cancel();
                    return {
                      status: response.status,
                      answer: response.ok ? await boundedJson(response).catch(() => null) : null,
                      retryDelay,
                    };
                  })(),
                  Math.min(deadline, Date.now() + UPSTREAM_TIMEOUT_MS),
                  null,
                );
              } catch {
                return null;
              } finally {
                clearTimeout(timer);
                controller.abort();
              }
            },
            deadline,
            notBefore,
          ),
          deadline,
          null,
        );
      };
      const first = await attempt();
      if (first?.status !== 429) return first ?? failed;
      if (first.retryDelay > SAFE_MAX_RETRY_DELAY_MS) return first;
      const retryAt = Date.now() + first.retryDelay;
      if (retryAt >= deadline) return first;
      return (await attempt(retryAt)) ?? first;
    };

    if (kind === 'owner-safes') {
      const entries = await Promise.all(
        [...SAFE_SERVICES].map(async ([name, service]) => {
          const { answer } = await ask(service, `owners/${checksum}/safes/`);
          return [name, safeList(answer)] as const;
        }),
      );
      // A network that failed is null. Never cached: the lists name the user's own Safes, and the
      // proxy keeps no addresses. The engine already asks once per scan.
      return c.json({ lists: Object.fromEntries(entries) });
    }

    const service = typeof network === 'string' ? SAFE_SERVICES.get(network) : undefined;
    if (kind !== 'balances' || !service) {
      return fail(c, 400, 'Expected {"kind", "address"} and, for balances, "network".');
    }
    return cached(c, deps, await cacheKey('safe-balances', [service, checksum]), async () => {
      if (Date.now() >= deadline)
        return { response: fail(c, 502, 'Safe did not answer as expected.'), cacheable: false };
      const { status, answer } = await ask(
        service,
        `safes/${checksum}/balances/?exclude_spam=true`,
      );
      if (status === 429) {
        return { response: fail(c, 503, 'Safe is busy. Try again later.'), cacheable: false };
      }
      const balances = safeBalances(answer);
      if (balances === null) {
        return { response: fail(c, 502, 'Safe did not answer as expected.'), cacheable: false };
      }
      return { response: c.json(balances), cacheable: true };
    });
  });

  app.post('/solana', async (c) => {
    const body = await readBody(c);
    let request;
    try {
      request = body ? solanaRequest(body) : null;
    } catch {
      request = null;
    }
    if (!request) return fail(c, 400, 'Solana request is not allowed.');
    const key = c.env.HELIUS_API_KEY;
    const url = key
      ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`
      : 'https://api.mainnet-beta.solana.com';
    try {
      const response = await upstream(deps, url, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: request.method,
          params: request.params,
        }),
      });
      if (!response.ok) return fail(c, 502, 'Solana RPC did not answer.');
      const answer = (await boundedJson(response)) as {
        jsonrpc?: unknown;
        id?: unknown;
        error?: unknown;
        result?: unknown;
      } | null;
      if (
        answer?.jsonrpc !== '2.0' ||
        answer.id !== 1 ||
        answer.error !== undefined ||
        !Object.hasOwn(answer, 'result')
      ) {
        return fail(c, 502, 'Unexpected Solana RPC answer.');
      }
      // Account names are personal scan data. Never use the edge cache or forward provider
      // messages, which can echo an address or API key. Infrastructure traces remain off.
      c.header('cache-control', 'no-store');
      return c.json({ result: solanaResult(request, answer.result) });
    } catch {
      return fail(c, 502, 'Solana RPC could not be read.');
    }
  });

  app.notFound((c) => fail(c, 404, 'Not found.'));
  app.onError((_error, c) => fail(c, 502, 'Something went wrong.'));
  return app;
}
