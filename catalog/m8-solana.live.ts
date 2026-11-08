// Direct public RPC verification, separate from the Worker integration in catalog.live.ts.
// Never runs in CI. Only public third-party fixture owners; prices are intentionally unavailable.
import type { CheckContext } from '@deficheckup/engine';
import { describe, expect, it } from 'vitest';
import { solanaRequest, solanaResult } from '../proxy/src/solana';
import { meteoraDlmmCheck } from './meteora-dlmm/check';
import dlmm from './meteora-dlmm/recorded.json';
import { kaminoLiquidityCheck } from './kamino-liquidity/check';
import { marginfiCheck } from './marginfi/check';
import marginfi from './marginfi/recorded.json';
import { jupiterLockCheck } from './jupiter-lock/check';
import jupiterLock from './jupiter-lock/recorded.json';

const context = {
  async solanaRpc(method: string, params: readonly unknown[]) {
    const request = solanaRequest({ method, params });
    if (!request) throw new Error('Not an allowed read.');
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('Public RPC unavailable.');
    const answer = (await response.json()) as { result?: unknown; error?: unknown };
    if (answer.error || !answer.result) throw new Error('RPC read failed.');
    return solanaResult(request, answer.result);
  },
  priceUsd: async () => null,
} as unknown as CheckContext;

describe('M8 direct Solana reads (not Worker connectivity)', () => {
  it('reads the public Jupiter Lock recipient and matching escrow tokens', async () => {
    const start = performance.now();
    const result = await jupiterLockCheck.check(jupiterLock.address, context);
    expect(result).toMatchObject({
      kind: 'found',
      findings: [{ amount: null, heldBy: jupiterLock.response.result.value[0]!.pubkey }],
    });
    if (result.kind === 'found') expect(result.partial).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(10_000);
  });
  it('reads real marginfi asset shares and borrowing for a public mainnet authority', async () => {
    const start = performance.now();
    const result = await marginfiCheck.check(marginfi.address, context);
    expect(result).toMatchObject({
      kind: 'found',
      findings: [{ amount: null, note: expect.stringContaining('borrowing') }],
    });
    if (result.kind === 'found') expect(result.partial).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(10_000);
  });
  it('matches current Kamino shares for the public SDK example using production validators', async () => {
    const start = performance.now();
    const result = await kaminoLiquidityCheck.check(
      'HrwbdQYwSnAyVpVHuGQ661HiNbWmGjDp5DdDR9YMw7Bu',
      context,
    );
    expect(result).toMatchObject({ kind: 'found' });
    if (result.kind === 'found') expect(result.partial).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(10_000);
  });
  for (const which of ['empty', 'liquidity'] as const) {
    it(`reads public Meteora ${which} positions using the production request and response validators`, async () => {
      const start = performance.now();
      const result = await meteoraDlmmCheck.check(dlmm[which].address, context);
      expect(result.kind).toBe('found');
      if (result.kind === 'found') {
        expect(result.partial).toBeUndefined();
        expect(result.findings.some((finding) => finding.amount === null)).toBe(
          which === 'liquidity',
        );
      }
      expect(performance.now() - start).toBeLessThan(10_000);
    });
  }
});
