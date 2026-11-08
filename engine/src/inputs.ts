import { createPublicClient, fallback, http } from 'viem';
import { normalize } from 'viem/ens';
import { addressKind } from './address';
import { EVM_NETWORKS } from './networks';
import type { EvmAddress } from './types';

/** Turns an ENS name into the address it points to, or null when it points nowhere. */
export type EnsResolver = (name: string) => Promise<EvmAddress | null>;

export interface Wallet {
  /** What the user typed: an address or an ENS name. */
  input: string;
  address: string;
}

export interface ResolvedInputs {
  /** One entry per distinct wallet, in the order the user typed them. */
  wallets: Wallet[];
  /** Inputs that are not an address and not a name that resolves. */
  invalid: string[];
}

// Anything with a dot and no spaces may be a name (vitalik.eth, or a DNS name imported into ENS).
const NAME = /^\S+\.\S+$/;

/** Reads what the user pasted: addresses pass through, names are resolved, repeats are dropped. */
export async function resolveInputs(
  inputs: readonly string[],
  resolveEns: EnsResolver,
): Promise<ResolvedInputs> {
  const cleaned = inputs.map((input) => input.trim()).filter(Boolean);

  const resolved = await Promise.all(
    cleaned.map(async (input): Promise<Wallet | null> => {
      if (addressKind(input) !== null) return { input, address: input };
      if (!NAME.test(input)) return null;
      const address = await resolveEns(input);
      return address === null ? null : { input, address };
    }),
  );

  const wallets: Wallet[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  resolved.forEach((wallet, index) => {
    if (wallet === null) {
      invalid.push(cleaned[index] as string);
      return;
    }
    // EVM addresses are case-insensitive; Solana addresses are not.
    const key =
      addressKind(wallet.address) === 'evm' ? wallet.address.toLowerCase() : wallet.address;
    if (seen.has(key)) return;
    seen.add(key);
    wallets.push(wallet);
  });

  return { wallets, invalid };
}

export interface EnsClient {
  getEnsAddress(args: { name: string }): Promise<EvmAddress | null>;
}

/** The real resolver, on Ethereum mainnet. A malformed name or a failed lookup gives null. */
export function createEnsResolver(client?: EnsClient, rpcTimeoutMs = 8_000): EnsResolver {
  const ens =
    client ??
    (createPublicClient({
      chain: EVM_NETWORKS.ethereum.chain,
      transport: fallback(
        EVM_NETWORKS.ethereum.rpcs.map((url) => http(url, { timeout: rpcTimeoutMs })),
      ),
    }) as EnsClient);

  return async (name) => {
    try {
      return await ens.getEnsAddress({ name: normalize(name) });
    } catch {
      return null;
    }
  };
}
