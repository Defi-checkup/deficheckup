import { vi } from 'vitest';
import { mintPass } from './scan-pass';

export const TEST_SIGNING_SECRET = 'offline-test-pass-material-not-a-deployed-secret';
export async function passHeaders() {
  return { 'x-scan-pass': (await mintPass(TEST_SIGNING_SECRET)).pass };
}

export function routeBindings() {
  return {
    SCAN_PASS_SECRET: TEST_SIGNING_SECRET,
    SAFE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    SOLANA_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ZKSYNC_LITE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  };
}
