import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  amountToNumber,
  isEvmAddress,
  type Check,
  type CheckContext,
  type EvmAddress,
  type Finding,
  type TokenAmount,
} from '@deficheckup/engine';
import { readProxyOf, readProxyOwner, ZERO_ADDRESS, PROXY_REGISTRY } from '../shared/dsproxy';

// Compound V2's Comptroller (Unitroller) on Ethereum, read on-chain on 2026-11-01: 20 markets in
// getAllMarkets(), minting paused in all of them, and every COMP speed at zero. Its COMP balance
// was 0.0000475 COMP, so accrued rewards cannot be paid. Redeeming still works: simulated redeems
// from real suppliers passed in cETH and cUSDC.
const COMPTROLLER: EvmAddress = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
const COMP: EvmAddress = '0xc00e94Cb662C3520282E6f5717214004A7f26888';

// Fitted to two measurements on 2026-11-01 (eth_estimateGas of redeem from real suppliers):
// 302,334 gas with 2 markets entered as collateral and 530,546 with 7. The Comptroller walks every
// entered market to check the account stays solvent.
function redeemGas(marketsEntered: number): bigint {
  return 211_000n + 46_000n * BigInt(marketsEntered);
}
// Measured on 2026-11-01: 1,895,370 gas for claimComp(holder), which walks all 20 markets.
const CLAIM_COMP_GAS = 1_900_000n;

interface Market {
  /** The cToken, in full. */
  market: EvmAddress;
  symbol: string;
  /** The supplied asset, or "native" for ETH. */
  underlying: EvmAddress | 'native';
  decimals: number;
}

// Every market in getAllMarkets() on 2026-11-01, with underlying() and its decimals() read on-chain.
// The list cannot grow: minting is paused everywhere.
const MARKETS: readonly Market[] = [
  {
    market: '0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E',
    symbol: 'BAT',
    underlying: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
    decimals: 18,
  },
  {
    market: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
    symbol: 'DAI',
    underlying: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
  },
  {
    market: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
    symbol: 'ETH',
    underlying: 'native',
    decimals: 18,
  },
  {
    market: '0x158079Ee67Fce2f58472A96584A73C7Ab9AC95c1',
    symbol: 'REP',
    underlying: '0x1985365e9f78359a9B6AD760e32412f4a445E862',
    decimals: 18,
  },
  {
    market: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
    symbol: 'USDC',
    underlying: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  {
    market: '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9',
    symbol: 'USDT',
    underlying: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
  {
    market: '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',
    symbol: 'WBTC',
    underlying: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
  },
  {
    market: '0xB3319f5D18Bc0D84dD1b4825Dcde5d5f7266d407',
    symbol: 'ZRX',
    underlying: '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
    decimals: 18,
  },
  // The original single-collateral DAI, now called SAI. Its symbol() still says DAI.
  {
    market: '0xF5DCe57282A584D2746FaF1593d3121Fcac444dC',
    symbol: 'SAI',
    underlying: '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
    decimals: 18,
  },
  {
    market: '0x35A18000230DA775CAc24873d00Ff85BccdeD550',
    symbol: 'UNI',
    underlying: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
  },
  {
    market: '0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4',
    symbol: 'COMP',
    underlying: COMP,
    decimals: 18,
  },
  {
    market: '0xccF4429DB6322D5C611ee964527D42E5d685DD6a',
    symbol: 'WBTC',
    underlying: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
  },
  {
    market: '0x12392F67bdf24faE0AF363c24aC620a2f67DAd86',
    symbol: 'TUSD',
    underlying: '0x0000000000085d4780B73119b644AE5ecd22b376',
    decimals: 18,
  },
  {
    market: '0xFAce851a4921ce59e912d19329929CE6da6EB0c7',
    symbol: 'LINK',
    underlying: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    decimals: 18,
  },
  {
    market: '0x95b4eF2869eBD94BEb4eEE400a99824BF5DC325b',
    symbol: 'MKR',
    underlying: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    decimals: 18,
  },
  {
    market: '0x4B0181102A0112A2ef11AbEE5563bb4a3176c9d7',
    symbol: 'SUSHI',
    underlying: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
    decimals: 18,
  },
  {
    market: '0xe65cdB6479BaC1e22340E4E755fAE7E509EcD06c',
    symbol: 'AAVE',
    underlying: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    decimals: 18,
  },
  {
    market: '0x80a2AE356fc9ef4305676f7a3E2Ed04e12C33946',
    symbol: 'YFI',
    underlying: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
    decimals: 18,
  },
  {
    market: '0x041171993284df560249B57358F931D9eB7b925D',
    symbol: 'USDP',
    underlying: '0x8E870D67F660D95d5be530380D0eC0bd388289E1',
    decimals: 18,
  },
  {
    market: '0x7713DD9Ca933848F6819F38B8352D9A15EA73F67',
    symbol: 'FEI',
    underlying: '0x956F47F50A910163D8BF957Cf5846D573E7f87CA',
    decimals: 18,
  },
];

const cTokenAbi = [
  {
    type: 'function',
    name: 'getAccountSnapshot',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'error', type: 'uint256' },
      { name: 'cTokenBalance', type: 'uint256' },
      { name: 'borrowBalance', type: 'uint256' },
      { name: 'exchangeRate', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'borrowIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCash',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const indexOutputs = [
  { name: 'index', type: 'uint224' },
  { name: 'block', type: 'uint32' },
] as const;

const comptrollerAbi = [
  {
    type: 'function',
    name: 'compSupplyState',
    stateMutability: 'view',
    inputs: [{ name: 'cToken', type: 'address' }],
    outputs: indexOutputs,
  },
  {
    type: 'function',
    name: 'compBorrowState',
    stateMutability: 'view',
    inputs: [{ name: 'cToken', type: 'address' }],
    outputs: indexOutputs,
  },
  {
    type: 'function',
    name: 'compSupplierIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'cToken', type: 'address' },
      { name: 'supplier', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'compBorrowerIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'cToken', type: 'address' },
      { name: 'borrower', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'compAccrued',
    stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAssetsIn',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getAccountLiquidity',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'error', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'shortfall', type: 'uint256' },
    ],
  },
] as const;

const balanceOfAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface Position {
  market: Market;
  cTokens: bigint;
  /** Supplied, in the underlying's smallest unit. */
  supplied: bigint;
  borrowed: bigint;
  /** Where this account's COMP was last booked in the market (0 when never). */
  supplierIndex: bigint;
  borrowerIndex: bigint;
}

/** COMP distribution indexes of one market. Frozen: every COMP speed is zero since V2 stopped. */
interface MarketIndexes {
  supply: bigint;
  borrow: bigint;
  /** The cToken's borrowIndex(), to turn a borrow balance into the amount COMP is paid on. */
  marketBorrow: bigint;
}

interface Account {
  positions: Position[];
  compAccrued: bigint;
  /** Markets used as collateral, lowercase. Under a shortfall only these are blocked. */
  entered: ReadonlySet<string>;
  /** In USD with 18 decimals. Above zero, the Comptroller rejects every withdrawal. */
  shortfall: bigint;
}

const format = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });

function amountOf(raw: bigint, market: Pick<Market, 'decimals' | 'symbol'>): TokenAmount {
  return { raw, decimals: market.decimals, symbol: market.symbol };
}

function text(amount: TokenAmount): string {
  return `${format.format(amountToNumber(amount))} ${amount.symbol}`;
}

function isUint(value: unknown): value is bigint {
  return typeof value === 'bigint' && value >= 0n;
}

/** Everything about one account, read at once. Throws when any read fails or looks wrong. */
async function readAccount(ctx: CheckContext, account: EvmAddress): Promise<Account> {
  const [snapshots, compAccrued, assetsIn, liquidity] = await Promise.all([
    Promise.all(
      MARKETS.map((market) =>
        Promise.all([
          ctx.readContract({
            network: 'ethereum',
            to: market.market,
            abi: cTokenAbi,
            functionName: 'getAccountSnapshot',
            args: [account],
          }),
          ctx.readContract({
            network: 'ethereum',
            to: COMPTROLLER,
            abi: comptrollerAbi,
            functionName: 'compSupplierIndex',
            args: [market.market, account],
          }),
          ctx.readContract({
            network: 'ethereum',
            to: COMPTROLLER,
            abi: comptrollerAbi,
            functionName: 'compBorrowerIndex',
            args: [market.market, account],
          }),
        ]),
      ),
    ),
    ctx.readContract({
      network: 'ethereum',
      to: COMPTROLLER,
      abi: comptrollerAbi,
      functionName: 'compAccrued',
      args: [account],
    }),
    ctx.readContract({
      network: 'ethereum',
      to: COMPTROLLER,
      abi: comptrollerAbi,
      functionName: 'getAssetsIn',
      args: [account],
    }),
    ctx.readContract({
      network: 'ethereum',
      to: COMPTROLLER,
      abi: comptrollerAbi,
      functionName: 'getAccountLiquidity',
      args: [account],
    }),
  ]);

  const positions: Position[] = [];
  snapshots.forEach(([snapshot, supplierIndex, borrowerIndex], i) => {
    if (!Array.isArray(snapshot) || snapshot.length !== 4 || !snapshot.every(isUint)) {
      throw new Error('Unexpected snapshot.');
    }
    if (!isUint(supplierIndex) || !isUint(borrowerIndex)) throw new Error('Unexpected index.');
    const [error, cTokens, borrowed, rate] = snapshot as bigint[];
    if (error !== 0n) throw new Error('Snapshot error.');
    const supplied = (cTokens! * rate!) / 10n ** 18n;
    if (cTokens! > 0n || borrowed! > 0n) {
      positions.push({
        market: MARKETS[i]!,
        cTokens: cTokens!,
        supplied,
        borrowed: borrowed!,
        supplierIndex,
        borrowerIndex,
      });
    }
  });
  if (
    !isUint(compAccrued) ||
    !Array.isArray(assetsIn) ||
    !assetsIn.every((a) => typeof a === 'string')
  ) {
    throw new Error('Unexpected Comptroller.');
  }
  if (!Array.isArray(liquidity) || liquidity.length !== 3 || !liquidity.every(isUint)) {
    throw new Error('Unexpected liquidity.');
  }
  if (liquidity[0] !== 0n) throw new Error('Liquidity error.');

  return {
    positions,
    compAccrued,
    entered: new Set((assetsIn as string[]).map((a) => a.toLowerCase())),
    shortfall: liquidity[2] as bigint,
  };
}

/** Cash each market holds to pay withdrawals. A market that fails to answer is left out. */
async function readCash(ctx: CheckContext): Promise<Map<EvmAddress, bigint>> {
  const results = await Promise.allSettled(
    MARKETS.map((market) =>
      ctx.readContract({
        network: 'ethereum',
        to: market.market,
        abi: cTokenAbi,
        functionName: 'getCash',
      }),
    ),
  );
  const cash = new Map<EvmAddress, bigint>();
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && isUint(result.value))
      cash.set(MARKETS[i]!.market, result.value);
  });
  return cash;
}

function indexOf(state: unknown): bigint {
  if (!Array.isArray(state) || !isUint(state[0])) throw new Error('Unexpected COMP state.');
  return state[0];
}

/** COMP indexes of every market. Throws when any read fails. */
async function readIndexes(ctx: CheckContext): Promise<Map<EvmAddress, MarketIndexes>> {
  const rows = await Promise.all(
    MARKETS.map((market) =>
      Promise.all([
        ctx.readContract({
          network: 'ethereum',
          to: COMPTROLLER,
          abi: comptrollerAbi,
          functionName: 'compSupplyState',
          args: [market.market],
        }),
        ctx.readContract({
          network: 'ethereum',
          to: COMPTROLLER,
          abi: comptrollerAbi,
          functionName: 'compBorrowState',
          args: [market.market],
        }),
        ctx.readContract({
          network: 'ethereum',
          to: market.market,
          abi: cTokenAbi,
          functionName: 'borrowIndex',
        }),
      ]),
    ),
  );
  const indexes = new Map<EvmAddress, MarketIndexes>();
  rows.forEach(([supply, borrow, marketBorrow], i) => {
    if (!isUint(marketBorrow) || marketBorrow === 0n) throw new Error('Unexpected borrowIndex.');
    indexes.set(MARKETS[i]!.market, {
      supply: indexOf(supply),
      borrow: indexOf(borrow),
      marketBorrow,
    });
  });
  return indexes;
}

// The Comptroller's compInitialIndex, read on-chain on 2026-11-01.
const COMP_INITIAL_INDEX = 10n ** 36n;

/**
 * COMP that claimComp(holder) would pay: compAccrued plus what distributeSupplierComp and
 * distributeBorrowerComp add first. Same math as the Comptroller (and CompoundLens), checked on
 * 2026-11-01 against getCompBalanceMetadataExt for a holder with rewards not booked yet.
 */
function compOwed(account: Account, indexes: ReadonlyMap<EvmAddress, MarketIndexes>): bigint {
  let owed = account.compAccrued;
  for (const position of account.positions) {
    const market = indexes.get(position.market.market)!;
    let supplierIndex = position.supplierIndex;
    if (supplierIndex === 0n && market.supply >= COMP_INITIAL_INDEX)
      supplierIndex = COMP_INITIAL_INDEX;
    if (market.supply > supplierIndex) {
      owed += (position.cTokens * (market.supply - supplierIndex)) / 10n ** 36n;
    }
    let borrowerIndex = position.borrowerIndex;
    if (borrowerIndex === 0n && market.borrow >= COMP_INITIAL_INDEX)
      borrowerIndex = COMP_INITIAL_INDEX;
    if (position.borrowed > 0n && market.borrow > borrowerIndex) {
      const borrowerAmount = (position.borrowed * 10n ** 18n) / market.marketBorrow;
      owed += (borrowerAmount * (market.borrow - borrowerIndex)) / 10n ** 36n;
    }
  }
  return owed;
}

export const compoundV2Check: Check = {
  id: 'compound-v2',
  name: 'Compound V2',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://v2-app.compound.xyz',
  deadline: null,
  contracts: evmContracts(
    'ethereum',
    COMPTROLLER,
    COMP,
    PROXY_REGISTRY,
    ...MARKETS.flatMap((market) => [market.market, market.underlying]),
  ),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    // Round one: the wallet, the shared market data and the wallet's DSProxy, all in one request.
    const [wallet, cash, indexes, compInComptroller, proxy] = await Promise.allSettled([
      readAccount(ctx, address),
      readCash(ctx),
      readIndexes(ctx),
      ctx.readContract({
        network: 'ethereum',
        to: COMP,
        abi: balanceOfAbi,
        functionName: 'balanceOf',
        args: [COMPTROLLER],
      }),
      readProxyOf(ctx, address),
    ]);

    // Round two: the DSProxy, only when it exists and still belongs to the wallet.
    let proxyAddress: EvmAddress | null = null;
    let proxyAccount: PromiseSettledResult<Account> | null = null;
    let unreadable = wallet.status === 'rejected';
    if (
      proxy.status === 'rejected' ||
      typeof proxy.value !== 'string' ||
      !isEvmAddress(proxy.value)
    ) {
      unreadable = true;
    } else if (proxy.value !== ZERO_ADDRESS) {
      const found = proxy.value;
      const [owner, account] = await Promise.allSettled([
        readProxyOwner(ctx, found),
        readAccount(ctx, found),
      ]);
      if (owner.status === 'rejected' || typeof owner.value !== 'string') {
        unreadable = true;
      } else if (owner.value.toLowerCase() === address.toLowerCase()) {
        proxyAddress = found;
        proxyAccount = account;
        if (account.status === 'rejected') unreadable = true;
      }
    }

    const marketCash = cash.status === 'fulfilled' ? cash.value : new Map<EvmAddress, bigint>();
    const compAvailable =
      compInComptroller.status === 'fulfilled' && isUint(compInComptroller.value)
        ? compInComptroller.value
        : null;

    const accounts: { holder: EvmAddress; account: Account; who: string; from: string }[] = [];
    if (wallet.status === 'fulfilled') {
      accounts.push({ holder: address, account: wallet.value, who: 'Your wallet', from: '' });
    }
    if (proxyAddress && proxyAccount?.status === 'fulfilled') {
      accounts.push({
        holder: proxyAddress,
        account: proxyAccount.value,
        who: `Your DSProxy (${proxyAddress})`,
        from: ' from your DSProxy',
      });
    }

    const supplies: { position: Position; from: string; entered: number; note?: string }[] = [];
    const debts: string[] = [];
    const claims: { from: string; accrued: bigint }[] = [];
    let lostComp = 0n;
    let cashMissing = false;
    // claimComp() pays a holder only if the Comptroller holds enough for that holder, and each
    // payment lowers what is left for the next one.
    let compLeft = compAvailable;

    for (const { account, who, from } of accounts) {
      const owed = account.positions
        .filter((p) => p.borrowed > 0n)
        .map((p) => text(amountOf(p.borrowed, p.market)));
      // With a shortfall the Comptroller rejects redeeming any market used as collateral, but a
      // market the account never entered can still be redeemed (redeemAllowedInternal).
      const underwater = account.shortfall > 0n && owed.length > 0;
      const blocked: string[] = [];

      for (const position of account.positions.filter((p) => p.supplied > 0n)) {
        const isCollateral = account.entered.has(position.market.market.toLowerCase());
        if (underwater && isCollateral) {
          blocked.push(text(amountOf(position.supplied, position.market)));
          continue;
        }
        const notes: string[] = [];
        if (owed.length > 0) {
          notes.push(
            underwater
              ? `${who} also owes ${owed.join(', ')} to Compound V2, but this deposit is not used as collateral, so it can be withdrawn.`
              : `${who} also owes ${owed.join(', ')} to Compound V2: repay it before withdrawing everything.`,
          );
        }
        const available = marketCash.get(position.market.market);
        if (available === undefined) {
          cashMissing = true;
          notes.push(
            `Whether the ${position.market.symbol} market can pay it all today could not be checked.`,
          );
        } else if (available < position.supplied) {
          notes.push(
            `Compound's ${position.market.symbol} market holds ` +
              `${text(amountOf(available, position.market))} to pay all withdrawals today: ` +
              `you may have to withdraw in parts as borrowers repay.`,
          );
        }
        supplies.push({
          position,
          from,
          entered: account.entered.size,
          ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
        });
      }

      if (underwater) {
        debts.push(
          `${who} owes ${owed.join(', ')} to Compound V2. Some wallet apps list it as a balance, ` +
            `but it is a debt, and it is larger than Compound allows for the account's collateral` +
            (blocked.length > 0
              ? `, so that collateral (${blocked.join(', ')}) cannot be withdrawn until the debt is repaid.`
              : `. There is no collateral left to withdraw.`),
        );
      }

      const compDue = indexes.status === 'fulfilled' ? compOwed(account, indexes.value) : null;
      if (compDue === null) {
        if (account.compAccrued > 0n || account.positions.length > 0) unreadable = true;
      } else if (compDue > 0n) {
        if (compLeft === null) {
          unreadable = true;
        } else if (compDue <= compLeft) {
          claims.push({ from, accrued: compDue });
          compLeft -= compDue;
        } else {
          lostComp += compDue;
        }
      }
    }

    const findings: Finding[] = await Promise.all([
      ...supplies.map(async ({ position, from, entered, note }) => {
        const amount = amountOf(position.supplied, position.market);
        const [price, claimCostUsd] = await Promise.all([
          lookupPrice(ctx, 'ethereum', position.market.underlying),
          ctx.gasCostUsd('ethereum', redeemGas(entered)),
        ]);
        return {
          title: `${position.market.symbol} supplied to Compound V2${from}`,
          network: 'ethereum' as const,
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: null,
          heldBy: position.market.market,
          ...(note ? { note } : {}),
        };
      }),
      ...claims.map(async ({ from, accrued }) => {
        const amount = amountOf(accrued, { decimals: 18, symbol: 'COMP' });
        const [price, claimCostUsd] = await Promise.all([
          lookupPrice(ctx, 'ethereum', COMP),
          ctx.gasCostUsd('ethereum', CLAIM_COMP_GAS),
        ]);
        return {
          title: `Unclaimed COMP rewards from Compound V2${from}`,
          network: 'ethereum' as const,
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: null,
          heldBy: COMPTROLLER,
        };
      }),
    ]);

    const missing = [
      unreadable ? 'Some Compound V2 positions could not be read.' : '',
      cashMissing ? 'The cash of some Compound V2 markets could not be read.' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const lost =
      lostComp > 0n
        ? `${text(amountOf(lostComp, { decimals: 18, symbol: 'COMP' }))} of Compound V2 ` +
          `rewards cannot be claimed: the Comptroller (${COMPTROLLER}) no longer holds enough COMP ` +
          `to pay them, and V2 rewards have stopped.`
        : '';
    const notices = [...debts, lost].filter(Boolean);

    const [first, ...rest] = findings;
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(missing ? { partial: missing } : {}),
        ...(notices.length > 0 ? { notices } : {}),
      };
    }
    if (debts.length > 0) {
      return { kind: 'fake', reason: [...notices, missing].filter(Boolean).join(' ') };
    }
    if (lost) return { kind: 'lost', reason: [lost, missing].filter(Boolean).join(' ') };
    if (unreadable) return { kind: 'error', reason: missing };
    return { kind: 'nothing' };
  },
};
