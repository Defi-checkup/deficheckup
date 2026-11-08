import type { EvmAddress } from '@deficheckup/engine';

export interface KnownToken {
  address: EvmAddress;
  symbol: string;
  decimals: number;
}

/**
 * Tokens that commonly sit forgotten in Ethereum smart wallets. Each address was read on-chain on
 * 2026-11-01: symbol(), decimals() and a real totalSupply(). Two exceptions to the on-chain symbol:
 * MKR returns it as bytes32, and INST was renamed FLUID by Instadapp (same contract).
 */
export const ETHEREUM_TOKENS: readonly KnownToken[] = [
  { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
  { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
  { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
  { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
  { address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F', symbol: 'USDS', decimals: 18 },
  { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
  { address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', symbol: 'stETH', decimals: 18 },
  { address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', symbol: 'wstETH', decimals: 18 },
  { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', decimals: 18 },
  { address: '0x4da27a545c0c5B758a6BA100e3a049001de870f5', symbol: 'stkAAVE', decimals: 18 },
  { address: '0xc00e94Cb662C3520282E6f5717214004A7f26888', symbol: 'COMP', decimals: 18 },
  { address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', symbol: 'MKR', decimals: 18 },
  { address: '0x56072C95FAA701256059aa122697B133aDEd9279', symbol: 'SKY', decimals: 18 },
  { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', decimals: 18 },
  { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', decimals: 18 },
  { address: '0xD533a949740bb3306d119CC777fa900bA034cd52', symbol: 'CRV', decimals: 18 },
  { address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', symbol: 'LDO', decimals: 18 },
  { address: '0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb', symbol: 'FLUID', decimals: 18 },
];
