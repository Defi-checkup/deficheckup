import type { CheckContext } from '@deficheckup/engine';
import { solanaAddressString, solanaDlmmParams, solanaDlmmPoolsParams } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { meteoraDlmmCheck } from './check';
import recorded from './recorded.json';

function context(which: 'empty' | 'liquidity' = 'empty') {
  const data = structuredClone(recorded[which].response.result);
  const pool = structuredClone(recorded.pool.response.result);
  const solanaRpc = vi.fn(async (method: string) => {
    if (method === 'getProgramAccounts') return data;
    if (method === 'getMultipleAccounts') return pool;
    throw new Error('Unexpected RPC');
  });
  const priceUsd = vi.fn(async (): Promise<number | null> => 100);
  return {
    data,
    pool,
    solanaRpc,
    priceUsd,
    ctx: { solanaRpc, priceUsd } as unknown as CheckContext,
  };
}

// Explicit synthetic edge cases mutate the real finalized RPC fixtures; no generated account
// is presented as a mainnet observation. recorded.json preserves the original responses.
function mutate(data: ReturnType<typeof context>['data'], edit: (bytes: Buffer) => void) {
  const account = data.value[0]!.account;
  const bytes = Buffer.from(account.data[0]!, 'base64');
  edit(bytes);
  account.data[0] = bytes.toString('base64');
}

describe('Meteora DLMM', () => {
  it('stops at 500 accounts and 10 pool range reads, explicitly marking either limit', async () => {
    const key = (n: number) => {
      const bytes = new Uint8Array(32);
      new DataView(bytes.buffer).setUint32(0, n, true);
      return solanaAddressString(bytes);
    };
    const empty = context();
    empty.data.value = Array.from({ length: 501 }, (_, i) => ({
      ...structuredClone(empty.data.value[0]!),
      pubkey: key(i + 1),
    }));
    const result = await meteoraDlmmCheck.check(recorded.empty.address, empty.ctx);
    expect(result.kind).toBe('found');
    if (result.kind === 'found') {
      expect(result.findings).toHaveLength(500);
      expect(result.partial).toBeDefined();
    }
    const funded = context('liquidity');
    funded.data.value = Array.from({ length: 11 }, (_, i) => {
      const entry = structuredClone(funded.data.value[0]!);
      entry.pubkey = key(i + 1);
      const bytes = Buffer.from(entry.account.data[0]!, 'base64');
      bytes.writeUInt32LE(i + 1, 8);
      entry.account.data[0] = bytes.toString('base64');
      return entry;
    });
    funded.pool.value = Array.from({ length: 10 }, () => structuredClone(funded.pool.value[0]!));
    expect(await meteoraDlmmCheck.check(recorded.liquidity.address, funded.ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
    expect((funded.solanaRpc.mock.calls[1] as unknown as [string, [string[]]])[1][0]).toHaveLength(
      10,
    );
  });
  it('uses the exact recorded discriminator, owner filter and data slice, without a size filter', async () => {
    const { ctx, solanaRpc } = context();
    const result = await meteoraDlmmCheck.check(recorded.empty.address, ctx);
    expect(solanaDlmmParams(recorded.empty.address)).toEqual(recorded.empty.request.params);
    expect(solanaRpc).toHaveBeenCalledWith('getProgramAccounts', recorded.empty.request.params);
    expect(solanaRpc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      kind: 'found',
      findings: recorded.empty.response.result.value.map((entry) => ({
        title: 'SOL rent in an empty Meteora DLMM position',
        network: 'solana',
        amount: { raw: BigInt(entry.account.lamports), decimals: 9, symbol: 'SOL' },
        valueUsd: 5.740608,
        claimCostUsd: 0.0005,
        heldBy: entry.pubkey,
        deadline: null,
      })),
    });
    if (result.kind === 'found') expect(result.partial).toBeUndefined();
  });

  it('proves a real non-empty position and checks its pool range, without inventing tokens', async () => {
    const { ctx, solanaRpc, priceUsd } = context('liquidity');
    const result = await meteoraDlmmCheck.check(recorded.liquidity.address, ctx);
    expect(result).toMatchObject({
      kind: 'found',
      findings: [
        {
          title: 'Meteora DLMM liquidity outside its position range',
          amount: null,
          valueUsd: null,
          claimCostUsd: null,
          heldBy: recorded.liquidity.response.result.value[0]!.pubkey,
          note: expect.stringContaining('Nonzero liquidity shares were read on-chain'),
        },
      ],
    });
    expect(solanaRpc).toHaveBeenCalledWith(
      'getMultipleAccounts',
      solanaDlmmPoolsParams(recorded.pool.addresses),
    );
    expect(priceUsd).not.toHaveBeenCalled();
    if (result.kind === 'found') expect(result.partial).toBeUndefined();
  });

  it('does not call a position with pending fees or rewards empty', async () => {
    for (const offset of [1192 + 32, 1192 + 40, 4552 + 32, 4552 + 40]) {
      const { ctx, data } = context();
      data.value = [data.value[0]!];
      mutate(data, (bytes) => bytes.writeBigUInt64LE(1n, offset));
      expect(await meteoraDlmmCheck.check(recorded.empty.address, ctx)).toMatchObject({
        kind: 'found',
        findings: [
          {
            title: 'Meteora DLMM position with pending fees or rewards',
            amount: null,
            valueUsd: null,
          },
        ],
      });
    }
  });

  it('keeps a proven position and marks partial when the pool is unavailable or missing', async () => {
    for (const fail of ['rpc', 'missing', 'shape']) {
      const { ctx, pool } = context('liquidity');
      if (fail === 'rpc') {
        const c = context('liquidity');
        c.solanaRpc.mockImplementation(async (method) => {
          if (method === 'getProgramAccounts') return c.data;
          throw new Error('RPC failed');
        });
        expect(await meteoraDlmmCheck.check(recorded.liquidity.address, c.ctx)).toMatchObject({
          kind: 'found',
          partial: expect.any(String),
        });
        continue;
      }
      if (fail === 'missing') Object.assign(pool, { value: [null] });
      if (fail === 'shape') pool.value = [];
      expect(await meteoraDlmmCheck.check(recorded.liquidity.address, ctx)).toMatchObject({
        kind: 'found',
        partial: expect.any(String),
        findings: [{ amount: null, note: expect.stringContaining('could not be checked') }],
      });
    }
  });

  it('does not infer emptiness from an extended position prefix or an unknown version', async () => {
    for (const extension of [true, false]) {
      const { ctx, data } = context();
      data.value = [data.value[0]!];
      if (extension) data.value[0]!.account.space += 112;
      else
        mutate(data, (bytes) => {
          bytes[8033] = 255;
        });
      expect(await meteoraDlmmCheck.check(recorded.empty.address, ctx)).toMatchObject({
        kind: 'error',
        reason: expect.stringContaining('unsupported'),
      });
    }
  });

  it('keeps rent without a price and flags an incomplete list', async () => {
    const { ctx, data, priceUsd } = context();
    Object.assign(data, { truncated: true });
    priceUsd.mockRejectedValue(new Error('No price'));
    expect(await meteoraDlmmCheck.check(recorded.empty.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
      findings: data.value.map(() => ({ valueUsd: null, claimCostUsd: null })),
    });
  });

  it('reports empty lists only after a successful read and rejects invalid input without RPC', async () => {
    const { ctx, data, solanaRpc } = context();
    data.value = [];
    expect(await meteoraDlmmCheck.check(recorded.empty.address, ctx)).toEqual({ kind: 'nothing' });
    solanaRpc.mockClear();
    expect(await meteoraDlmmCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(solanaRpc).not.toHaveBeenCalled();
    solanaRpc.mockRejectedValue(new Error('Unavailable'));
    expect(await meteoraDlmmCheck.check(recorded.empty.address, ctx)).toMatchObject({
      kind: 'error',
    });
  });

  it('rejects wrong owners, discriminators, unsafe balances, duplicate accounts and bad ranges', async () => {
    for (const change of ['owner', 'authority', 'discriminator', 'balance', 'duplicate', 'range']) {
      const { ctx, data } = context();
      data.value = [data.value[0]!];
      if (change === 'owner') data.value[0]!.account.owner = recorded.empty.address;
      if (change === 'authority')
        mutate(data, (b) => {
          b[40] = b[40]! ^ 1;
        });
      if (change === 'discriminator')
        mutate(data, (b) => {
          b[0] = 0;
        });
      if (change === 'balance') data.value[0]!.account.lamports = Number.MAX_SAFE_INTEGER + 1;
      if (change === 'duplicate') data.value.push(data.value[0]!);
      if (change === 'range') mutate(data, (b) => b.writeInt32LE(-2147483648, 7916));
      expect(await meteoraDlmmCheck.check(recorded.empty.address, ctx)).toMatchObject({
        kind: 'error',
      });
    }
  });
});
