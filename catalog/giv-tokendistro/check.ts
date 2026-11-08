import { evmContracts } from '../shared/contracts';
import { lookupPrice, valueAtPrice, isEvmAddress, type Check } from '@deficheckup/engine';

// Giveth's TokenDistro (the GIVstream) on Gnosis, read on-chain on 2026-11-01: token() is GIV
// (0x4f4F9b8D5B4d0Dc10506e5551B0513B61fD59e75, 18 decimals), startTime 2021-12-24, duration
// 157,680,000 s, so every stream is fully liquid on 2026-12-23 (the date docs.giveth.io gives).
const TOKEN_DISTRO = '0xc0dbDcA66a0636236fAbe1B3C16B1bD4C84bB1E1';
const GIV = '0x4f4F9b8D5B4d0Dc10506e5551B0513B61fD59e75';

// Measured on 2026-11-01 with eth_estimateGas of claim() from a recipient with GIV claimable.
const CLAIM_GAS = 82_000n;

const tokenDistroAbi = [
  {
    type: 'function',
    name: 'claimableNow',
    stateMutability: 'view',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const givTokenDistroCheck: Check = {
  id: 'giv-tokendistro',
  name: 'Giveth GIVstream',
  networks: ['gnosis'],
  category: 'unclaimed-airdrop',
  status: { kind: 'open' },
  officialLink: 'https://docs.giveth.io/givstream',
  deadline: null,
  contracts: evmContracts('gnosis', TOKEN_DISTRO, GIV),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const claimable = await ctx.readContract({
      network: 'gnosis',
      to: TOKEN_DISTRO,
      abi: tokenDistroAbi,
      functionName: 'claimableNow',
      args: [address],
    });
    if (typeof claimable !== 'bigint') {
      return { kind: 'error', reason: 'Unexpected response from the TokenDistro contract.' };
    }
    if (claimable === 0n) return { kind: 'nothing' };

    const amount = { raw: claimable, decimals: 18, symbol: 'GIV' };
    const [price, claimCostUsd] = await Promise.all([
      lookupPrice(ctx, 'gnosis', GIV),
      ctx.gasCostUsd('gnosis', CLAIM_GAS),
    ]);

    return {
      kind: 'found',
      findings: [
        {
          title: 'GIV ready to claim from your GIVstream',
          network: 'gnosis',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: null,
          heldBy: TOKEN_DISTRO,
        },
      ],
    };
  },
};
