import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHeaders, resolveRequest } from './server.mjs';

const files = new Set([
  'index.html',
  'privacy/index.html',
  'protocols/index.html',
  'protocols/test/index.html',
  'file.html',
  '_astro/app.js',
  'robots.txt',
  '_headers',
  '_redirects',
]);
const rules = parseHeaders(`/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  Cache-Control: no-store

/privacy
  Content-Security-Policy: default-src 'none'

/protocols/*
  Content-Security-Policy: default-src 'none'
`);

describe('Workers static asset server', () => {
  it('uses the routing mode configured for the web Worker', () => {
    const config = readFileSync(new URL('../../web/wrangler.jsonc', import.meta.url), 'utf8');
    expect(config.match(/"html_handling": "drop-trailing-slash"/g)).toHaveLength(2);
    expect(config.match(/"not_found_handling": "none"/g)).toHaveLength(2);
  });

  it.each([
    ['/', 'index.html'],
    ['/privacy', 'privacy/index.html'],
    ['/protocols', 'protocols/index.html'],
    ['/protocols/test', 'protocols/test/index.html'],
    ['/file', 'file.html'],
    ['/_astro/app.js', '_astro/app.js'],
    ['/robots.txt', 'robots.txt'],
  ])('serves canonical %s directly', (path, file) => {
    expect(resolveRequest(path, files, rules)).toMatchObject({ status: 200, file });
  });

  // Cloudflare's drop-trailing-slash table, including root, flat and directory HTML.
  it.each([
    ['/index', '/'],
    ['/index.html', '/'],
    ...['privacy', 'protocols', 'protocols/test', 'file'].flatMap((path) =>
      [`/${path}/`, `/${path}.html`, `/${path}/index`, `/${path}/index.html`].map((alias) => [
        alias,
        `/${path}`,
      ]),
    ),
  ])('redirects %s to %s with 307 and preserves the query', (path, destination) => {
    const response = resolveRequest(`${path}?test=1`, files, rules);
    expect(response).toMatchObject({ status: 307, headers: { location: `${destination}?test=1` } });
    expect(response.file).toBeUndefined();
    expect(resolveRequest(response.headers.location, files, rules).status).toBe(200);
  });

  it('applies headers to the requested path, including redirects and empty splats', () => {
    expect(resolveRequest('/protocols/', files, rules).headers['content-security-policy']).toBe(
      "default-src 'none'",
    );
    expect(
      resolveRequest('/privacy/', files, rules).headers['content-security-policy'],
    ).toBeUndefined();
    expect(resolveRequest('/privacy', files, rules).headers['content-security-policy']).toBe(
      "default-src 'none'",
    );
    for (const path of ['/privacy/', '/missing', '/_astro/app.js']) {
      expect(resolveRequest(path, files, rules).headers).toMatchObject({
        'x-robots-tag': 'noindex, nofollow',
        'referrer-policy': 'no-referrer',
        'cache-control': 'no-store',
      });
    }
    const overlapping = parseHeaders('/*\n  X-Test: first\n\n/protocols/*\n  X-Test: second');
    expect(resolveRequest('/protocols/test', files, overlapping).headers['x-test']).toBe(
      'first, second',
    );
  });

  it.each([
    '/missing',
    '/missing/',
    '/missing/index.html',
    '/_headers',
    '/_redirects',
    '/%2e%2e%2fprivate',
    '/%5cprivate',
  ])('returns an empty 404 for %s without a homepage fallback', (path) => {
    const response = resolveRequest(path, files, rules);
    expect(response.status).toBe(404);
    expect(response.file).toBeUndefined();
    expect(response.headers.location).toBeUndefined();
  });
});
