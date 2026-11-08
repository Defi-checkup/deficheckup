import { evmContracts } from '../shared/contracts';
import { lookupPrice, valueAtPrice, isEvmAddress, type Check } from '@deficheckup/engine';

// Placeholders, not real contracts. A real check uses contracts verified on-chain.
const DISTRIBUTOR = '0x0000000000000000000000000000000000000000';
const CLAIM_GAS_UNITS = 90_000n;
const DEADLINE = '2099-12-31';

const distributorAbi = [
  {
    type: 'function',
    name: 'claimable',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Template for new checks. Not in the catalog list: copy this folder to start a new one. */
export const exampleCheck: Check = {
  id: 'example',
  name: 'Example airdrop (template)',
  networks: ['ethereum'],
  category: 'unclaimed-airdrop',
  status: { kind: 'closing', deadline: DEADLINE },
  officialLink: 'https://example.com/claim',
  deadline: DEADLINE,
  contracts: evmContracts('ethereum', DISTRIBUTOR),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const claimable = await ctx.readContract({
      network: 'ethereum',
      to: DISTRIBUTOR,
      abi: distributorAbi,
      functionName: 'claimable',
      args: [address],
    });

    if (typeof claimable !== 'bigint') {
      return { kind: 'error', reason: 'Unexpected response from the distributor contract.' };
    }
    if (claimable === 0n) {
      return { kind: 'nothing' };
    }

    const amount = { raw: claimable, decimals: 18, symbol: 'EXMPL' };
    const [price, claimCostUsd] = await Promise.all([
      lookupPrice(ctx, 'ethereum', DISTRIBUTOR),
      ctx.gasCostUsd('ethereum', CLAIM_GAS_UNITS),
    ]);

    return {
      kind: 'found',
      findings: [
        {
          title: 'Unclaimed EXMPL airdrop',
          network: 'ethereum',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: DEADLINE,
        },
      ],
    };
  },
};
