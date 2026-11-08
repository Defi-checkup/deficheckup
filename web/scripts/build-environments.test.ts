import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildEnvironment } from './build-environment';

const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, '../test-results/build-environments');
const outputs = new Map<string, string>();
const envFor = (environment: string) => ({
  ...process.env,
  DEFICHECKUP_ENV: environment,
  PUBLIC_PROXY_URL:
    environment === 'staging'
      ? 'https://deficheckup-proxy-staging.deficheckup.workers.dev'
      : 'https://api.deficheckup.com',
  ASTRO_TELEMETRY_DISABLED: '1',
});
let directory: string;

beforeAll(() => {
  mkdirSync(cache, { recursive: true });
  directory = mkdtempSync(join(cache, 'build-'));
  // Real offline builds in isolated output folders, without Wrangler, git or a browser.
  // Production follows staging to catch leaked directives when reusing an Astro checkout.
  for (const environment of ['staging', 'production']) {
    const output = join(directory, environment);
    execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', output], {
      cwd: root,
      env: envFor(environment),
      stdio: 'pipe',
      timeout: 90_000,
    });
    outputs.set(environment, output);
  }
}, 180_000);

afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('built environment artifacts', () => {
  it.each(['staging', 'production'])(
    'audits every actual page, header and robots output for %s',
    (environment) => {
      const output = outputs.get(environment)!;
      const staging = environment === 'staging';
      const htmlFiles = readdirSync(output, { recursive: true }).filter((name) =>
        String(name).endsWith('.html'),
      );
      expect(htmlFiles.length).toBeGreaterThan(30);
      for (const file of htmlFiles) {
        const html = readFileSync(join(output, String(file)), 'utf8');
        expect(
          html.includes('<meta name="robots" content="noindex, nofollow">'),
          String(file),
        ).toBe(staging);
        expect(html.includes('>Test environment</p>'), String(file)).toBe(staging);
        expect(html).toContain('<link rel="canonical" href="https://deficheckup.com/');
        if (!staging) expect(html).not.toMatch(/noindex|nofollow/);
      }
      const headers = readFileSync(join(output, '_headers'), 'utf8');
      expect(headers.includes('X-Robots-Tag: noindex, nofollow')).toBe(staging);
      expect(headers.trim().split(/\n\s*\n/)).toHaveLength(22);
      expect(headers.split('\n').every((line) => Buffer.byteLength(line) <= 2_000)).toBe(true);
      expect(headers).toContain(envFor(environment).PUBLIC_PROXY_URL);
      expect(headers).not.toContain(envFor(staging ? 'production' : 'staging').PUBLIC_PROXY_URL);
      const robots = readFileSync(join(output, 'robots.txt'), 'utf8');
      expect(robots).toBe(
        staging
          ? 'User-agent: *\nDisallow: /\n'
          : 'User-agent: *\nAllow: /\n\nSitemap: https://deficheckup.com/sitemap.xml\n',
      );
      const audit = spawnSync(process.execPath, ['scripts/verify-seo.mjs', output], {
        cwd: root,
        env: envFor(environment),
        encoding: 'utf8',
      });
      expect(audit.status, audit.stderr).toBe(0);
      const wrongAudit = spawnSync(process.execPath, ['scripts/verify-seo.mjs', output], {
        cwd: root,
        env: envFor(staging ? 'production' : 'staging'),
        encoding: 'utf8',
      });
      expect(wrongAudit.status).not.toBe(0);
    },
  );

  it('defaults to production and rejects an ambiguous build environment', () => {
    expect(buildEnvironment(undefined)).toBe('production');
    expect(() => buildEnvironment('preview')).toThrow(/DEFICHECKUP_ENV/);
    expect(() => buildEnvironment('')).toThrow(/DEFICHECKUP_ENV/);
  });
});
