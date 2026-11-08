import { evmContracts } from '../shared/contracts';
import { amountToNumber, isEvmAddress, type Check } from '@deficheckup/engine';
import { CREAM_MARKETS, type CreamMarket } from './markets';

// Cream Finance's Comptroller (Unitroller) on Ethereum, read on-chain on 2026-11-01. Its
// implementation 0x7AA375f1fE5E04E18a6B02B4294cfd57cA9f53BA, set on 2021-11-01 (block 13532288,
// five days after the October 2021 exploit), starts redeemAllowed with
// revert("redeemer is paused"). Simulated redeems failed in a market with cash (crYVWETH) and in
// one without (crAAVE), so no supplier can withdraw from any market.
const COMPTROLLER = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';
const BLOCKED_SINCE = '2021-11-01';

const crTokenAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'exchangeRateStored',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const format = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });

/** "208.372 AAVE", or "crCREAM tokens of unknown value" when the exchange rate cannot be read. */
function describe(market: CreamMarket, crTokens: bigint, rate: unknown): string {
  // Some broken markets revert on exchangeRateStored (crCREAM did on 2026-11-01).
  if (typeof rate !== 'bigint') return `cr${market.name} tokens of unknown value`;
  const raw = (crTokens * rate) / 10n ** 18n;
  return `${format.format(amountToNumber({ raw, decimals: market.decimals, symbol: '' }))} ${market.name}`;
}

export const creamCheck: Check = {
  id: 'cream',
  name: 'Cream Finance (Ethereum)',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'expired', since: BLOCKED_SINCE },
  officialLink: 'https://app.cream.finance',
  deadline: null,
  contracts: evmContracts('ethereum', COMPTROLLER, ...CREAM_MARKETS.map((market) => market.market)),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const balances = await Promise.allSettled(
      CREAM_MARKETS.map((market) =>
        ctx.readContract({
          network: 'ethereum',
          to: market.market,
          abi: crTokenAbi,
          functionName: 'balanceOf',
          args: [address],
        }),
      ),
    );

    let unreadable = 0;
    const held: { market: CreamMarket; crTokens: bigint }[] = [];
    balances.forEach((result, i) => {
      const market = CREAM_MARKETS[i]!;
      if (result.status === 'rejected' || typeof result.value !== 'bigint') unreadable += 1;
      else if (result.value > 0n) held.push({ market, crTokens: result.value });
    });

    if (held.length === 0) {
      if (unreadable > 0) {
        return { kind: 'error', reason: 'Some Cream markets could not be read.' };
      }
      return { kind: 'nothing' };
    }

    const rates = await Promise.allSettled(
      held.map(({ market }) =>
        ctx.readContract({
          network: 'ethereum',
          to: market.market,
          abi: crTokenAbi,
          functionName: 'exchangeRateStored',
        }),
      ),
    );
    const positions = held.map(({ market, crTokens }, i) => {
      const rate = rates[i]!;
      return describe(market, crTokens, rate.status === 'fulfilled' ? rate.value : undefined);
    });

    return {
      kind: 'lost',
      reason:
        `Cream Finance has blocked every withdrawal from its Ethereum markets since ` +
        `${BLOCKED_SINCE}, after the October 2021 exploit: its Comptroller ` +
        `(${COMPTROLLER}) rejects them all. What you supplied there cannot be taken out: ${positions.join(', ')}.` +
        (unreadable > 0 ? ' Some other Cream markets could not be read.' : ''),
    };
  },
};
