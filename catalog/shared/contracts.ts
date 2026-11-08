import type { CatalogContract, EvmAddress, EvmNetwork } from '@deficheckup/engine';

/** Keep the inventory beside each check and reuse its constants and market lists. */
export function evmContracts(
  network: EvmNetwork,
  ...addresses: readonly (EvmAddress | 'native')[]
): CatalogContract[] {
  const seen = new Set<string>();
  return addresses.flatMap((address) => {
    if (address === 'native' || seen.has(address.toLowerCase())) return [];
    seen.add(address.toLowerCase());
    return [{ network, address }];
  });
}
