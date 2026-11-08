import type { CheckContext } from '@deficheckup/engine';
import { solanaMarginfiParams, marginfiShares } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { marginfiCheck } from './check';
import recorded from './recorded.json';

function context() {
  const data = structuredClone(recorded.response.result);
  const solanaRpc = vi.fn(async () => data);
  return { data, solanaRpc, ctx: { solanaRpc } as unknown as CheckContext };
}
// Synthetic edge cases based on the real recorded account, never claimed as on-chain reads.
function mutate(data: ReturnType<typeof context>['data'], edit: (b: Buffer) => void) {
  const a = data.value[0]!.account;
  const b = Buffer.from(a.data[0]!, 'base64');
  edit(b);
  a.data[0] = b.toString('base64');
}
describe('marginfi', () => {
  it('finds real positive asset shares and warns about real borrowing, with no invented amount', async () => {
    const { ctx, solanaRpc } = context();
    expect(solanaMarginfiParams(recorded.address)).toEqual(recorded.request.params);
    expect(await marginfiCheck.check(recorded.address, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'Asset shares recorded in a marginfi account',
          network: 'solana',
          amount: null,
          valueUsd: null,
          claimCostUsd: null,
          deadline: null,
          heldBy: recorded.response.result.value[0]!.pubkey,
          note: expect.stringContaining('also has borrowing or an accrued borrowing premium'),
        },
      ],
    });
    expect(solanaRpc).toHaveBeenCalledExactlyOnceWith(
      'getProgramAccounts',
      recorded.request.params,
    );
  });
  it('keeps liabilities out of found amounts and reports only successful empty reads as nothing', async () => {
    const { ctx, data } = context();
    mutate(data, (b) => {
      for (let i = 0; i < 16; i++) b.fill(0, 112 + i * 104, 128 + i * 104);
    });
    expect(await marginfiCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('borrowing'),
    });
    data.value = [];
    expect(await marginfiCheck.check(recorded.address, ctx)).toEqual({ kind: 'nothing' });
  });
  it('does not interpret an inactive slot or negative signed shares as positive assets', async () => {
    const { ctx, data } = context();
    mutate(data, (b) => {
      for (let i = 0; i < 16; i++) b[72 + i * 104] = 0;
    });
    expect(await marginfiCheck.check(recorded.address, ctx)).toEqual({ kind: 'nothing' });
    const negative = new DataView(new Uint8Array(16).fill(255).buffer);
    expect(marginfiShares(negative, 0)).toBe(-1n);
    const c = context();
    mutate(c.data, (b) => {
      b.fill(255, 112, 128);
    });
    expect(await marginfiCheck.check(recorded.address, c.ctx)).toMatchObject({ kind: 'error' });
  });
  it('flags restrictions and truncation without hiding observed assets', async () => {
    const { ctx, data } = context();
    mutate(data, (b) => b.writeBigUInt64LE(64n, 1800));
    Object.assign(data, { truncated: true });
    expect(await marginfiCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
      findings: [{ note: expect.stringContaining('restrictions require inspection') }],
    });
  });
  it('fails closed on an incorrect discriminator, authority, owner, duplicate or unsafe balance', async () => {
    for (const change of ['discriminator', 'authority', 'owner', 'duplicate', 'balance']) {
      const { ctx, data } = context();
      if (change === 'discriminator')
        mutate(data, (b) => {
          b[0] = 0;
        });
      if (change === 'authority')
        mutate(data, (b) => {
          b[40] = b[40]! ^ 1;
        });
      if (change === 'owner') data.value[0]!.account.owner = recorded.address;
      if (change === 'duplicate') data.value.push(data.value[0]!);
      if (change === 'balance') data.value[0]!.account.lamports = Number.MAX_SAFE_INTEGER + 1;
      expect(await marginfiCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
    }
  });
  it('rejects invalid input without RPC and never hides RPC failures', async () => {
    const { ctx, solanaRpc } = context();
    expect(await marginfiCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(solanaRpc).not.toHaveBeenCalled();
    solanaRpc.mockRejectedValue(new Error('Unavailable'));
    expect(await marginfiCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
  });
});
