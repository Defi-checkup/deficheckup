import type { CheckContext } from '@deficheckup/engine';
import {
  SOLANA_TOKEN_PROGRAM,
  SOLANA_TOKEN_2022_PROGRAM,
  solanaTokenParams,
} from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { solanaRentCheck } from './check';
import recorded from './recorded.json';

function context() {
  const data = structuredClone(recorded);
  const solanaRpc = vi.fn(async (_method: string, params: readonly unknown[]) =>
    (params[1] as { programId: string }).programId === SOLANA_TOKEN_PROGRAM
      ? data.tokens
      : data.tokens2022,
  );
  const priceUsd = vi.fn(async (): Promise<number | null> => 100);
  return { data, solanaRpc, priceUsd, ctx: { solanaRpc, priceUsd } as unknown as CheckContext };
}

describe('Solana token rent', () => {
  it('sums actual recorded balances, and uses both full program filters', async () => {
    const { ctx, solanaRpc } = context();
    expect(await solanaRentCheck.check(recorded.address, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'SOL rent in 1 empty token account',
          network: 'solana',
          amount: { raw: 1_488_440n, decimals: 9, symbol: 'SOL' },
          valueUsd: 0.148844,
          claimCostUsd: 0.0005,
          deadline: null,
          note: "Closing these accounts returns their actual lamport balances. The owner's signature is required in a wallet or tool they trust. DeFi Checkup never asks you to connect or sign. Fee estimate: one signature per account, 0.000005 SOL each. Priority fees and extra signatures cost more; batching can cost less.",
        },
      ],
    });
    for (const program of [SOLANA_TOKEN_PROGRAM, SOLANA_TOKEN_2022_PROGRAM])
      expect(solanaRpc).toHaveBeenCalledWith(
        'getTokenAccountsByOwner',
        solanaTokenParams(recorded.address, program),
      );
  });
  it('includes empty Token-2022 accounts with immutable owners and frozen zero-balance accounts', async () => {
    const { data, ctx } = context();
    data.tokens.value[0]!.account.data.parsed.info.state = 'frozen';
    data.tokens2022.value[0]!.account.data.parsed.info.tokenAmount.amount = '0';
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [
        {
          title: 'SOL rent in 2 empty token accounts',
          amount: { raw: 3_002_280n },
          claimCostUsd: 0.001,
        },
      ],
    });
  });
  it('reports nothing for successfully read empty lists', async () => {
    const { data, ctx } = context();
    data.tokens.value = [];
    data.tokens2022.value = [];
    expect(await solanaRentCheck.check(recorded.address, ctx)).toEqual({ kind: 'nothing' });
  });
  it('excludes accounts with a different close authority', async () => {
    const { data, ctx } = context();
    Object.assign(data.tokens.value[0]!.account.data.parsed.info, {
      closeAuthority: '11111111111111111111111111111111',
    });
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('another close authority'),
    });
  });
  it('does not count withheld fees as closable, but accepts a zero withheld amount', async () => {
    const { data, ctx } = context();
    const info = data.tokens2022.value[0]!.account.data.parsed.info;
    info.tokenAmount.amount = '0';
    const extension = { extension: 'transferFeeAmount', state: { withheldAmount: '10' } };
    Object.assign(info, { extensions: [extension] });
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { raw: 1_488_440n } }],
      notices: [expect.stringContaining('withheld')],
    });
    extension.state.withheldAmount = '0';
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { raw: 3_002_280n } }],
    });
  });
  it('excludes unknown and confidential extensions and marks results incomplete', async () => {
    for (const extension of ['confidentialTransferAccount', 'futureExtension']) {
      const { data, ctx } = context();
      const info = data.tokens2022.value[0]!.account.data.parsed.info;
      info.tokenAmount.amount = '0';
      Object.assign(info, { extensions: [{ extension }] });
      expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
        kind: 'found',
        partial: expect.any(String),
        findings: [{ amount: { raw: 1_488_440n } }],
      });
    }
  });
  it('keeps a found program if the other fails, and errors when no program can be read', async () => {
    const { ctx, solanaRpc } = context();
    solanaRpc.mockRejectedValueOnce(new Error('limited'));
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
    solanaRpc.mockResolvedValueOnce(recorded.tokens).mockRejectedValueOnce(new Error('limited'));
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
    solanaRpc.mockRejectedValue(new Error('limited'));
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
  });
  it('keeps an unpriced refund', async () => {
    const { ctx, priceUsd } = context();
    priceUsd.mockResolvedValue(null);
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ valueUsd: null, claimCostUsd: null }],
    });
  });
  it('does not report malformed balances or the wrong owner as nothing', async () => {
    for (const bad of ['balance', 'owner', 'lamports']) {
      const { data, ctx } = context();
      if (bad === 'balance')
        data.tokens.value[0]!.account.data.parsed.info.tokenAmount.amount = 'NaN';
      if (bad === 'owner')
        data.tokens.value[0]!.account.data.parsed.info.owner = '11111111111111111111111111111111';
      if (bad === 'lamports') data.tokens.value[0]!.account.lamports = Number.MAX_SAFE_INTEGER + 1;
      expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
    }
  });
  it('stops after 500 accounts and marks the total partial', async () => {
    const { data, ctx } = context();
    const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const entry = data.tokens.value[0]!;
    data.tokens.value = Array.from({ length: 501 }, (_, i) => ({
      ...structuredClone(entry),
      pubkey: entry.pubkey.slice(0, -2) + base58[Math.floor(i / 58)]! + base58[i % 58]!,
    }));
    expect(await solanaRentCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
      findings: [{ title: 'SOL rent in 500 empty token accounts', amount: { raw: 744_220_000n } }],
    });
  });
  it('rejects an invalid address without RPC reads', async () => {
    const { ctx, solanaRpc } = context();
    expect(await solanaRentCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(solanaRpc).not.toHaveBeenCalled();
  });
});
