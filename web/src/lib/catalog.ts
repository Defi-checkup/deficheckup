import type { Check, CheckStatus, Network } from '@deficheckup/engine';

export interface ReportLogo {
  file: `/logos/${string}.svg` | `/logos/${string}.png`;
  backdrop?: 'ink';
}

export type CheckInfo = Pick<Check, 'id' | 'name' | 'networks' | 'officialLink'> & {
  reportLogo?: ReportLogo | undefined;
};

/** Addresses here have already passed resolveInputs. EVM starts with 0x, Solana never does. */
export function checksForAddress(checks: readonly CheckInfo[], address: string) {
  return checks.filter((check) =>
    check.networks.some((network) => (network === 'solana') === !address.startsWith('0x')),
  );
}

export const networkNames: Record<Network, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  polygon: 'Polygon',
  gnosis: 'Gnosis',
  bsc: 'BNB Chain',
  avalanche: 'Avalanche',
  zksync: 'zkSync Era',
  linea: 'Linea',
  scroll: 'Scroll',
  blast: 'Blast',
  mantle: 'Mantle',
  celo: 'Celo',
  'flow-evm': 'Flow EVM',
  hyperliquid: 'Hyperliquid',
  solana: 'Solana',
};

export const descriptions: Record<string, string> = {
  'liquity-surplus':
    'ETH collateral surplus credited after a Liquity V1 redemption or liquidation.',
  'lido-withdrawals': 'Exact claimable ETH from finalized Lido withdrawal NFTs you currently own.',
  'ribbon-v2':
    'Matured withdrawals, queued rounds, paused receipts and unredeemed shares in two Ribbon vaults.',
  'immutable-withdrawals':
    'Prepared L1 withdrawals for standard Immutable X keys and three listed fungible assets.',
  'jupiter-lock':
    'Funded vesting escrows naming your address as recipient, with claimable amounts checked in Jupiter Lock.',
  'instadapp-dsa': 'Tokens and native balances left in Instadapp smart accounts.',
  dsproxy: 'Tokens and native balances left in a DSProxy you own.',
  'giv-tokendistro': 'GIV rewards available from Giveth TokenDistro on Gnosis.',
  'aave-v2-rewards': 'Unclaimed incentives from the supported Aave V2 markets.',
  hyperliquid: 'Perpetual, spot, staking and vault balances on Hyperliquid.',
  merkl: 'Unclaimed Merkl rewards across the supported networks.',
  'safe-owner': 'Balances in Safes you own, with ownership and signature requirements.',
  'compound-v2': 'Compound V2 deposits, pending COMP and balances another app may misreport.',
  cream: 'Deposits left in Cream Ethereum markets where withdrawals are paused.',
  'koi-fees': 'Swap fees left in Koi pools, even after removing liquidity.',
  'koi-lp': 'Your share of both tokens in supported Koi liquidity pools.',
  'koi-amplifier': 'LP tokens left in the six legacy Mute Amplifiers.',
  'koi-farm': 'Staked liquidity and rewards left in supported Koi farms.',
  'safe-locking': 'SAFE available to withdraw or still locked in SafeTokenLock.',
  'uni-2020': 'The 2020 UNI allocation, verified against its Merkle proof and claim status.',
  'zksync-lite': 'Balances left when zkSync Lite shut down, now claimable on Ethereum.',
  'kitty-loot-farm':
    'Withdrawable KittyPunch farm stakes on Flow EVM, with the residual minimum shown separately.',
  'solana-stake':
    'Inactive native stake accounts, with active stake and lockups explained separately.',
  'solana-rent': 'Actual SOL refundable by closing empty SPL Token and Token-2022 accounts.',
  'meteora-dlmm':
    'Empty DLMM position rent and non-empty positions, including liquidity outside its range.',
  'kamino-liquidity':
    'Kamino liquidity strategy receipt tokens held in SPL Token accounts, including old strategies.',
  marginfi:
    'Positive asset shares in marginfi accounts, with borrowing and account restrictions explained.',
};

export function statusText(status: CheckStatus): string {
  switch (status.kind) {
    case 'open':
      return 'Open';
    case 'closing':
      return `Closing: deadline ${status.deadline}`;
    case 'closed-with-claim':
      return `Closed since ${status.since}, claims open`;
    case 'expired':
      return `Expired since ${status.since}`;
  }
}
