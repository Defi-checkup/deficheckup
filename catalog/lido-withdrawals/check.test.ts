import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { lidoWithdrawalsCheck, MAX_REQUESTS, WITHDRAWAL_QUEUE } from './check';
import recorded from './recorded.json';
const owner = recorded.owner;
// Only uint256 values become bigint. Addresses and booleans remain exactly as recorded.
const revive = (v: unknown): unknown =>
  typeof v === 'string' && /^\d+$/.test(v)
    ? BigInt(v)
    : Array.isArray(v)
      ? v.map(revive)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))
        : v;
function context(overrides: Record<string, unknown> = {}) {
  const readContract = vi.fn(async ({ functionName }: ReadRequest) => {
    if (Object.hasOwn(overrides, functionName)) {
      const v = overrides[functionName];
      if (v instanceof Error) throw v;
      return v;
    }
    const read = recorded.reads.find((r) => r.signature.startsWith(`function ${functionName}(`));
    if (!read) throw Error(`Unexpected ${functionName}`);
    return revive(read.result);
  });
  const ctx = {
    readContract,
    priceUsd: vi.fn(async () => 3000),
    gasCostUsd: vi.fn(async () => 1),
  } as unknown as CheckContext;
  return { ctx, readContract };
}
const pending = {
  amountOfStETH: 100n,
  amountOfShares: 90n,
  owner,
  timestamp: 1n,
  isFinalized: false,
  isClaimed: false,
};
describe('Lido finalized withdrawals', () => {
  it('replays a real finalized NFT and uses claimable ETH, not nominal stETH', async () => {
    const { ctx, readContract } = context();
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'ETH from finalized Lido request #140174',
          network: 'ethereum',
          amount: { raw: 30134264486219968n, decimals: 18, symbol: 'ETH' },
          valueUsd: expect.closeTo(90.4027934586599, 8),
          claimCostUsd: 1,
          deadline: null,
          heldBy: WITHDRAWAL_QUEUE,
          note: expect.stringContaining('burns'),
        },
      ],
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: WITHDRAWAL_QUEUE, functionName: 'balanceOf', args: [owner] }),
    );
    expect(ctx.gasCostUsd).toHaveBeenCalledWith('ethereum', 150_000n);
    const { ctx: slashed } = context({
      getWithdrawalStatus: [{ ...pending, isFinalized: true, amountOfStETH: 999999999999999999n }],
      getClaimableEther: [1n],
    });
    expect(await lidoWithdrawalsCheck.check(owner, slashed)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { raw: 1n } }],
    });
  });
  it('avoids owner enumeration entirely above the cap', async () => {
    const { ctx, readContract } = context({ balanceOf: BigInt(MAX_REQUESTS + 1) });
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'error',
      reason: expect.stringContaining('completely'),
    });
    expect(readContract).toHaveBeenCalledTimes(1);
  });
  it('does not enumerate zero owners or invalid inputs', async () => {
    const { ctx, readContract } = context({ balanceOf: 0n });
    expect(await lidoWithdrawalsCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledTimes(1);
  });
  it('keeps pending requests distinct from claimable ETH', async () => {
    const { ctx } = context({ getWithdrawalStatus: [pending] });
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('awaiting finalization'),
    });
  });
  it('sorts IDs for hints and reports mixed pending requests separately', async () => {
    const { ctx, readContract } = context({
      balanceOf: 2n,
      getWithdrawalRequests: [140175n, 140174n],
      getWithdrawalStatus: [{ ...pending, isFinalized: true }, pending],
    });
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      notices: [expect.stringContaining('not included')],
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'findCheckpointHints',
        args: [[140174n], 1n, expect.any(BigInt)],
      }),
    );
  });
  it.each([
    { getWithdrawalRequests: [140174n, 140174n] },
    { getWithdrawalStatus: [{ ...pending, isClaimed: true }] },
    { getWithdrawalStatus: [{ ...pending, owner: '0x0000000000000000000000000000000000000000' }] },
    { getWithdrawalStatus: [{}] },
    { getClaimableEther: [-1n] },
    { getClaimableEther: [] },
    { getClaimableEther: [0n] },
    { findCheckpointHints: [0n] },
    { balanceOf: '1' },
    { getWithdrawalRequests: Error('offline') },
  ])('reports failed or inconsistent reads as incomplete: %s', async (overrides) => {
    const { ctx } = context(overrides);
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
  });
  it('stops discovery when the time budget is exhausted', async () => {
    const { ctx, readContract } = context();
    let now = 0;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => (now += 7000));
    try {
      expect(await lidoWithdrawalsCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
      expect(readContract).toHaveBeenCalledTimes(1);
    } finally {
      clock.mockRestore();
    }
  });
  it('does not lose claimable ETH when pricing fails', async () => {
    const { ctx } = context();
    ctx.priceUsd = async () => {
      throw Error('offline');
    };
    ctx.gasCostUsd = async () => null;
    expect(await lidoWithdrawalsCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ valueUsd: null, claimCostUsd: null }],
    });
  });
});
