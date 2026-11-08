import { defineConfig } from 'vitest/config';

// *.test.ts is Vitest (logic, recorded fixtures, no network).
// *.spec.ts is Playwright and lives in tests/e2e/.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
