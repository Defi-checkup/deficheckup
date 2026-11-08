import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { ASSETS, IMMUTABLE_BRIDGE, immutableWithdrawalsCheck } from './check';
import recorded from './recorded.json';
const owner = recorded.owner;
function context(override?: (r: ReadRequest) => unknown) {
  const readContract = vi.fn(async (r: ReadRequest) => {
    const v = override?.(r);
    if (v instanceof Error) throw v;
    if (v !== undefined) return v;
    const read = recorded.reads.find(
      (x) =>
        x.signature.startsWith(`function ${r.functionName}(`) &&
        JSON.stringify(x.args) ===
          JSON.stringify(r.args, (_, a) => (typeof a === 'bigint' ? a.toString() : a)),
    );
    if (!read) throw Error('Missing read');
    return r.functionName === 'getWithdrawalBalance' ? BigInt(read.result!) : read.result;
  });
  const ctx = {
    readContract,
    priceUsd: vi.fn(async () => 3000),
    gasCostUsd: vi.fn(async () => 1),
  } as unknown as CheckContext;
  return { ctx, readContract };
}
describe('Immutable X pending withdrawals', () => {
  it('replays non-quantized ETH with a registered recipient and explicit coverage warning', async () => {
    const { ctx, readContract } = context();
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.stringContaining('Legacy keys'),
      findings: [
        {
          title: 'ETH awaiting Immutable X L1 finalization',
          network: 'ethereum',
          amount: { raw: 903833100000000n, decimals: 18, symbol: 'ETH' },
          valueUsd: expect.closeTo(2.7114993, 9),
          claimCostUsd: 1,
          deadline: null,
          heldBy: IMMUTABLE_BRIDGE,
          note: expect.stringContaining(String(BigInt(owner))),
        },
      ],
    });
    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: IMMUTABLE_BRIDGE,
        functionName: 'getEthKey',
        args: [BigInt(owner)],
      }),
    );
    expect(ctx.gasCostUsd).toHaveBeenCalledWith('ethereum', 150_000n);
    expect(
      recorded.reads.find((r) => r.signature === 'function withdraw(uint256,uint256)'),
    ).toMatchObject({ from: owner, raw: '0x' });
  });
  it('reports nothing with the coverage note when the listed balances are zero', async () => {
    const { ctx } = context((r) => (r.functionName === 'getWithdrawalBalance' ? 0n : undefined));
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('Legacy keys'),
    });
  });
  it('reports nothing, not a failure, when no standard Stark key is registered', async () => {
    const { ctx, readContract } = context((r) =>
      r.functionName === 'getEthKey' ? '0x0000000000000000000000000000000000000000' : undefined,
    );
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('No standard Stark key'),
    });
    expect(readContract).toHaveBeenCalledTimes(1);
  });
  it('stays an error when a listed asset cannot be read and nothing was found', async () => {
    const { ctx } = context((r) =>
      r.functionName === 'getWithdrawalBalance'
        ? 0n
        : r.functionName === 'getAssetInfo' && r.args?.[0] === ASSETS[1].id
          ? '0x8322fff2'
          : undefined,
    );
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'error',
      reason: expect.stringContaining('limited check'),
    });
  });
  it.each(['0x1111111111111111111111111111111111111111', 'bad'])(
    'does not assign a mismatched or unresolved recipient: %s',
    async (recipient) => {
      const { ctx, readContract } = context((r) =>
        r.functionName === 'getEthKey' ? recipient : undefined,
      );
      expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
      expect(readContract).toHaveBeenCalledTimes(1);
    },
  );
  it('preserves ETH with a partial warning if another registered asset cannot be resolved', async () => {
    const { ctx } = context((r) =>
      r.functionName === 'getAssetInfo' && r.args?.[0] === ASSETS[1].id ? '0x8322fff2' : undefined,
    );
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.stringContaining('Some listed assets'),
    });
  });
  it('does not count a positive balance whose asset identity is unknown', async () => {
    const { ctx } = context((r) => (r.functionName === 'getAssetInfo' ? '0x' : undefined));
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
  });
  it('does not price a token using another asset ID or multiply USDC by a quantum', async () => {
    const { ctx } = context((r) =>
      r.functionName === 'getWithdrawalBalance'
        ? r.args?.[1] === ASSETS[2].id
          ? 1_500_000n
          : 0n
        : undefined,
    );
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { raw: 1500000n, decimals: 6, symbol: 'USDC' } }],
    });
    expect(ctx.priceUsd).toHaveBeenCalledWith('ethereum', ASSETS[2].token);
  });
  it('bounds discovery to one key and three verified assets, without logs, API or proxy', async () => {
    const { ctx, readContract } = context();
    await immutableWithdrawalsCheck.check(owner, ctx);
    expect(
      readContract.mock.calls.filter(([r]) => r.functionName === 'getWithdrawalBalance'),
    ).toHaveLength(3);
    expect(new Set(readContract.mock.calls.map(([r]) => r.to))).toEqual(
      new Set([IMMUTABLE_BRIDGE]),
    );
  });
  it('returns error on RPC failures and malformed balances, not nothing', async () => {
    for (const value of [Error('offline'), -1n, '0']) {
      const { ctx } = context((r) =>
        r.functionName === 'getWithdrawalBalance' ? value : undefined,
      );
      expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
    }
  });
  it('keeps a finding when prices fail and never reads an invalid input', async () => {
    const { ctx, readContract } = context();
    expect(await immutableWithdrawalsCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
    ctx.priceUsd = async () => {
      throw Error('offline');
    };
    ctx.gasCostUsd = async () => null;
    expect(await immutableWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ valueUsd: null, claimCostUsd: null }],
    });
  });
});
