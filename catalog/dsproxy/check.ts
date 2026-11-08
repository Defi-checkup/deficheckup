import { evmContracts } from '../shared/contracts';
import { isEvmAddress, type Check } from '@deficheckup/engine';
import { readProxyOf, readProxyOwner, ZERO_ADDRESS, PROXY_REGISTRY } from '../shared/dsproxy';
import { readHoldings } from '../shared/holdings';
import { ETHEREUM_TOKENS } from '../shared/tokens';

// Estimate, not measured: DSProxy execute() plus a transfer, in the same range as the DSA
// withdrawal measured at 148,640 gas. Replace with a measurement when a withdrawal target is
// verified.
const WITHDRAW_GAS = { native: 70_000n, token: 150_000n };

export const dsproxyCheck: Check = {
  id: 'dsproxy',
  name: 'DSProxy (Maker and DeFi Saver)',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.defisaver.com',
  deadline: null,
  contracts: evmContracts(
    'ethereum',
    PROXY_REGISTRY,
    ...ETHEREUM_TOKENS.map((token) => token.address),
  ),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const proxy = await readProxyOf(ctx, address);
    if (typeof proxy !== 'string' || !isEvmAddress(proxy)) {
      return { kind: 'error', reason: 'Unexpected response from the ProxyRegistry.' };
    }
    if (proxy === ZERO_ADDRESS) return { kind: 'nothing' };

    const [owner, holdings] = await Promise.all([
      readProxyOwner(ctx, proxy),
      readHoldings(ctx, {
        network: 'ethereum',
        holder: proxy,
        tokens: ETHEREUM_TOKENS,
        native: { symbol: 'ETH', decimals: 18 },
        gas: WITHDRAW_GAS,
        title: (symbol) => `${symbol} in your DSProxy`,
      }),
    ]);
    if (typeof owner !== 'string') {
      return { kind: 'error', reason: 'Unexpected response from the DSProxy.' };
    }
    // The registry keeps the proxy a wallet built, even after its ownership moved elsewhere.
    if (owner.toLowerCase() !== address.toLowerCase()) return { kind: 'nothing' };

    const [first, ...rest] = holdings.findings;
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(holdings.failed > 0
          ? { partial: 'Some balances of your DSProxy could not be read.' }
          : {}),
      };
    }
    if (holdings.failed > 0) {
      return { kind: 'error', reason: 'Some balances of your DSProxy could not be read.' };
    }
    return { kind: 'nothing' };
  },
};
