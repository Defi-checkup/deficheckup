import type { CheckContext, EvmAddress } from '@deficheckup/engine';

// Maker's ProxyRegistry on Ethereum, read on-chain on 2026-11-01: proxies(owner) returns the
// owner's DSProxy, and that proxy's owner() returns the owner back. DeFi Saver used the same
// registry for its Smart Wallets until early 2024.
export const PROXY_REGISTRY = '0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const registryAbi = [
  {
    type: 'function',
    name: 'proxies',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const proxyAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

/** The DSProxy the registry remembers for a wallet: a full address, the zero address, or junk. */
export function readProxyOf(ctx: CheckContext, owner: EvmAddress): Promise<unknown> {
  return ctx.readContract({
    network: 'ethereum',
    to: PROXY_REGISTRY,
    abi: registryAbi,
    functionName: 'proxies',
    args: [owner],
  });
}

/** The current owner of a DSProxy. The registry keeps proxies whose ownership moved elsewhere. */
export function readProxyOwner(ctx: CheckContext, proxy: EvmAddress): Promise<unknown> {
  return ctx.readContract({ network: 'ethereum', to: proxy, abi: proxyAbi, functionName: 'owner' });
}
