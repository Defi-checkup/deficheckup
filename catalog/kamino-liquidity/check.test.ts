import type { CheckContext } from '@deficheckup/engine';
import {
  solanaKaminoStrategiesParams,
  solanaTokenParams,
  SOLANA_TOKEN_PROGRAM,
  solanaAddressString,
} from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { kaminoLiquidityCheck } from './check';
import { recordedRegistry } from './fixtures';
import recorded from './recorded.json';

function context() {
  const registry = recordedRegistry();
  const tokens = structuredClone(recorded.tokens.response.result);
  const solanaRpc = vi.fn(async (method: string) =>
    method === 'getProgramAccounts' ? registry : tokens,
  );
  return { registry, tokens, solanaRpc, ctx: { solanaRpc } as unknown as CheckContext };
}

describe('Kamino liquidity', () => {
  it('matches the real public SDK example owner to shares in the complete recorded registry', async () => {
    const { ctx, registry, solanaRpc } = context();
    expect(registry.value).toHaveLength(5612);
    expect(solanaKaminoStrategiesParams()).toEqual(recorded.registry.request.params);
    const result = await kaminoLiquidityCheck.check(recorded.address, ctx);
    expect(result).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'Kamino liquidity strategy shares in a token account',
          network: 'solana',
          amount: { raw: 70675n, decimals: 6, symbol: 'Kamino shares' },
          valueUsd: null,
          claimCostUsd: null,
          deadline: null,
          heldBy: recorded.tokens.response.result.value[2]!.pubkey,
          note: expect.stringContaining('CEz5keL9hBCUbtVbmcwenthRMwmZLupxJ6YtYAgzp4ex'),
        },
      ],
    });
    expect(solanaRpc).toHaveBeenCalledWith('getProgramAccounts', recorded.registry.request.params);
    expect(solanaRpc).toHaveBeenCalledWith(
      'getTokenAccountsByOwner',
      solanaTokenParams(recorded.address, SOLANA_TOKEN_PROGRAM),
    );
    expect(solanaRpc).toHaveBeenCalledTimes(2);
  });

  it('reports nothing for successfully read empty token accounts or zero shares', async () => {
    for (const empty of [true, false]) {
      const { ctx, tokens } = context();
      if (empty) tokens.value = [];
      else tokens.value[2]!.account.data.parsed.info.tokenAmount.amount = '0';
      expect(await kaminoLiquidityCheck.check(recorded.address, ctx)).toEqual({ kind: 'nothing' });
    }
  });

  it('keeps frozen shares visible with their restriction and keeps valid shares on partial token reads', async () => {
    const { ctx, tokens } = context();
    tokens.value[2]!.account.data.parsed.info.state = 'frozen';
    tokens.value[0]!.account.data.parsed.info.tokenAmount.amount = 'NaN';
    expect(await kaminoLiquidityCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
      findings: [{ note: expect.stringContaining('frozen') }],
    });
  });

  it('does not silently return nothing on truncated or invalid registry and token data', async () => {
    for (const change of [
      'truncated',
      'decimals',
      'owner',
      'duplicate',
      'authority',
      'amount',
      'slot',
    ]) {
      const { ctx, registry, tokens } = context();
      tokens.value = [];
      if (change === 'truncated') Object.assign(registry, { truncated: true });
      if (change === 'decimals') {
        const b = Buffer.from(registry.value[0]!.account.data[0]!, 'base64');
        b.writeBigUInt64LE(255n, 32);
        registry.value[0]!.account.data[0] = b.toString('base64');
      }
      if (change === 'owner') registry.value[0]!.account.owner = SOLANA_TOKEN_PROGRAM;
      if (change === 'duplicate') registry.value.push(registry.value[0]!);
      if (change === 'slot') registry.context.slot = -1;
      if (change === 'authority' || change === 'amount') {
        tokens.value = structuredClone(recorded.tokens.response.result.value);
        tokens.value = [tokens.value[2]!];
        if (change === 'authority')
          tokens.value[0]!.account.data.parsed.info.owner = registry.value[0]!.pubkey;
        else tokens.value[0]!.account.data.parsed.info.tokenAmount.amount = '18446744073709551616';
      }
      expect(await kaminoLiquidityCheck.check(recorded.address, ctx)).toMatchObject({
        kind: 'error',
      });
    }
  });

  it('keeps shares found before a registry cap and identifies incomplete coverage', async () => {
    const { ctx, registry } = context();
    Object.assign(registry, { truncated: true });
    expect(await kaminoLiquidityCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
  });

  it('does not decode entries beyond the 6000-strategy cap', async () => {
    const { ctx, registry } = context();
    // Synthetic rows extend the real registry. The malformed final row must be skipped by
    // the cap and reported as incomplete, while the real public owner's shares stay visible.
    for (let i = registry.value.length; i < 6000; i++) {
      const entry = structuredClone(registry.value[0]!);
      const mint = new Uint8Array(32).fill(255);
      new DataView(mint.buffer).setUint32(0, i, true);
      const key = mint.slice();
      key[31] = 254;
      entry.pubkey = solanaAddressString(key);
      const bytes = Buffer.alloc(40);
      bytes.set(mint);
      bytes.writeBigUInt64LE(6n, 32);
      entry.account.data[0] = bytes.toString('base64');
      registry.value.push(entry);
    }
    const bad = structuredClone(registry.value[0]!);
    bad.account.data[0] = '';
    registry.value.push(bad);
    expect(await kaminoLiquidityCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
  });

  it('rejects invalid input without reads and returns error on RPC failure', async () => {
    const { ctx, solanaRpc } = context();
    expect(await kaminoLiquidityCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(solanaRpc).not.toHaveBeenCalled();
    solanaRpc.mockRejectedValue(new Error('Unavailable'));
    expect(await kaminoLiquidityCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'error',
    });
  });
});
