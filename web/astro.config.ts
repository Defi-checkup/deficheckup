import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import { EVM_NETWORKS } from '@deficheckup/engine';
import { defineConfig } from 'astro/config';
import { securityHeaders } from './scripts/security-headers';
import { verifyLogos } from './scripts/verify-logos';
import { buildEnvironment } from './scripts/build-environment';

const staging = buildEnvironment(process.env.DEFICHECKUP_ENV) === 'staging';
if (staging && !process.env.PUBLIC_PROXY_URL) {
  throw new Error('Staging requires PUBLIC_PROXY_URL.');
}

// Only an origin belongs in CSP. Fail the build rather than widening the policy.
const proxy = process.env.PUBLIC_PROXY_URL;
const proxyOrigin = proxy ? new URL(proxy).origin : '';
if (proxy && !/^https:\/\//.test(proxy) && proxyOrigin !== 'http://localhost:8787') {
  throw new Error('PUBLIC_PROXY_URL must use HTTPS or http://localhost:8787.');
}
const connections = [
  ...Object.values(EVM_NETWORKS).flatMap((network) =>
    network.rpcs.map((rpc) => new URL(rpc).origin),
  ),
  'https://coins.llama.fi',
  'https://api.hyperliquid.xyz',
  'https://api.merkl.xyz',
  'https://raw.githubusercontent.com',
  ...(proxyOrigin ? [proxyOrigin] : []),
];

export default defineConfig({
  site: 'https://deficheckup.com',
  output: 'static',
  integrations: [
    react(),
    {
      name: 'static-security-headers',
      hooks: {
        'astro:build:start': () => {
          verifyLogos(fileURLToPath(new URL('./public/logos', import.meta.url)));
        },
        'astro:build:done': async ({ dir }) => {
          verifyLogos(fileURLToPath(new URL('logos', dir)));
          const documents = new Map<string, string>();
          for (const file of await readdir(dir, { recursive: true })) {
            if (file.endsWith('.html'))
              documents.set(file, await readFile(new URL(file, dir), 'utf8'));
          }
          const template = await readFile(new URL('./public/_headers', import.meta.url), 'utf8');
          const headers = securityHeaders(
            staging
              ? template.replace('/*\n', '/*\n  X-Robots-Tag: noindex, nofollow\n')
              : template,
            documents,
            connections,
          );
          if (staging) await writeFile(new URL('robots.txt', dir), 'User-agent: *\nDisallow: /\n');
          await writeFile(fileURLToPath(new URL('_headers', dir)), headers);
        },
      },
    },
  ],
  build: { inlineStylesheets: 'never' },
  // Even the tiny wordmark font must stay local: CSP intentionally rejects data: fonts.
  // Build inputs come from the process environment, never local secret files.
  vite: { envDir: false, build: { assetsInlineLimit: 0 } },
});
