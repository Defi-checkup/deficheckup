import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { compoundV2Check } from './check';

// Recorded shapes, placeholder addresses. Never a real user's wallet or proxy.
const WALLET = '0x000000000000000000000000000000000000dEaD';
const PROXY = '0x3333333333333333333333333333333333333333';
const ZERO = '0x0000000000000000000000000000000000000000';
const COMPTROLLER = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
const COMP = '0xc00e94Cb662C3520282E6f5717214004A7f26888';
const C_DAI = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const C_ETH = '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5';
const C_USDC = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const RATE = 10n ** 18n; // one cToken = one unit of the asset, to keep the numbers readable
const E18 = 10n ** 18n;

interface Account {
  /** cToken: [supplied, borrowed], in the asset's smallest unit. */
  positions?: Record<string, [bigint, bigint]>;
  accrued?: bigint;
  /** Markets used as collateral. */
  entered?: string[];
  /** cToken: where the account's COMP was last booked as a supplier. Defaults to the market index. */
  supplierIndex?: Record<string, bigint>;
  shortfall?: bigint;
}

interface Chain {
  accounts?: Record<string, Account>;
  proxy?: string;
  owner?: string;
  cash?: Record<string, bigint>;
  compInComptroller?: bigint;
  failAccount?: string;
  failCompBalance?: boolean;
  failCash?: boolean;
  /** cToken: the market's COMP supply index. */
  supplyIndex?: Record<string, bigint>;
}

function fakeContext({
  accounts = {},
  proxy = ZERO,
  owner = WALLET,
  cash = {},
  compInComptroller = 47_541_638_807_576n,
  failAccount,
  failCompBalance = false,
  failCash = false,
  supplyIndex = {},
}: Chain) {
  const INITIAL = 10n ** 36n;
  const account = (holder: unknown) => {
    if (holder === failAccount) throw new Error('reverted');
    return accounts[holder as string] ?? {};
  };
  const readContract = vi.fn(async ({ functionName, to, args }: ReadRequest) => {
    const holder = args?.[0];
    switch (functionName) {
      case 'getAccountSnapshot': {
        const [supplied, borrowed] = account(holder).positions?.[to] ?? [0n, 0n];
        return [0n, supplied, borrowed, RATE];
      }
      case 'compSupplyState':
        return [supplyIndex[holder as string] ?? INITIAL, 0];
      case 'compBorrowState':
        return [INITIAL, 0];
      case 'borrowIndex':
        return E18;
      case 'compSupplierIndex': {
        const market = holder as string;
        return account(args?.[1]).supplierIndex?.[market] ?? supplyIndex[market] ?? INITIAL;
      }
      case 'compBorrowerIndex':
        account(args?.[1]);
        return INITIAL;
      case 'compAccrued':
        return account(holder).accrued ?? 0n;
      case 'getAssetsIn':
        return account(holder).entered ?? [];
      case 'getAccountLiquidity':
        return [0n, 0n, account(holder).shortfall ?? 0n];
      case 'getCash':
        if (failCash) throw new Error('reverted');
        return cash[to] ?? 10n ** 30n;
      case 'balanceOf':
        if (to === COMP && holder === COMPTROLLER) {
          if (failCompBalance) throw new Error('reverted');
          return compInComptroller;
        }
        throw new Error('unexpected balanceOf');
      case 'proxies':
        return proxy;
      case 'owner':
        return owner;
      default:
        throw new Error(`unexpected ${functionName}`);
    }
  });
  const gasCostUsd = vi.fn(async (_network: string, units: bigint) => Number(units) / 10_000);
  const ctx: CheckContext = {
    readContract,
    nativeBalance: async () => 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy: async () => {
      throw new Error('unexpected proxy');
    },
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    priceUsd: async (_network, token) => (token === 'native' ? 3000 : 1),
    gasCostUsd,
    fetchJson: async () => undefined,
  };
  return { ctx, readContract, gasCostUsd };
}

describe('compound-v2 check', () => {
  it('reports nothing for an empty account, reading with the full address', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await compoundV2Check.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: C_DAI, functionName: 'getAccountSnapshot', args: [WALLET] }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: COMPTROLLER, functionName: 'compAccrued', args: [WALLET] }),
    );
  });

  it('finds a supply, priced, with the market in full and gas for the markets entered', async () => {
    const { ctx, gasCostUsd } = fakeContext({
      accounts: { [WALLET]: { positions: { [C_ETH]: [E18 / 2n, 0n] }, entered: [C_ETH, C_DAI] } },
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'ETH supplied to Compound V2',
          network: 'ethereum',
          amount: { raw: E18 / 2n, decimals: 18, symbol: 'ETH' },
          valueUsd: 1500,
          claimCostUsd: 30.3,
          deadline: null,
          heldBy: C_ETH,
        },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 303_000n);
  });

  it('warns when the market cannot pay the whole supply today', async () => {
    const { ctx } = fakeContext({
      accounts: { [WALLET]: { positions: { [C_DAI]: [100n * E18, 0n] } } },
      cash: { [C_DAI]: 12n * E18 },
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [
        {
          amount: { raw: 100n * E18 },
          note: expect.stringContaining("Compound's DAI market holds 12 DAI"),
        },
      ],
    });
  });

  it('warns about a debt next to a supply that can still be withdrawn', async () => {
    const { ctx } = fakeContext({
      accounts: { [WALLET]: { positions: { [C_ETH]: [E18, 0n], [C_DAI]: [0n, 500n * E18] } } },
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [
        { title: 'ETH supplied to Compound V2', note: expect.stringContaining('owes 500 DAI') },
      ],
    });
  });

  it('calls an underwater DSProxy debt fake, with the proxy in full', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      accounts: {
        [PROXY]: {
          positions: { [C_DAI]: [0n, 171_450_642_897_678_100_466n], [C_ETH]: [3784n, 0n] },
          entered: [C_ETH],
          shortfall: 171n * E18,
        },
      },
    });

    const outcome = await compoundV2Check.check(WALLET, ctx);

    expect(outcome.kind).toBe('fake');
    if (outcome.kind === 'fake') {
      expect(outcome.reason).toContain(`Your DSProxy (${PROXY}) owes 171.451 DAI`);
      expect(outcome.reason).toContain('collateral (0.000000000000003784 ETH) cannot be withdrawn');
    }
  });

  it('ignores a DSProxy the wallet no longer owns', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      owner: '0x4444444444444444444444444444444444444444',
      accounts: { [PROXY]: { positions: { [C_ETH]: [E18, 0n] } } },
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
  });

  it('finds a supply held by the DSProxy', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      accounts: { [PROXY]: { positions: { [C_ETH]: [E18, 0n] } } },
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ title: 'ETH supplied to Compound V2 from your DSProxy', heldBy: C_ETH }],
    });
  });

  it('says COMP rewards are lost when the Comptroller cannot pay them', async () => {
    const { ctx } = fakeContext({ accounts: { [WALLET]: { accrued: 123_114_779_052_228_784n } } });

    const outcome = await compoundV2Check.check(WALLET, ctx);

    expect(outcome.kind).toBe('lost');
    if (outcome.kind === 'lost') {
      expect(outcome.reason).toContain('0.123115 COMP of Compound V2 rewards cannot be claimed');
      expect(outcome.reason).toContain(COMPTROLLER);
    }
  });

  it('finds COMP rewards when the Comptroller holds enough to pay them', async () => {
    const { ctx, gasCostUsd } = fakeContext({
      accounts: { [WALLET]: { accrued: 2n * E18 } },
      compInComptroller: 10n * E18,
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [
        { title: 'Unclaimed COMP rewards from Compound V2', valueUsd: 2, heldBy: COMPTROLLER },
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 1_900_000n);
  });

  it('returns an error, not nothing, when the wallet cannot be read', async () => {
    const { ctx } = fakeContext({ failAccount: WALLET });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('keeps what it found and says the DSProxy could not be read', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      failAccount: PROXY,
      accounts: { [WALLET]: { positions: { [C_ETH]: [E18, 0n] } } },
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      partial: 'Some Compound V2 positions could not be read.',
    });
  });

  it('finds a deposit that is not collateral even when the account is underwater', async () => {
    const { ctx } = fakeContext({
      accounts: {
        [WALLET]: {
          positions: { [C_DAI]: [0n, 500n * E18], [C_ETH]: [E18, 0n], [C_USDC]: [0n, 0n] },
          entered: [],
          shortfall: 10n * E18,
        },
      },
    });

    const outcome = await compoundV2Check.check(WALLET, ctx);

    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [
        {
          title: 'ETH supplied to Compound V2',
          note: expect.stringContaining('not used as collateral'),
        },
      ],
      notices: [expect.stringContaining('owes 500 DAI')],
    });
  });

  it('keeps a DSProxy debt and lost COMP next to a deposit in the wallet', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      accounts: {
        [WALLET]: { positions: { [C_ETH]: [E18, 0n] }, accrued: E18 },
        [PROXY]: { positions: { [C_DAI]: [0n, 100n * E18] }, shortfall: 100n * E18 },
      },
    });

    const outcome = await compoundV2Check.check(WALLET, ctx);

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(outcome.notices).toEqual([
        expect.stringContaining(`Your DSProxy (${PROXY}) owes 100 DAI`),
        expect.stringContaining('1 COMP of Compound V2 rewards cannot be claimed'),
      ]);
    }
  });

  it('does not call COMP lost when the Comptroller balance cannot be read', async () => {
    const { ctx } = fakeContext({
      accounts: { [WALLET]: { accrued: E18 } },
      failCompBalance: true,
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({ kind: 'error' });
  });

  it('does not count the same COMP reserve twice for the wallet and its DSProxy', async () => {
    const { ctx } = fakeContext({
      proxy: PROXY,
      accounts: { [WALLET]: { accrued: 7n * E18 }, [PROXY]: { accrued: 7n * E18 } },
      compInComptroller: 10n * E18,
    });

    const outcome = await compoundV2Check.check(WALLET, ctx);

    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [{ title: 'Unclaimed COMP rewards from Compound V2', amount: { raw: 7n * E18 } }],
      notices: [expect.stringContaining('7 COMP of Compound V2 rewards cannot be claimed')],
    });
    if (outcome.kind === 'found') expect(outcome.findings).toHaveLength(1);
  });

  it('warns when the market cash cannot be read', async () => {
    const { ctx } = fakeContext({
      accounts: { [WALLET]: { positions: { [C_ETH]: [E18, 0n] } } },
      failCash: true,
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toMatchObject({
      kind: 'found',
      findings: [{ note: expect.stringContaining('could not be checked') }],
      partial: 'The cash of some Compound V2 markets could not be read.',
    });
  });

  it('adds COMP not booked yet, so a reserve too small for the full claim is lost', async () => {
    // 1 COMP booked and 10 more from the supply index, against a reserve of 2: claimComp would try
    // to pay 11 and pay nothing.
    const { ctx } = fakeContext({
      accounts: {
        [WALLET]: {
          positions: { [C_ETH]: [10n * E18, 0n] },
          accrued: E18,
          supplierIndex: { [C_ETH]: 10n ** 36n },
        },
      },
      supplyIndex: { [C_ETH]: 10n ** 36n + 10n ** 36n },
      compInComptroller: 2n * E18,
    });

    const outcome = await compoundV2Check.check(WALLET, ctx);

    expect(outcome).toMatchObject({ kind: 'found', notices: [expect.stringContaining('11 COMP')] });
    if (outcome.kind === 'found') {
      expect(outcome.findings.every((f) => f.amount?.symbol !== 'COMP')).toBe(true);
    }
  });

  it('finds COMP that was never booked, with nothing in compAccrued', async () => {
    const { ctx } = fakeContext({
      accounts: { [WALLET]: { accrued: 0n, supplierIndex: { [C_DAI]: 10n ** 36n } } },
      supplyIndex: { [C_DAI]: 3n * 10n ** 36n },
      compInComptroller: 10n * E18,
    });
    const { ctx: withSupply } = fakeContext({
      accounts: {
        [WALLET]: { positions: { [C_DAI]: [E18, 0n] }, supplierIndex: { [C_DAI]: 10n ** 36n } },
      },
      supplyIndex: { [C_DAI]: 3n * 10n ** 36n },
      compInComptroller: 10n * E18,
    });

    expect(await compoundV2Check.check(WALLET, ctx)).toEqual({ kind: 'nothing' });
    expect(await compoundV2Check.check(WALLET, withSupply)).toMatchObject({
      kind: 'found',
      findings: [
        { title: 'DAI supplied to Compound V2' },
        { title: 'Unclaimed COMP rewards from Compound V2', amount: { raw: 2n * E18 } },
      ],
    });
  });

  it('rejects an invalid address without reading the chain', async () => {
    const { ctx, readContract } = fakeContext({});

    expect(await compoundV2Check.check('not an address', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
