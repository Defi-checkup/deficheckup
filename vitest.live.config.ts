import { defineConfig } from 'vitest/config';

// Tests that hit real RPCs and APIs. Run by hand (`pnpm test:live`), never in CI.
export default defineConfig({
  test: {
    include: ['**/*.live.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30_000,
  },
});
