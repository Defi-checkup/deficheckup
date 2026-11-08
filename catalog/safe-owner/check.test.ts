import {
  SAFE_CHECK_BUDGET_MS,
  SAFE_REQUEST_SPACING_MS,
  type CheckContext,
} from '@deficheckup/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeOwnerCheck } from './check';

// Recorded response shapes from api.safe.global (2026-11-01, asked through our proxy), placeholder
// values and addresses.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const SAFE = '0x6666666666666666666666666666666666666666';
const SOLO = '0x7777777777777777777777777777777777777777';
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

type Answers = Record<string, unknown>;
// What each Safe contract answers to getOwners and getThreshold. A Safe missing here fails the read.
type Signers = Record<string, { owners: unknown[]; threshold: bigint }>;

const SIGNERS: Signers = {
  [SAFE]: { owners: [WALLET, SOLO, SAFE], threshold: 2n },
  [SOLO]: { owners: [WALLET], threshold: 1n },
};

// Safe's short names, to key the recorded answers by the service's own paths.
const SERVICES: Record<string, string> = {
  ethereum: 'eth',
  arbitrum: 'arb1',
  optimism: 'oeth',
  base: 'base',
  polygon: 'pol',
  gnosis: 'gno',
  bsc: 'bnb',
  avalanche: 'avax',
  zksync: 'zksync',
  linea: 'linea',
  scroll: 'scr',
  mantle: 'mantle',
  celo: 'celo',
};

function fakeContext(answers: Answers, failing: string[] = [], signers: Signers = SIGNERS) {
  // Receives the path the proxy would ask Safe for, so answers stay keyed like the service.
  const service = vi.fn(async (path: string) => {
    if (failing.some((f) => path.startsWith(f))) throw new Error('HTTP 503');
    if (path.includes('/owners/')) return answers[path] ?? { safes: [] };
    return answers[path];
  });
  // Answers like our proxy: all owner lists in one call (null where a network failed), or the
  // balances of one Safe.
  const proxy = vi.fn(async (route: string, body: Record<string, unknown>) => {
    if (route !== 'safe') throw new Error(`unexpected route ${route}`);
    const { network, kind, address } = body as { network: string; kind: string; address: string };
    if (kind === 'owner-safes') {
      const lists: Record<string, unknown> = {};
      for (const [name, short] of Object.entries(SERVICES)) {
        lists[name] = await service(`${short}/api/v1/owners/${address}/safes/`).then(
          (answer) => (answer as { safes?: unknown }).safes ?? null,
          () => null,
        );
      }
      return { lists };
    }
    return service(`${SERVICES[network]}/api/v1/safes/${address}/balances/?exclude_spam=true`);
  });
  const ctx: CheckContext = {
    readContract: async ({ to, functionName }) => {
      const safe = signers[to];
      if (!safe) throw new Error('execution reverted');
      return functionName === 'getOwners' ? safe.owners : safe.threshold;
    },
    nativeBalance: async () => 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy,
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    priceUsd: async (_network, token) => (token === 'native' ? 3000 : 1),
    gasCostUsd: async () => 0.05,
    fetchJson: async () => {
      throw new Error('unexpected fetchJson');
    },
  };
  return { ctx, service, proxy };
}

async function runSafe(...args: Parameters<typeof safeOwnerCheck.check>) {
  const pending = safeOwnerCheck.check(...args);
  await vi.runAllTimersAsync();
  return pending;
}

describe('safe-owner check', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('paces up to 20 balances and shares the queue across wallets in one scan', async () => {
    const { ctx, proxy } = fakeContext({
      [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: Array(10).fill(SOLO) },
      [`eth/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [],
    });
    const starts: number[] = [];
    ctx.proxy = async (route, body) => {
      if ((body as { kind: string }).kind === 'balances') starts.push(Date.now());
      return proxy(route, body as Record<string, unknown>);
    };
    const pending = Promise.all([
      safeOwnerCheck.check(WALLET, ctx),
      safeOwnerCheck.check(WALLET, ctx),
    ]);
    await vi.runAllTimersAsync();
    expect(await pending).toEqual([{ kind: 'nothing' }, { kind: 'nothing' }]);
    expect(starts).toHaveLength(20);
    starts.slice(1).forEach((start, i) => {
      expect(start - starts[i]!).toBeGreaterThanOrEqual(SAFE_REQUEST_SPACING_MS);
    });
  });

  it('keeps completed findings at 9 seconds and never starts queued balances after the deadline', async () => {
    const { ctx, proxy } = fakeContext({
      [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: Array(20).fill(SOLO) },
      [`eth/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: null, token: null, balance: '10000000000000000' },
      ],
    });
    let balances = 0;
    ctx.proxy = async (route, body) => {
      if ((body as { kind: string }).kind === 'balances' && ++balances > 1) {
        return new Promise(() => undefined);
      }
      return proxy(route, body as Record<string, unknown>);
    };
    const began = Date.now();
    const result = await runSafe(WALLET, ctx);
    expect(Date.now() - began).toBe(SAFE_CHECK_BUDGET_MS);
    expect(result).toMatchObject({
      kind: 'found',
      partial: 'Some Safes or networks could not be read.',
      failedNetworks: ['ethereum'],
      findings: [{ heldBy: SOLO }],
    });
    expect(balances).toBe(6);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(balances).toBe(6);
  });

  it('asks for the Safes on all 13 networks in one proxy call, with the full address', async () => {
    const { ctx, service, proxy } = fakeContext({});

    expect(await runSafe(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(service).toHaveBeenCalledTimes(13);
    expect(proxy).toHaveBeenCalledOnce();
    expect(proxy).toHaveBeenCalledWith('safe', { kind: 'owner-safes', address: WALLET });
  });

  it('finds tokens in Safes, saying when other owners must sign too', async () => {
    const { ctx } = fakeContext({
      [`arb1/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
      [`arb1/api/v1/safes/${SAFE}/balances/?exclude_spam=true`]: [
        { tokenAddress: null, token: null, balance: '0' },
        { tokenAddress: USDC_ARB, token: { symbol: 'USDC', decimals: 6 }, balance: '20000000' },
      ],
      [`scr/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
      [`scr/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: null, token: null, balance: '10000000000000000' },
      ],
    });

    expect(await runSafe(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'USDC in a Safe you co-own (needs 2 of 3 signatures)',
          network: 'arbitrum',
          amount: { raw: 20_000_000n, decimals: 6, symbol: 'USDC' },
          valueUsd: 20,
          claimCostUsd: 0.05,
          deadline: null,
          heldBy: SAFE,
        },
        {
          title: 'ETH in a Safe you own',
          network: 'scroll',
          amount: { raw: 10_000_000_000_000_000n, decimals: 18, symbol: 'ETH' },
          valueUsd: 30,
          claimCostUsd: 0.05,
          deadline: null,
          heldBy: SOLO,
        },
      ],
    });
  });

  it('reads the signers from the Safe contract, not from the service', async () => {
    const { ctx, service } = fakeContext({
      [`scr/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
      [`scr/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: null, token: null, balance: '10000000000000000' },
      ],
    });

    await runSafe(WALLET, ctx);

    // 13 owner lists plus one balance list: no request for the Safe's details.
    expect(service).toHaveBeenCalledTimes(14);
  });

  it('warns that other owners can move the funds alone', async () => {
    const { ctx } = fakeContext(
      {
        [`base/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
        [`base/api/v1/safes/${SAFE}/balances/?exclude_spam=true`]: [
          { tokenAddress: null, token: null, balance: '10000000000000000' },
        ],
      },
      [],
      { [SAFE]: { owners: [SOLO, WALLET], threshold: 1n } },
    );

    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'ETH in a Safe you share (any of its 2 owners can move it)' }],
    });
  });

  it('never says "you own" when the signers could not be read', async () => {
    const { ctx } = fakeContext(
      {
        [`base/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
        [`base/api/v1/safes/${SAFE}/balances/?exclude_spam=true`]: [
          { tokenAddress: null, token: null, balance: '10000000000000000' },
        ],
      },
      [],
      {},
    );

    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'ETH in a Safe that lists you as an owner (could not read who signs)' }],
      partial: 'For some Safes it is unknown who else can sign.',
      failedNetworks: ['base'],
    });
  });

  it.each([
    ['a malformed owner list', { owners: [null], threshold: 1n }],
    ['a threshold of zero', { owners: [WALLET], threshold: 0n }],
    ['a threshold above the owners', { owners: [WALLET], threshold: 2n }],
  ])('keeps the funds but does not describe the Safe on %s', async (_case, signers) => {
    const { ctx } = fakeContext(
      {
        [`base/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
        [`base/api/v1/safes/${SAFE}/balances/?exclude_spam=true`]: [
          { tokenAddress: null, token: null, balance: '10000000000000000' },
        ],
      },
      [],
      { [SAFE]: signers },
    );

    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'ETH in a Safe that lists you as an owner (could not read who signs)' }],
      partial: 'For some Safes it is unknown who else can sign.',
      failedNetworks: ['base'],
    });
  });

  it('drops a Safe the wallet is no longer an owner of', async () => {
    const { ctx } = fakeContext(
      {
        [`base/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
        [`base/api/v1/safes/${SAFE}/balances/?exclude_spam=true`]: [
          { tokenAddress: null, token: null, balance: '10000000000000000' },
        ],
      },
      [],
      { [SAFE]: { owners: [SOLO], threshold: 1n } },
    );

    expect(await runSafe(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('keeps what it found and says so when a network could not be read', async () => {
    const { ctx } = fakeContext(
      {
        [`scr/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
        [`scr/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
          { tokenAddress: null, token: null, balance: '10000000000000000' },
        ],
      },
      ['eth/'],
    );

    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Safes or networks could not be read.',
      failedNetworks: ['ethereum'],
    });
  });

  it('does not call it nothing when a network could not be read', async () => {
    const { ctx } = fakeContext({}, ['base/']);

    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'error',
      failedNetworks: ['base'],
    });
  });

  it('omits network attribution when the whole proxy request fails', async () => {
    const { ctx } = fakeContext({});
    ctx.proxy = async () => {
      throw new Error('HTTP 429');
    };
    expect(await runSafe(WALLET, ctx)).toEqual({
      kind: 'error',
      reason: 'Some Safes or networks could not be read.',
    });
  });

  it('names all affected networks when every per-network owner list fails', async () => {
    const { ctx } = fakeContext(
      {},
      Object.values(SERVICES).map((service) => `${service}/`),
    );
    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'error',
      failedNetworks: safeOwnerCheck.networks,
    });
  });

  it('names the network of failed balance reads and keeps successful networks separate', async () => {
    const { ctx } = fakeContext(
      {
        [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
        [`base/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
        [`base/api/v1/safes/${SAFE}/balances/?exclude_spam=true`]: [
          { tokenAddress: null, token: null, balance: '10000000000000000' },
        ],
      },
      [`eth/api/v1/safes/`],
    );
    expect(await runSafe(WALLET, ctx)).toMatchObject({
      kind: 'found',
      failedNetworks: ['ethereum'],
      findings: [{ network: 'base' }],
    });
  });

  it('attributes the Safe scan limit only to networks with skipped Safes', async () => {
    const { ctx } = fakeContext({
      [`base/api/v1/owners/${WALLET}/safes/`]: { safes: Array.from({ length: 20 }, () => SOLO) },
      [`base/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [],
      [`scr/api/v1/owners/${WALLET}/safes/`]: { safes: [SAFE] },
    });
    expect(await runSafe(WALLET, ctx)).toEqual({
      kind: 'error',
      reason: 'Only 20 of your 21 Safes were checked.',
      failedNetworks: ['scroll'],
    });
  });

  it('ignores dust worth less than a cent', async () => {
    const { ctx } = fakeContext({
      [`gno/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
      [`gno/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: USDC_ARB, token: { symbol: 'USDC', decimals: 6 }, balance: '5000' },
      ],
    });

    expect(await runSafe(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('asks with the checksum address even when it was pasted in lowercase', async () => {
    const { ctx, service } = fakeContext({});

    await runSafe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045', ctx);

    expect(service).toHaveBeenCalledWith(
      'eth/api/v1/owners/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/safes/',
    );
  });

  it('drops an unpriced token whose symbol uses lookalike letters', async () => {
    const { ctx } = fakeContext({
      [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
      [`eth/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: SAFE, token: { symbol: '\u0415R\u042120', decimals: 18 }, balance: '1' },
      ],
    });
    ctx.priceUsd = async () => null;

    expect(await runSafe(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('treats a malformed list or balance as not read, never as nothing', async () => {
    const badList = fakeContext({ [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: [123] } });
    expect(await runSafe(WALLET, badList.ctx)).toMatchObject({ kind: 'error' });

    const badBalance = fakeContext({
      [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
      [`eth/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: null, token: null, balance: 'broken' },
      ],
    });
    expect(await runSafe(WALLET, badBalance.ctx)).toMatchObject({ kind: 'error' });

    const noToken = fakeContext({
      [`eth/api/v1/owners/${WALLET}/safes/`]: { safes: [SOLO] },
      [`eth/api/v1/safes/${SOLO}/balances/?exclude_spam=true`]: [
        { tokenAddress: USDC_ARB, token: null, balance: '1000000' },
      ],
    });
    expect(await runSafe(WALLET, noToken.ctx)).toMatchObject({ kind: 'error' });
  });

  it('reports an error for an invalid address, without calling the service', async () => {
    const { ctx, proxy } = fakeContext({});

    expect(await runSafe('safe.eth', ctx)).toMatchObject({ kind: 'error' });
    expect(proxy).not.toHaveBeenCalled();
  });
});
