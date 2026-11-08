import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('node_modules/.cache/ms-playwright');
export default defineConfig({
  testDir: './tests/e2e',
  // server.test.ts in the same folder is a Vitest test of the static server.
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 25_000 },
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    // A reserved test domain, intercepted by the specs. Never use credentials or a live proxy.
    command:
      'PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA PUBLIC_PROXY_URL=https://proxy.deficheckup.test pnpm build && node tests/e2e/server.mjs',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
  },
});
