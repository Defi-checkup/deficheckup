import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { ribbonV2Check, VAULTS, VAULT_PAUSER } from './check';
import recorded from './recorded.json';
import extra from './extra-recorded.json';
const [eth, btc] = VAULTS;
const mature = recorded.owners[0]!;
const blocked = recorded.owners[1]!;
const revive = (v: unknown): unknown =>
  typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : Array.isArray(v) ? v.map(revive) : v;
type Override = (r: ReadRequest) => unknown;
function context(owner = mature, override?: Override) {
  const readContract = vi.fn(async (r: ReadRequest) => {
    const value = override?.(r);
    if (value instanceof Error) throw value;
    if (value !== undefined) return value;
    const reads = extra.selected.some((sample) => sample.owner === owner)
      ? extra.reads
      : recorded.reads;
    if (r.functionName === 'pausedPositions') {
      const read = reads.find(
        (x) =>
          x.to.toLowerCase() === r.to.toLowerCase() &&
          x.signature.startsWith('function pausedPositions(') &&
          x.args[0] === r.args?.[0] &&
          x.args[1] === owner,
      );
      if (!read) throw Error('No recorded pauser read');
      return revive(read.result);
    }
    const read = reads.find(
      (x) =>
        x.to.toLowerCase() === r.to.toLowerCase() &&
        x.signature.startsWith(`function ${r.functionName}(`) &&
        (!['withdrawals', 'depositReceipts', 'shareBalances'].includes(r.functionName) ||
          x.args[0] === owner),
    );
    if (!read) throw Error('No recorded read');
    return revive(read.result);
  });
  const ctx = {
    readContract,
    priceUsd: vi.fn(async () => 3000),
    gasCostUsd: vi.fn(async () => 1),
  } as unknown as CheckContext;
  return { ctx, readContract };
}
describe('Ribbon Theta V2', () => {
  it('replays a mature withdrawal using finalized round PPS with integer division', async () => {
    const { ctx, readContract } = context();
    const raw = (57335813513920471n * 747702522781092855n) / 10n ** 18n;
    expect(await ribbonV2Check.check(mature, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'Matured Ribbon ETH Call withdrawal (round 209)',
          network: 'ethereum',
          amount: { raw, decimals: 18, symbol: 'ETH' },
          valueUsd: (Number(raw) / 1e18) * 3000,
          claimCostUsd: 1,
          deadline: null,
          heldBy: eth.address,
          note: expect.stringContaining('completeWithdraw'),
        },
      ],
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: eth.address, functionName: 'withdrawals', args: [mature] }),
    );
    expect(ctx.gasCostUsd).toHaveBeenCalledWith('ethereum', 150_000n);
    expect(recorded.reads.find((r) => r.signature === 'function completeWithdraw()')).toMatchObject(
      { from: mature, raw: '0x' },
    );
  });
  it('retains the public Round not closed sample without valuing it as claimable', async () => {
    const { ctx, readContract } = context(blocked);
    expect(await ribbonV2Check.check(blocked, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('round 221 is not closed'),
    });
    expect(recorded.blocked).toContain('Round not closed');
    expect(readContract.mock.calls.some(([r]) => r.functionName === 'roundPricePerShare')).toBe(
      false,
    );
  });
  it('replays a real unredeemed receipt as shares, never ETH at a guessed price', async () => {
    const owner = extra.selected.find((x) => x.kind === 'unredeemed')!.owner;
    const { ctx } = context(owner);
    const result = await ribbonV2Check.check(owner, ctx);
    expect(result).toMatchObject({
      kind: 'found',
      findings: expect.arrayContaining([
        expect.objectContaining({
          title: 'Unredeemed Ribbon ETH Call shares',
          amount: { raw: 8835826627573461n, symbol: 'rETH-THETA', decimals: 18 },
          valueUsd: null,
          heldBy: eth.address,
        }),
      ]),
    });
    expect(ctx.gasCostUsd).toHaveBeenCalledWith('ethereum', 100_000n);
  });
  it('replays an independent paused receipt without counting it as a direct withdrawal', async () => {
    const owner = extra.selected.find((x) => x.kind === 'paused')!.owner;
    const { ctx } = context(owner);
    const result = await ribbonV2Check.check(owner, ctx);
    expect(result).toMatchObject({
      kind: 'found',
      findings: expect.arrayContaining([
        expect.objectContaining({
          title: 'Paused Ribbon ETH Call position',
          heldBy: VAULT_PAUSER,
          amount: { raw: 95750883482509153n, decimals: 18, symbol: 'rETH-THETA' },
          valueUsd: null,
          claimCostUsd: null,
        }),
      ]),
    });
  });
  it('keeps all four states distinct in a mixed result without double counting', async () => {
    const { ctx } = context(mature, (r) =>
      r.to === eth.address && r.functionName === 'depositReceipts'
        ? [221, 10n, 0n]
        : r.to === eth.address && r.functionName === 'shareBalances'
          ? [0n, 50n]
          : r.functionName === 'pausedPositions' && r.args?.[0] === eth.address
            ? [200, 100n]
            : undefined,
    );
    expect(await ribbonV2Check.check(mature, ctx)).toMatchObject({
      kind: 'found',
      findings: [
        { title: 'Paused Ribbon ETH Call position', valueUsd: null },
        { title: 'Unredeemed Ribbon ETH Call shares', valueUsd: null },
        { title: 'Matured Ribbon ETH Call withdrawal (round 209)' },
      ],
      notices: [expect.stringContaining('pending deposit')],
    });
  });
  it('preserves a finding when another vault fails and errors when nothing could be read', async () => {
    const { ctx } = context(mature, (r) => (r.to === btc.address ? Error('offline') : undefined));
    expect(await ribbonV2Check.check(mature, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.stringContaining('completely'),
    });
    const { ctx: failed } = context(mature, () => Error('offline'));
    expect(await ribbonV2Check.check(mature, failed)).toMatchObject({ kind: 'error' });
  });
  it('keeps known shares if a dependent payout read fails', async () => {
    const { ctx } = context(mature, (r) =>
      r.to === eth.address && r.functionName === 'shareBalances'
        ? [0n, 50n]
        : r.functionName === 'roundPricePerShare'
          ? Error('offline')
          : undefined,
    );
    expect(await ribbonV2Check.check(mature, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'Unredeemed Ribbon ETH Call shares' }],
      partial: expect.any(String),
    });
  });
  it('reports insufficient backing as an unpriced position', async () => {
    const { ctx } = context(mature, (r) => (r.functionName === 'balanceOf' ? 0n : undefined));
    expect(await ribbonV2Check.check(mature, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: expect.stringContaining('needs review'), amount: null, valueUsd: null }],
    });
  });
  it('checks only its finite verified list and rejects a changed pauser or malformed receipt', async () => {
    for (const override of [
      (r: ReadRequest) =>
        r.functionName === 'vaultPauser' ? '0x0000000000000000000000000000000000000000' : undefined,
      (r: ReadRequest) => (r.functionName === 'withdrawals' ? ['221', 1n] : undefined),
    ]) {
      const { ctx } = context(mature, override);
      expect(await ribbonV2Check.check(mature, ctx)).toMatchObject({ kind: 'error' });
    }
    const { ctx, readContract } = context(blocked);
    await ribbonV2Check.check(blocked, ctx);
    expect(
      new Set(
        readContract.mock.calls
          .filter(([r]) => r.functionName === 'withdrawals')
          .map(([r]) => r.to),
      ),
    ).toEqual(new Set(VAULTS.map((v) => v.address)));
  });
  it('preserves a payout with missing price or gas and rejects invalid inputs without RPC', async () => {
    const { ctx, readContract } = context();
    expect(await ribbonV2Check.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
    ctx.priceUsd = async () => {
      throw Error('offline');
    };
    ctx.gasCostUsd = async () => null;
    expect(await ribbonV2Check.check(mature, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ valueUsd: null, claimCostUsd: null }],
    });
  });
});
