import type { CheckContext } from '@deficheckup/engine';
import {
  solanaJupiterLockParams,
  solanaTokenParams,
  SOLANA_TOKEN_PROGRAM,
  SOLANA_TOKEN_2022_PROGRAM,
  JUPITER_LOCK_READ_CAP,
} from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import { jupiterLockCheck } from './check';
import recorded from './recorded.json';

function context() {
  const data = structuredClone(recorded.response.result);
  const tokens = structuredClone(recorded.tokens.response.result);
  const solanaRpc = vi.fn(async (method: string) =>
    method === 'getProgramAccounts' ? data : tokens,
  );
  return { data, tokens, solanaRpc, ctx: { solanaRpc } as unknown as CheckContext };
}
// These mutations are synthetic edge cases, not additional on-chain fixtures.
function mutate(data: ReturnType<typeof context>['data'], edit: (b: Buffer) => void) {
  const a = data.value[0]!.account;
  const b = Buffer.from(a.data[0]!, 'base64');
  edit(b);
  a.data[0] = b.toString('base64');
}
describe('Jupiter Lock', () => {
  it('matches the recorded deployed IDL layout, discriminator and recipient before decoding', () => {
    const a = recorded.idl.response.result.value;
    expect(a.owner).toBe(recorded.request.params[0]);
    const bytes = Buffer.from(a.data[0]!, 'base64');
    const compressedLength = bytes.readUInt32LE(40);
    const idl = JSON.parse(inflateSync(bytes.subarray(44, 44 + compressedLength)).toString()) as {
      address: string;
      accounts: { name: string; discriminator: number[] }[];
      types: {
        name: string;
        type: { fields: { name: string; type: string | { array: [string, number] } }[] };
      }[];
    };
    expect(idl.address).toBe(recorded.request.params[0]);
    expect(idl.types.find((t) => t.name === 'VestingEscrow')!.type.fields.slice(0, 4)).toEqual([
      { name: 'recipient', docs: ['recipient address'], type: 'pubkey' },
      { name: 'token_mint', docs: ['token mint'], type: 'pubkey' },
      { name: 'creator', docs: ['creator of the escrow'], type: 'pubkey' },
      { name: 'base', docs: ['escrow base key'], type: 'pubkey' },
    ]);
    const account = Buffer.from(recorded.response.result.value[0]!.account.data[0]!, 'base64');
    expect([...account.subarray(0, 8)]).toEqual(
      idl.accounts.find((a) => a.name === 'VestingEscrow')!.discriminator,
    );
    expect(account.length).toBe(296);
    const widths: Record<string, number> = { pubkey: 32, u8: 1, u64: 8, u128: 16 };
    const offsets: Record<string, number> = {};
    let offset = 8;
    for (const field of idl.types.find((t) => t.name === 'VestingEscrow')!.type.fields) {
      offsets[field.name] = offset;
      offset +=
        typeof field.type === 'string'
          ? widths[field.type]!
          : widths[field.type.array[0]]! * field.type.array[1];
    }
    expect(offset).toBe(296);
    expect(offsets).toMatchObject({
      recipient: 8,
      token_mint: 40,
      update_recipient_mode: 137,
      cancel_mode: 138,
      token_program_flag: 139,
      cliff_time: 144,
      frequency: 152,
      cliff_unlock_amount: 160,
      amount_per_period: 168,
      number_of_period: 176,
      total_claimed_amount: 184,
      vesting_start_time: 192,
      cancelled_at: 200,
    });
  });
  it('proves the public recipient escrow is funded without calling its allocation withdrawable', async () => {
    const { ctx, solanaRpc } = context();
    expect(solanaJupiterLockParams(recorded.address)).toEqual(recorded.request.params);
    expect(await jupiterLockCheck.check(recorded.address, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'Funded Jupiter Lock escrow naming you as recipient',
          network: 'solana',
          amount: null,
          valueUsd: null,
          claimCostUsd: null,
          deadline: null,
          heldBy: recorded.response.result.value[0]!.pubkey,
          note: expect.stringContaining('No withdrawable token amount'),
        },
      ],
    });
    expect(solanaRpc).toHaveBeenNthCalledWith(1, 'getProgramAccounts', recorded.request.params);
    expect(solanaRpc).toHaveBeenNthCalledWith(
      2,
      'getTokenAccountsByOwner',
      solanaTokenParams(recorded.response.result.value[0]!.pubkey, SOLANA_TOKEN_PROGRAM),
    );
  });
  it('returns nothing only for successful empty or exhausted allocations and unfunded escrows', async () => {
    for (const change of ['empty', 'claimed', 'zero', 'different-mint']) {
      const { ctx, data, tokens, solanaRpc } = context();
      if (change === 'empty') data.value = [];
      if (change === 'claimed') mutate(data, (b) => b.writeBigUInt64LE(26438600000n, 184));
      if (change === 'zero') tokens.value[0]!.account.data.parsed.info.tokenAmount.amount = '0';
      if (change === 'different-mint')
        tokens.value[0]!.account.data.parsed.info.mint = recorded.address;
      expect(await jupiterLockCheck.check(recorded.address, ctx)).toEqual({ kind: 'nothing' });
      if (change === 'empty' || change === 'claimed') expect(solanaRpc).toHaveBeenCalledTimes(1);
    }
  });
  it('keeps cancelled and frozen positions unpriced with explicit restrictions', async () => {
    const { ctx, data, tokens } = context();
    mutate(data, (b) => b.writeBigUInt64LE(1729000000n, 200));
    tokens.value[0]!.account.data.parsed.info.state = 'frozen';
    expect(await jupiterLockCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: null, note: expect.stringContaining('records a cancellation') }],
    });
    const outcome = await jupiterLockCheck.check(recorded.address, ctx);
    if (outcome.kind === 'found') expect(outcome.findings[0].note).toContain('frozen');
  });
  it('reads Token-2022 with its declared program and leaves transfer restrictions and future vesting unquantified', async () => {
    const { ctx, data, tokens, solanaRpc } = context();
    mutate(data, (b) => {
      b[139] = 1;
      b.writeBigUInt64LE(4000000000n, 144);
    });
    tokens.value[0]!.account.owner = SOLANA_TOKEN_2022_PROGRAM;
    const result = await jupiterLockCheck.check(recorded.address, ctx);
    expect(result).toMatchObject({
      kind: 'found',
      findings: [{ amount: null, note: expect.stringContaining('Token-2022 transfer fees') }],
    });
    expect(solanaRpc).toHaveBeenLastCalledWith(
      'getTokenAccountsByOwner',
      solanaTokenParams(recorded.response.result.value[0]!.pubkey, SOLANA_TOKEN_2022_PROGRAM),
    );
  });
  it('rejects invalid identity, layout, modes, amounts and duplicate responses', async () => {
    for (const change of [
      'recipient',
      'discriminator',
      'size',
      'owner',
      'mode',
      'overflow',
      'overclaimed',
      'duplicate',
      'lamports',
    ]) {
      const { ctx, data } = context();
      if (change === 'recipient')
        mutate(data, (b) => {
          b[8] = b[8]! ^ 1;
        });
      if (change === 'discriminator')
        mutate(data, (b) => {
          b[0] = 0;
        });
      if (change === 'size') data.value[0]!.account.data[0] = '';
      if (change === 'owner') data.value[0]!.account.owner = recorded.address;
      if (change === 'mode')
        mutate(data, (b) => {
          b[139] = 2;
        });
      if (change === 'overflow') mutate(data, (b) => b.fill(255, 160, 184));
      if (change === 'overclaimed') mutate(data, (b) => b.writeBigUInt64LE(26438600001n, 184));
      if (change === 'duplicate') data.value.push(data.value[0]!);
      if (change === 'lamports') data.value[0]!.account.lamports = Number.MAX_SAFE_INTEGER + 1;
      expect(await jupiterLockCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
    }
  });
  it('keeps token failures and wrong token authorities out of successful empty results', async () => {
    for (const change of ['owner', 'program', 'amount', 'state', 'failed']) {
      const { ctx, tokens, solanaRpc } = context();
      const token = tokens.value[0]!.account;
      if (change === 'owner') token.data.parsed.info.owner = recorded.address;
      if (change === 'program') token.owner = recorded.address;
      if (change === 'amount') token.data.parsed.info.tokenAmount.amount = '18446744073709551616';
      if (change === 'state') token.data.parsed.info.state = 'uninitialized';
      if (change === 'failed')
        solanaRpc.mockImplementation(async (method) => {
          if (method === 'getTokenAccountsByOwner') throw new Error('Unavailable');
          return context().data;
        });
      expect(await jupiterLockCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
    }
  });
  it('bounds token lookups and marks cap or truncated token lists incomplete', async () => {
    const { ctx, data, tokens, solanaRpc } = context();
    const account = data.value[0]!.account;
    const pubkey = data.value[0]!.pubkey;
    // Synthetic unique public keys, never queried on-chain. Reuse account contents only offline.
    data.value = Array.from({ length: JUPITER_LOCK_READ_CAP + 1 }, (_, i) => ({
      pubkey: `${pubkey.slice(0, -1)}${'123456'[i]}`,
      account,
    }));
    solanaRpc.mockImplementation(async (method, ...args: unknown[]) => {
      if (method === 'getProgramAccounts') return data;
      const owner = (args[0] as readonly unknown[])[0] as string;
      const answer = structuredClone(tokens);
      answer.value[0]!.account.data.parsed.info.owner = owner;
      return answer;
    });
    const outcome = await jupiterLockCheck.check(recorded.address, ctx);
    expect(outcome).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
    if (outcome.kind === 'found') expect(outcome.findings).toHaveLength(JUPITER_LOCK_READ_CAP);
    expect(solanaRpc).toHaveBeenCalledTimes(1 + JUPITER_LOCK_READ_CAP);
    const c = context();
    Object.assign(c.tokens, { truncated: true });
    expect(await jupiterLockCheck.check(recorded.address, c.ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
    c.tokens.value = [];
    expect(await jupiterLockCheck.check(recorded.address, c.ctx)).toMatchObject({ kind: 'error' });
  });
  it('keeps a successful funded position when another token lookup fails', async () => {
    const { ctx, data, tokens, solanaRpc } = context();
    data.value.push({ ...data.value[0]!, pubkey: recorded.address });
    solanaRpc.mockImplementation(async (method, ...args: unknown[]) => {
      if (method === 'getProgramAccounts') return data;
      if ((args[0] as readonly unknown[])[0] === recorded.address) throw new Error('Unavailable');
      return tokens;
    });
    const outcome = await jupiterLockCheck.check(recorded.address, ctx);
    expect(outcome).toMatchObject({ kind: 'found', partial: expect.any(String) });
    if (outcome.kind === 'found') expect(outcome.findings).toHaveLength(1);
  });
  it('rejects invalid inputs without RPC and reports RPC failures', async () => {
    const { ctx, solanaRpc } = context();
    expect(await jupiterLockCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(solanaRpc).not.toHaveBeenCalled();
    solanaRpc.mockRejectedValue(new Error('Unavailable'));
    expect(await jupiterLockCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
  });
});
