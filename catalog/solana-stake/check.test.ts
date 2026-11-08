import type { CheckContext } from '@deficheckup/engine';
import { SOLANA_CLOCK, SOLANA_STAKE_HISTORY, solanaStakeParams } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { solanaStakeCheck } from './check';
import recorded from './recorded.json';
import { effectiveStake, U64_MAX } from './activation';

function context() {
  const data = structuredClone(recorded);
  const solanaRpc = vi.fn(async (method: string, params: readonly unknown[]) => {
    if (method === 'getProgramAccounts') return data.accounts;
    if (params[0] === SOLANA_CLOCK) return data.clock;
    if (params[0] === SOLANA_STAKE_HISTORY) return data.history;
    throw new Error('Unexpected RPC');
  });
  const priceUsd = vi.fn(async (): Promise<number | null> => 100);
  return { data, solanaRpc, priceUsd, ctx: { solanaRpc, priceUsd } as unknown as CheckContext };
}

// Mutations below are synthetic edge cases based on the recorded 200-byte mainnet accounts.
function changeAccount(
  data: ReturnType<typeof context>['data'],
  index: number,
  changes: {
    variant?: number;
    activation?: bigint;
    deactivation?: bigint;
    lockupEpoch?: bigint;
    timestamp?: bigint;
  },
) {
  const account = data.accounts.value[index]!.account;
  const bytes = Buffer.from(account.data[0]!, 'base64');
  if (changes.variant !== undefined) bytes.writeUInt32LE(changes.variant, 0);
  if (changes.activation !== undefined) bytes.writeBigUInt64LE(changes.activation, 164);
  if (changes.deactivation !== undefined) bytes.writeBigUInt64LE(changes.deactivation, 172);
  if (changes.lockupEpoch !== undefined) bytes.writeBigUInt64LE(changes.lockupEpoch, 84);
  if (changes.timestamp !== undefined) bytes.writeBigInt64LE(changes.timestamp, 76);
  account.data[0] = bytes.toString('base64');
}

describe('Solana native stake', () => {
  it('reads the recorded public withdrawer at offset 44 and explains active stake', async () => {
    const { ctx, solanaRpc } = context();
    const result = await solanaStakeCheck.check(recorded.address, ctx);
    expect(result).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('Deactivate it first'),
    });
    expect(solanaRpc).toHaveBeenCalledWith(
      'getProgramAccounts',
      solanaStakeParams(recorded.address),
    );
    expect(solanaRpc).toHaveBeenCalledTimes(3);
  });
  it('finds full inactive balances, including the reserve, with the base fee only', async () => {
    const { data, ctx, priceUsd } = context();
    changeAccount(data, 0, { deactivation: 1073n });
    data.accounts.value = [data.accounts.value[0]!];
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'SOL in a withdrawable native stake account',
          network: 'solana',
          amount: { raw: 3_544_534_593n, decimals: 9, symbol: 'SOL' },
          valueUsd: expect.closeTo(354.4534593, 8) as number,
          claimCostUsd: 0.0005,
          deadline: null,
          heldBy: '6v5cA5XRTLmWwsXnKD6e1nCybqq7sdViuzrzU6HLnvQY',
          note: "Includes all account lamports, including the rent reserve, when the account is fully withdrawn and closed. The withdrawer's signature is required in a trusted wallet. Fee estimate: one signature per account, 0.000005 SOL each. Priority fees and extra signatures cost more; batching can cost less.",
        },
      ],
    });
    expect(priceUsd).toHaveBeenCalledWith('solana', 'native');
  });
  it('includes initialized accounts without a delegation', async () => {
    const { data, ctx } = context();
    changeAccount(data, 0, { variant: 1 });
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { raw: 3_544_534_593n } }],
      notices: [expect.stringContaining('active')],
    });
  });
  it('does not mistake the deactivation epoch itself for finished cooldown', async () => {
    const { data, ctx } = context();
    changeAccount(data, 0, { deactivation: 1074n });
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('still deactivating'),
    });
  });
  it('respects both lockup conditions, even when the stake is inactive', async () => {
    for (const changes of [{ lockupEpoch: 1075n }, { timestamp: 2_000_000_000n }]) {
      const { data, ctx } = context();
      changeAccount(data, 0, { variant: 1, ...changes });
      expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({
        kind: 'nothing',
        note: expect.stringContaining('lockup is still in force'),
      });
    }
  });
  it('allows a lockup override when the withdrawer is also the custodian', async () => {
    const { data, ctx } = context();
    changeAccount(data, 0, { variant: 1, lockupEpoch: 1075n });
    const bytes = Buffer.from(data.accounts.value[0]!.account.data[0]!, 'base64');
    bytes.copy(bytes, 92, 44, 76);
    data.accounts.value[0]!.account.data[0] = bytes.toString('base64');
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ note: expect.stringContaining('also the lockup custodian') }],
    });
  });
  it('keeps a finding without a price and marks incomplete lists', async () => {
    const { data, ctx, priceUsd } = context();
    changeAccount(data, 0, { variant: 1 });
    priceUsd.mockResolvedValue(null);
    Object.assign(data.accounts, { truncated: true });
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
      findings: [{ valueUsd: null, claimCostUsd: null }],
    });
  });
  it('fails closed on a wrong withdrawer, unsafe lamports, duplicate or broken history', async () => {
    for (const broken of ['authority', 'lamports', 'duplicate', 'history']) {
      const { data, ctx } = context();
      if (broken === 'authority') returnExpectAuthority(data);
      if (broken === 'lamports')
        data.accounts.value[0]!.account.lamports = Number.MAX_SAFE_INTEGER + 1;
      if (broken === 'duplicate') data.accounts.value.push(data.accounts.value[0]!);
      if (broken === 'history') data.history.value.data[0] = '';
      expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
    }
  });
  it('does not turn an RPC failure into nothing', async () => {
    const { ctx, solanaRpc } = context();
    solanaRpc.mockRejectedValue(new Error('RPC failed'));
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toMatchObject({ kind: 'error' });
  });
  it('reports nothing for an empty, successfully read list', async () => {
    const { data, ctx } = context();
    data.accounts.value = [];
    expect(await solanaStakeCheck.check(recorded.address, ctx)).toEqual({ kind: 'nothing' });
  });
  it('rejects EVM and invalid addresses without RPC calls', async () => {
    const { ctx, solanaRpc } = context();
    for (const address of ['invalid', '0x000000000000000000000000000000000000dEaD'])
      expect(await solanaStakeCheck.check(address, ctx)).toMatchObject({ kind: 'error' });
    expect(solanaRpc).not.toHaveBeenCalled();
  });
});

function returnExpectAuthority(data: ReturnType<typeof context>['data']) {
  for (const entry of data.accounts.value) {
    const bytes = Buffer.from(entry.account.data[0]!, 'base64');
    bytes[44] = bytes[44]! ^ 1;
    entry.account.data[0] = bytes.toString('base64');
  }
}

describe('official stake activation arithmetic', () => {
  it('limits cooldown across multiple epochs instead of releasing it all after one', () => {
    const d = { stake: 1000n, activation: 1n, deactivation: 100n };
    const history = new Map([
      [100n, { effective: 1000n, activating: 0n, deactivating: 1000n }],
      [101n, { effective: 1000n, activating: 0n, deactivating: 1000n }],
    ]);
    expect(effectiveStake(d, 101n, history)).toBe(910n);
    expect(effectiveStake(d, 102n, history)).toBe(829n);
  });
  it('handles immediate deactivation, bootstrap, and aged-out cooldown', () => {
    expect(
      effectiveStake({ stake: 100n, activation: 100n, deactivation: 100n }, 100n, new Map()),
    ).toBe(0n);
    expect(
      effectiveStake({ stake: 100n, activation: U64_MAX, deactivation: U64_MAX }, 100n, new Map()),
    ).toBe(100n);
    expect(
      effectiveStake({ stake: 100n, activation: 1n, deactivation: 2n }, 1000n, new Map()),
    ).toBe(0n);
  });
});
