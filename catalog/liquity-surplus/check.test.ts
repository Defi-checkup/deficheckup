import type { CheckContext } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { BORROWER_OPERATIONS, COLL_SURPLUS_POOL, liquitySurplusCheck } from './check';
import recorded from './recorded.json';

// Public CollBalanceUpdated recipient, provenance and pinned raw reads in recorded.json.
const owner = recorded.owner;
const credit = BigInt(
  recorded.reads.find((r) => r.signature.startsWith('function getCollateral'))!.result!,
);
const backing = BigInt(
  recorded.reads.find((r) => r.signature.startsWith('function getETH'))!.result!,
);
function context(balance: unknown = credit, pool: unknown = backing) {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) =>
    functionName === 'getCollateral' ? balance : pool,
  );
  const ctx = {
    readContract,
    priceUsd: vi.fn(async () => 3000),
    gasCostUsd: vi.fn(async () => 1),
  } as unknown as CheckContext;
  return { ctx, readContract };
}
describe('Liquity V1 surplus', () => {
  it('replays the public credit with the correct pool, full owner and estimated gas', async () => {
    const { ctx, readContract } = context();
    expect(await liquitySurplusCheck.check(owner, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'ETH collateral surplus in Liquity V1',
          network: 'ethereum',
          amount: { raw: 6055081726068459915n, decimals: 18, symbol: 'ETH' },
          valueUsd: expect.closeTo(18165.24517820538, 6),
          claimCostUsd: 1,
          deadline: null,
          heldBy: COLL_SURPLUS_POOL,
          note: expect.stringContaining('BorrowerOperations'),
        },
      ],
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        to: COLL_SURPLUS_POOL,
        functionName: 'getCollateral',
        args: [owner],
      }),
    );
    expect(ctx.gasCostUsd).toHaveBeenCalledWith('ethereum', 100_000n);
    expect(recorded.reads.find((r) => r.signature === 'function claimCollateral()')).toMatchObject({
      to: BORROWER_OPERATIONS,
      from: owner,
      raw: '0x',
    });
  });
  it('returns nothing only for a successfully read zero credit', async () => {
    const { ctx } = context(0n);
    expect(await liquitySurplusCheck.check(owner, ctx)).toEqual({ kind: 'nothing' });
  });
  it('does not price an underbacked credit as recoverable ETH', async () => {
    const { ctx } = context(credit, 1n);
    expect(await liquitySurplusCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: null, valueUsd: null, claimCostUsd: null }],
    });
  });
  it.each([undefined, -1n, '0'])('rejects malformed credit %s', async (balance) => {
    const { ctx } = context(balance);
    if (balance === undefined) ctx.readContract = async () => undefined;
    expect(await liquitySurplusCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
  });
  it('keeps a finding when pricing and gas are unavailable', async () => {
    const { ctx } = context();
    ctx.priceUsd = async () => {
      throw Error('offline');
    };
    ctx.gasCostUsd = async () => {
      throw Error('offline');
    };
    expect(await liquitySurplusCheck.check(owner, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ valueUsd: null, claimCostUsd: null }],
    });
  });
  it('returns error for failed reads and invalid addresses', async () => {
    const { ctx, readContract } = context();
    expect(await liquitySurplusCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
    readContract.mockRejectedValue(Error('RPC unavailable'));
    expect(await liquitySurplusCheck.check(owner, ctx)).toMatchObject({ kind: 'error' });
  });
});
