// Match the proxy pass lifetime; offline tests enforce agreement between packages.
export const MAX_PASS_SECONDS = 120;

export const VERIFICATION_FAILURE =
  'Scan verification is unavailable, blocked or expired. Checks that use our proxy could not be checked. Allow challenges.cloudflare.com and try scanning again.';

/** One ephemeral session per scan, shared by every wallet and every proxy route. */
export function createProxySession({
  proxyUrl,
  token,
  onFailure,
  fetchFn = fetch,
}: {
  proxyUrl: string | undefined;
  token: () => Promise<string>;
  onFailure: (message: string) => void;
  fetchFn?: typeof fetch;
}) {
  let authorization: Promise<void> | undefined;
  let pass: string | undefined;
  let expiresAt = 0;
  let failed = false;
  function fail() {
    pass = undefined;
    if (!failed) onFailure(VERIFICATION_FAILURE);
    failed = true;
  }
  function authorize() {
    authorization ??= (async () => {
      try {
        if (!proxyUrl) throw new Error('Missing proxy.');
        const response = await fetchFn(`${proxyUrl}/scan-pass`, {
          method: 'POST',
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: await token() }),
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error('Verification rejected.');
        const body = (await response.json()) as { pass?: unknown; expiresAt?: unknown } | null;
        if (
          typeof body?.pass !== 'string' ||
          !/^v1\.[0-9]{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(body.pass) ||
          typeof body.expiresAt !== 'number' ||
          !Number.isSafeInteger(body.expiresAt) ||
          body.expiresAt <= Date.now() / 1000 ||
          body.expiresAt > Date.now() / 1000 + MAX_PASS_SECONDS ||
          Number(body.pass.split('.')[1]) !== body.expiresAt
        )
          throw new Error('Unexpected verification answer.');
        pass = body.pass;
        expiresAt = body.expiresAt;
      } catch {
        fail();
      }
    })();
    return authorization;
  }
  const authenticatedFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (
      !proxyUrl ||
      !['safe', 'solana', 'zksync-lite'].some((route) => url === `${proxyUrl}/${route}`)
    )
      return fetchFn(input, init);
    await authorize();
    if (!pass || Date.now() / 1000 >= expiresAt) {
      fail();
      throw new Error(VERIFICATION_FAILURE);
    }
    const headers = new Headers(init?.headers);
    headers.set('x-scan-pass', pass);
    const response = await fetchFn(input, {
      ...init,
      headers,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    if (response.status === 403) fail();
    return response;
  };
  return { authorize, fetch: authenticatedFetch };
}
