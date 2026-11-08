import type { Chain } from 'viem';
import {
  arbitrum,
  avalanche,
  base,
  blast,
  bsc,
  celo,
  flowMainnet,
  gnosis,
  linea,
  mainnet,
  mantle,
  optimism,
  polygon,
  scroll,
  zksync,
} from 'viem/chains';
import type { Network } from './types';

export type EvmNetwork = Exclude<Network, 'solana' | 'hyperliquid'>;

export interface EvmNetworkConfig {
  chain: Chain;
  /**
   * Public RPCs, in order of preference; the next one is tried when one fails.
   * Each was checked on 2026-11-01: right chain id, Multicall3 deployed, open to browsers (CORS).
   */
  rpcs: readonly string[];
  /** DefiLlama id of the native token, for gas costs. */
  nativePriceId: string;
  /** DefiLlama chain prefix for token prices ("<prefix>:<token address>"). */
  priceChain: string;
}

const ETH = 'coingecko:ethereum';

export const EVM_NETWORKS: Record<EvmNetwork, EvmNetworkConfig> = {
  ethereum: {
    chain: mainnet,
    rpcs: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://ethereum.reth.rs/rpc',
    ],
    nativePriceId: ETH,
    priceChain: 'ethereum',
  },
  arbitrum: {
    chain: arbitrum,
    rpcs: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.drpc.org',
    ],
    nativePriceId: ETH,
    priceChain: 'arbitrum',
  },
  optimism: {
    chain: optimism,
    rpcs: [
      'https://optimism-rpc.publicnode.com',
      'https://mainnet.optimism.io',
      'https://optimism.drpc.org',
    ],
    nativePriceId: ETH,
    priceChain: 'optimism',
  },
  base: {
    chain: base,
    rpcs: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.drpc.org'],
    nativePriceId: ETH,
    priceChain: 'base',
  },
  polygon: {
    chain: polygon,
    rpcs: ['https://polygon.drpc.org', 'https://polygon-bor-rpc.publicnode.com'],
    nativePriceId: 'coingecko:polygon-ecosystem-token',
    priceChain: 'polygon',
  },
  gnosis: {
    chain: gnosis,
    rpcs: [
      'https://rpc.gnosischain.com',
      'https://gnosis-rpc.publicnode.com',
      'https://gnosis.drpc.org',
    ],
    nativePriceId: 'coingecko:xdai',
    priceChain: 'xdai',
  },
  bsc: {
    chain: bsc,
    rpcs: ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'],
    nativePriceId: 'coingecko:binancecoin',
    priceChain: 'bsc',
  },
  avalanche: {
    chain: avalanche,
    rpcs: [
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche.drpc.org',
    ],
    nativePriceId: 'coingecko:avalanche-2',
    priceChain: 'avax',
  },
  zksync: {
    chain: zksync, // zkSync Era. Its Multicall3 lives at a different address, which viem knows.
    rpcs: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
    nativePriceId: ETH,
    priceChain: 'era',
  },
  linea: {
    chain: linea,
    rpcs: ['https://linea-rpc.publicnode.com', 'https://rpc.linea.build', 'https://linea.drpc.org'],
    nativePriceId: ETH,
    priceChain: 'linea',
  },
  scroll: {
    chain: scroll,
    rpcs: ['https://scroll-rpc.publicnode.com', 'https://rpc.scroll.io', 'https://scroll.drpc.org'],
    nativePriceId: ETH,
    priceChain: 'scroll',
  },
  blast: {
    chain: blast,
    // Only the official RPC: blast.drpc.org did not see Multicall3 on 2026-11-01.
    rpcs: ['https://rpc.blast.io'],
    nativePriceId: ETH,
    priceChain: 'blast',
  },
  mantle: {
    chain: mantle,
    rpcs: [
      'https://mantle-rpc.publicnode.com',
      'https://rpc.mantle.xyz',
      'https://mantle.drpc.org',
    ],
    nativePriceId: 'coingecko:mantle',
    priceChain: 'mantle',
  },
  celo: {
    chain: celo,
    rpcs: ['https://celo-rpc.publicnode.com', 'https://forno.celo.org', 'https://celo.drpc.org'],
    nativePriceId: 'coingecko:celo',
    priceChain: 'celo',
  },
  'flow-evm': {
    chain: flowMainnet,
    // Only the official RPC: no second public one answered on 2026-11-01.
    rpcs: ['https://mainnet.evm.nodes.onflow.org'],
    nativePriceId: 'coingecko:flow',
    priceChain: 'flow',
  },
};

/** True for the networks the engine reads by RPC (not Solana, not Hyperliquid's API). */
export function isEvmNetwork(network: Network): network is EvmNetwork {
  return Object.hasOwn(EVM_NETWORKS, network);
}
