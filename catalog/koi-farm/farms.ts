import type { EvmAddress } from '@deficheckup/engine';
import type { KoiToken } from '../koi-fees/pools';

export interface KoiFarm {
  /** The farm contract, in full. Its source is not published. */
  farm: EvmAddress;
  /** The pool whose LP it holds, in full. Must be one of KOI_LP_POOLS. */
  pair: EvmAddress;
  /** The token it pays as a reward, read from real claims. */
  reward: KoiToken;
  /** The contract that sends the reward to the staker, in full. */
  rewardSource: EvmAddress;
}

// Koi farms on zkSync Era that still held LP on 2026-11-01. Found among the LP holders of the 153
// Koi pools in KOI_LP_POOLS: every contract that answers the selector 0x64c73e00(address). All 16
// have the same bytecode (one code hash). Together they held about $152,408 of LP. Each one's reward
// token and reward source come from its latest real claims; every source still held its token.
export const KOI_FARMS: readonly KoiFarm[] = [
  {
    farm: '0xe5095A9d6fe9573722706062EAafaE422134cd33',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    reward: { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    rewardSource: '0x63F44e1Ca8960Df9f463f7E42D2ecB81b7BC2225',
  },
  {
    farm: '0x974B1bAc17fdFD233FD3c4A64A926813D479d40b',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    reward: { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
    rewardSource: '0x750921e5a5eA4C5BeEA9Ec3C0C3F3CBd73A6bF3B',
  },
  {
    farm: '0x4442C47eB97FC9Ab9Ab4BE0977a5E74acE935fc2',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    reward: { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    rewardSource: '0xcEcA08bb7e16ed511875Df7Aa61d165A25f9710d',
  },
  {
    farm: '0xfF76E49f36C4f593639AecB6b6F17d4C94d831c0',
    pair: '0x7C21e2e777CecaF969BF7B7AEF0E3Bf23d043672',
    reward: { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
    rewardSource: '0x750921e5a5eA4C5BeEA9Ec3C0C3F3CBd73A6bF3B',
  },
  {
    farm: '0xa5BFD75f4693f8358A38f3d63Cc4b9cCEEDB61Cb',
    pair: '0x7C21e2e777CecaF969BF7B7AEF0E3Bf23d043672',
    reward: { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    rewardSource: '0x63F44e1Ca8960Df9f463f7E42D2ecB81b7BC2225',
  },
  {
    farm: '0x28d0e5d57504ED9809a2D3cBe3022cc30A29769D',
    pair: '0x7C21e2e777CecaF969BF7B7AEF0E3Bf23d043672',
    reward: { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    rewardSource: '0xcEcA08bb7e16ed511875Df7Aa61d165A25f9710d',
  },
  {
    farm: '0x820681cA09f44dc8637B49194022dce7e1578E29',
    pair: '0x9d2811B85c1d736427722817B69e4D1E98016BB0',
    reward: { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
    rewardSource: '0x750921e5a5eA4C5BeEA9Ec3C0C3F3CBd73A6bF3B',
  },
  {
    farm: '0x7ab201850808c19E882876d8DF573bA07488a72e',
    pair: '0x9d2811B85c1d736427722817B69e4D1E98016BB0',
    reward: { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    rewardSource: '0x63F44e1Ca8960Df9f463f7E42D2ecB81b7BC2225',
  },
  {
    farm: '0x201D3517D503e2Eca73d7bD925D5AF2C8136D407',
    pair: '0x9d2811B85c1d736427722817B69e4D1E98016BB0',
    reward: { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    rewardSource: '0xcEcA08bb7e16ed511875Df7Aa61d165A25f9710d',
  },
  {
    farm: '0x359Da4B89D09f70c4db49Be44aabd9CDa176f9a0',
    pair: '0x33EC51BEc17A25A7Bea04BCD600Cc805142efDeD',
    reward: {
      address: '0x244C238325fC1Bdf6EdeD726EE1b47d55895D944',
      symbol: 'ZORRO',
      decimals: 18,
    },
    rewardSource: '0x37d29EfF3210A51912Df2c354e2d025B4412dd51',
  },
  {
    farm: '0x895B95C1b0B7AFFb3c1886689886e831Ff50bD29',
    pair: '0x33EC51BEc17A25A7Bea04BCD600Cc805142efDeD',
    reward: { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    rewardSource: '0x2Fe6DfD0a98B4BfC5415DFEcC09957a37f405e8F',
  },
  {
    farm: '0xe6fE6e2395028d9b9F1F3c49E5B32daf670606bc',
    pair: '0x19fC0949730bBf1466C3a1718E3CaEFF15C64eda',
    reward: { address: '0xBD4372e44c5eE654dd838304006E1f0f69983154', symbol: 'NODL', decimals: 18 },
    rewardSource: '0x967B73ecfe1a632814f94e30aCD7992cC44197d7',
  },
  {
    farm: '0xF1a088C5B364088Cf88551B0BF2453651FaF4029',
    pair: '0xd5a69D2bD59ae04EA931B4e2bD30aED6A412Ce10',
    reward: { address: '0xed4040fD47629e7c8FBB7DA76bb50B3e7695F0f2', symbol: 'HOLD', decimals: 18 },
    rewardSource: '0x74f2aFb4a0311394662979179790c669bf139876',
  },
  {
    farm: '0x7d301049aEBFFbBF626DD1Af8ADE1aFc77027214',
    pair: '0x14381d5d1352322B038BC988025A1E74dba1BFFe',
    reward: { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    rewardSource: '0x63F44e1Ca8960Df9f463f7E42D2ecB81b7BC2225',
  },
  {
    farm: '0x13Ad7633a0c344c2dc238CEd2362349673D096A7',
    pair: '0x14381d5d1352322B038BC988025A1E74dba1BFFe',
    reward: { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    rewardSource: '0x8b2913bDfA87D7d167F29348C792758ea96424A6',
  },
  {
    farm: '0xbCcE85823Ea5329749749515068783d82863f8Bf',
    pair: '0x5201b081f63B1915b00ce02Da88c4f91dd339bFC',
    reward: { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    rewardSource: '0xA00a921a6f7B61ba998743038cae2BEfc229206A',
  },
];
