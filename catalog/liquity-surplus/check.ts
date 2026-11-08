import { lookupPrice, valueAtPrice, isEvmAddress, type Check } from '@deficheckup/engine';
import { evmContracts } from '../shared/contracts';
import { abi } from './abi';

// Official mainnet deployment, verified on Sourcify and read on-chain on 2026-11-02.
// getCollateral(public owner) = 6055081726068459915 wei; getETH() covers that credit.
export const COLL_SURPLUS_POOL = '0x3D32e8b97Ed5881324241Cf03b2DA5E2EBcE5521';
// Pool.borrowerOperationsAddress() confirms this route. claimCollateral() passed eth_call.
export const BORROWER_OPERATIONS = '0x24179CD81c9e782A4096035f7eC97fB8B783e007';
// Estimate, not measured: one collateral claim through BorrowerOperations and the pool.
const CLAIM_GAS = 100_000n;

export const liquitySurplusCheck: Check = {
  id: 'liquity-surplus',
  name: 'Liquity V1 collateral surplus',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://www.liquity.org/frontend',
  verifiedOn: '2026-11-02',
  deadline: null,
  contracts: evmContracts('ethereum', COLL_SURPLUS_POOL, BORROWER_OPERATIONS),

  async check(address, ctx) {
    if (!isEvmAddress(address)) return { kind: 'error', reason: 'Not a valid EVM address.' };
    try {
      const read = (functionName: string, args: unknown[] = []) =>
        ctx.readContract({ network: 'ethereum', to: COLL_SURPLUS_POOL, abi, functionName, args });
      const [credit, backing] = await Promise.all([
        read('getCollateral', [address]),
        read('getETH'),
      ]);
      if (
        typeof credit !== 'bigint' ||
        credit < 0n ||
        typeof backing !== 'bigint' ||
        backing < 0n
      ) {
        return { kind: 'error', reason: 'Unexpected response from the Liquity surplus pool.' };
      }
      if (credit === 0n) return { kind: 'nothing' };
      if (backing < credit) {
        return {
          kind: 'found',
          findings: [
            {
              title: 'Liquity V1 surplus credit needs review',
              network: 'ethereum',
              amount: null,
              valueUsd: null,
              claimCostUsd: null,
              deadline: null,
              heldBy: COLL_SURPLUS_POOL,
              note: 'The recorded ETH credit exceeds the pool backing. A full payout cannot be confirmed.',
            },
          ],
        };
      }
      const amount = { raw: credit, decimals: 18, symbol: 'ETH' };
      const [price, claimCostUsd] = await Promise.all([
        lookupPrice(ctx, 'ethereum', 'native'),
        ctx.gasCostUsd('ethereum', CLAIM_GAS).catch(() => null),
      ]);
      return {
        kind: 'found',
        findings: [
          {
            title: 'ETH collateral surplus in Liquity V1',
            network: 'ethereum',
            amount,
            ...valueAtPrice(amount, price),
            claimCostUsd,
            deadline: null,
            heldBy: COLL_SURPLUS_POOL,
            note: 'Claim through BorrowerOperations using the address credited by the pool. This is separate from an open Trove.',
          },
        ],
      };
    } catch {
      return { kind: 'error', reason: 'The Liquity collateral surplus could not be read.' };
    }
  },
};
