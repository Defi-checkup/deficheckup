import { createCheckContext, type CheckContext, type ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { ETHEREUM_TOKENS } from '../shared/tokens';
import { instadappDsaCheck } from './check';

// Recorded shapes, placeholder addresses. Never a real user's wallet or DSA.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const DSA_A = '0x1111111111111111111111111111111111111111';
const DSA_B = '0x2222222222222222222222222222222222222222';
const STKAAVE = ETHEREUM_TOKENS.find((t) => t.symbol === 'stkAAVE')!.address;
const USDC = ETHEREUM_TOKENS.find((t) => t.symbol === 'USDC')!.address;

interface Chain {
  /** id -> [DSA address, next id] */
  dsas?: Record<string, [string, bigint]>;
  first?: bigint;
  /** holder -> token address (or "native") -> balance */
  balances?: Record<string, Record<string, bigint>>;
  failToken?: string;
}

function fakeContext({ dsas = {}, first = 0n, balances = {}, failToken }: Chain) {
  const readContract = vi.fn(async ({ functionName, args = [], to }: ReadRequest) => {
    if (functionName === 'userLink') {
      return [first, 0n, BigInt(Object.keys(dsas).length)];
    }
    if (functionName === 'userList') return [0n, dsas[String(args[1])]![1]];
    if (functionName === 'accountAddr') return dsas[String(args[0])]![0];
    if (functionName === 'balanceOf') {
      if (to === failToken) throw new Error('reverted');
      return balances[String(args[0])]?.[to] ?? 0n;
    }
    throw new Error(`unexpected ${functionName}`);
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 10_000);
  const ctx: CheckContext = {
    readContract,
    nativeBalance: async (_network, holder) => balances[holder]?.native ?? 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy: async () => {
      throw new Error('unexpected proxy');
    },
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    priceUsd: async (_network, token) => (token === 'native' ? 3000 : token === USDC ? 1 : 100),
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readContract, gasCostUsd };
}

describe('instadapp-dsa check', () => {
  it('reports nothing when the wallet owns no DSA, reading InstaList with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await instadappDsaCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0x4c8a1BEb8a87765788946D6B19C6C6355194AbEb',
        functionName: 'userLink',
        args: [WALLET],
      }),
    );
  });

  it('finds tokens and ETH left in a DSA, one finding each, with the DSA in full', async () => {
    const { ctx, gasCostUsd } = fakeContext({
      first: 25213n,
      dsas: { '25213': [DSA_A, 0n] },
      balances: { [DSA_A]: { [STKAAVE]: 88_800_000_000_000_000n, native: 10n ** 16n } },
    });

    const outcome = await instadappDsaCheck.check(WALLET, ctx);

    expect(outcome).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'ETH in Instadapp DSA #25213',
          network: 'ethereum',
          amount: { raw: 10n ** 16n, decimals: 18, symbol: 'ETH' },
          valueUsd: 30,
          claimCostUsd: 7,
          deadline: null,
          heldBy: DSA_A,
        },
        {
          title: 'stkAAVE in Instadapp DSA #25213',
          network: 'ethereum',
          amount: { raw: 88_800_000_000_000_000n, decimals: 18, symbol: 'stkAAVE' },
          valueUsd: expect.closeTo(8.88, 6),
          claimCostUsd: 17,
          deadline: null,
          heldBy: DSA_A,
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 170_000n);
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 70_000n);
  });

  it('walks every DSA of the owner', async () => {
    const { ctx } = fakeContext({
      first: 7n,
      dsas: { '7': [DSA_A, 9n], '9': [DSA_B, 0n] },
      balances: { [DSA_B]: { [USDC]: 5_000_000n } },
    });

    const outcome = await instadappDsaCheck.check(WALLET, ctx);

    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [{ title: 'USDC in Instadapp DSA #9', valueUsd: 5, heldBy: DSA_B }],
    });
  });

  it('marks only the token whose price request failed, preserving unknown and known siblings', async () => {
    const { ctx } = fakeContext({
      first: 1n,
      dsas: { '1': [DSA_A, 0n] },
      balances: { [DSA_A]: { native: 10n ** 18n, [STKAAVE]: 10n ** 18n, [USDC]: 5_000_000n } },
    });
    const fetchFn = vi.fn<typeof fetch>(async (url) => {
      const id = String(url).split('/').at(-1)!;
      if (id === 'coingecko:ethereum') return new Response('busy', { status: 503 });
      return Response.json({ coins: id.endsWith(USDC) ? { [id]: { price: 1 } } : {} });
    });
    const prices = createCheckContext({ fetchFn, estimateTimeoutMs: 20 });
    ctx.lookupPrice = prices.lookupPrice;
    const outcome = await instadappDsaCheck.check(WALLET, ctx);
    expect(outcome.kind).toBe('found');
    if (outcome.kind !== 'found') return;
    expect(outcome.findings).toHaveLength(3);
    const eth = outcome.findings.find((finding) => finding.amount?.symbol === 'ETH');
    const aave = outcome.findings.find((finding) => finding.amount?.symbol === 'stkAAVE');
    const usdc = outcome.findings.find((finding) => finding.amount?.symbol === 'USDC');
    expect(eth).toMatchObject({ valueUsd: null, priceStatus: 'unavailable' });
    expect(aave).toMatchObject({ valueUsd: null });
    expect(aave).not.toHaveProperty('priceStatus');
    expect(usdc).toMatchObject({ valueUsd: 5 });
    expect(usdc).not.toHaveProperty('priceStatus');
    expect(outcome).not.toHaveProperty('partial');
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('stops on a list that loops, without repeating a DSA', async () => {
    const { ctx, readContract } = fakeContext({
      first: 7n,
      dsas: { '7': [DSA_A, 7n] },
      balances: { [DSA_A]: { [USDC]: 5_000_000n } },
    });

    const outcome = await instadappDsaCheck.check(WALLET, ctx);

    expect(outcome.kind === 'found' && outcome.findings).toHaveLength(1);
    const walks = readContract.mock.calls.filter(([r]) => r.functionName === 'userList');
    expect(walks).toHaveLength(1);
  });

  it('says the scan is incomplete, not nothing, past 25 DSAs', async () => {
    const dsas: Record<string, [string, bigint]> = {};
    for (let i = 1; i <= 26; i++) dsas[String(i)] = [DSA_A, i < 26 ? BigInt(i + 1) : 0n];
    const { ctx } = fakeContext({ first: 1n, dsas });

    expect(await instadappDsaCheck.check(WALLET, ctx)).toEqual({
      kind: 'error',
      reason: 'Only 25 of your 26 Instadapp DSAs could be checked.',
    });
  });

  it('stops walking when its time budget runs out, and says so', async () => {
    let now = 0;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => (now += 1_500));
    const { ctx, readContract } = fakeContext({
      first: 1n,
      dsas: { '1': [DSA_A, 2n], '2': [DSA_A, 3n], '3': [DSA_A, 4n], '4': [DSA_A, 0n] },
    });

    const outcome = await instadappDsaCheck.check(WALLET, ctx);
    clock.mockRestore();

    expect(outcome).toMatchObject({
      kind: 'error',
      reason: expect.stringMatching(/^Only \d of your 4 Instadapp DSAs/),
    });
    const walks = readContract.mock.calls.filter(([r]) => r.functionName === 'userList');
    expect(walks.length).toBeLessThan(4);
  });

  it('ignores dust worth less than a cent', async () => {
    const { ctx } = fakeContext({
      first: 1n,
      dsas: { '1': [DSA_A, 0n] },
      balances: { [DSA_A]: { [USDC]: 5_000n } }, // 0.005 USDC
    });

    expect(await instadappDsaCheck.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('does not call it nothing when a balance could not be read', async () => {
    const { ctx } = fakeContext({ first: 1n, dsas: { '1': [DSA_A, 0n] }, failToken: USDC });

    expect(await instadappDsaCheck.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('still reports what it found when another balance fails', async () => {
    const { ctx } = fakeContext({
      first: 1n,
      dsas: { '1': [DSA_A, 0n] },
      balances: { [DSA_A]: { [STKAAVE]: 10n ** 18n } },
      failToken: USDC,
    });

    expect(await instadappDsaCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some balances of your Instadapp DSAs could not be read.',
    });
  });

  it('keeps what it found past 25 DSAs, and says the scan was partial', async () => {
    const dsas: Record<string, [string, bigint]> = {};
    for (let i = 1; i <= 26; i++)
      dsas[String(i)] = [i === 1 ? DSA_B : DSA_A, i < 26 ? BigInt(i + 1) : 0n];
    const { ctx } = fakeContext({ first: 1n, dsas, balances: { [DSA_B]: { [USDC]: 5_000_000n } } });

    expect(await instadappDsaCheck.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'USDC in Instadapp DSA #1' }],
      partial: 'Only 25 of your 26 Instadapp DSAs could be checked.',
    });
  });

  it('reads each DSA as soon as it is known, while the walk goes on', async () => {
    const { ctx, readContract } = fakeContext({
      first: 1n,
      dsas: { '1': [DSA_A, 2n], '2': [DSA_B, 0n] },
    });

    await instadappDsaCheck.check(WALLET, ctx);

    const calls = readContract.mock.calls.map(([r]) => r.functionName);
    expect(calls.indexOf('balanceOf')).toBeLessThan(calls.lastIndexOf('userList'));
  });

  it('reports an error for an invalid address, without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await instadappDsaCheck.check('0x1234', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
