import type { EvmAddress } from '@deficheckup/engine';

export interface KoiToken {
  address: EvmAddress;
  symbol: string;
  decimals: number;
}

export interface KoiPool {
  /** The pool (pair) contract, in full. Fees are claimed here with claimFees(). */
  pair: EvmAddress;
  tokens: readonly [KoiToken, KoiToken];
}

// Koi (formerly Mute) pools on zkSync Era whose fee contract held at least $10 of unclaimed fees.
// Built on 2026-11-01 from the factory 0x40be1cBa6C5B47cDF9da7f963B6F761F4C60627D: allPairs() for
// all 2,504 pools, then fees(), token0() and token1() of each, the fee contract's balance of both
// tokens, and DefiLlama prices with confidence of at least 0.9. These pools held about $338,765 of
// the fees still unclaimed; the rest held under $10 each. Symbols and decimals were read on-chain.
// Koi shut down its app, so no new pools are expected.
export const KOI_POOLS: readonly KoiPool[] = [
  {
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xb85feb6aF3412d690DFDA280b73EaED73a2315bC',
    tokens: [
      { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x2C0737AAf530714067396131Ee9BE9cee4cf09A0',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x6f93A1c43980396CDAc8F02C3cAa4078cC271FA9',
    tokens: [
      { address: '0x06A5ce7a85daFAf0116901ECE0E3E103fb5efB75', symbol: 'SHERA', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x042Ded90C26EEA4D860F8E3Bd363Cc4B17CAA00C',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xbFB4b5616044Eded03e5b1AD75141f0D9Cb1499b', symbol: 'ZKDOGE', decimals: 18 },
    ],
  },
  {
    pair: '0x96AF3aa1d4648Cd75749CbD8e70c8Bf1e7900aEE',
    tokens: [
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x7C21e2e777CecaF969BF7B7AEF0E3Bf23d043672',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xBBeB516fb02a01611cBBE0453Fe3c580D7281011', symbol: 'WBTC', decimals: 8 },
    ],
  },
  {
    pair: '0xBe21BCD3a21dC4Dd6C58945f0F5DE4132644020a',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xc8Ec5B0627C794de0e4ea5d97AD9A556B361d243', symbol: 'WISP', decimals: 18 },
    ],
  },
  {
    pair: '0x1bb4855770Eb93e96f5793ABCAcc3106c2Becf31',
    tokens: [
      { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
    ],
  },
  {
    pair: '0x9d2811B85c1d736427722817B69e4D1E98016BB0',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
    ],
  },
  {
    pair: '0xcc686523F485f237dcE685D51A66546d40Bfbc27',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6De27426D15875Ee70cD9917B3F6D54F7f47E42e', symbol: 'ZK🐱', decimals: 9 },
    ],
  },
  {
    pair: '0x3a446ECc4B6F1bF0D45709d100E2371C32f6C392',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0x3848dbd3EAc429497abd464A18fBEC78EF76f750',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x8E86e46278518EFc1C5CEd245cBA2C7e3ef11557', symbol: 'USD+', decimals: 6 },
    ],
  },
  {
    pair: '0xE6F6947B335c887A7715F8561Ee240F9D3AE462a',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0xacE41ffA123a779428eDE67bf9b82eA2783572b1', symbol: 'ZOHM', decimals: 9 },
    ],
  },
  {
    pair: '0x33EC51BEc17A25A7Bea04BCD600Cc805142efDeD',
    tokens: [
      { address: '0x244C238325fC1Bdf6EdeD726EE1b47d55895D944', symbol: 'ZORRO', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xA0ba071F191b39e12B3d16F00C2b40089E5b76E0',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x90eea899185105d583d04B7BDBfb672FcE902a53', symbol: 'ZKPepe', decimals: 18 },
    ],
  },
  {
    pair: '0xdd0E0ba8E02EdE2fAbE88b79d8B03c8BDD73A9f8',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x82036Ac9f185e89205Fed11AE9307Bc0185b43B2', symbol: 'ZkFloki', decimals: 18 },
    ],
  },
  {
    pair: '0xd0c991F54c54022aD5f98B1468668Da7Dc33B8Ef',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xA51Bc2433a33c448DD40F7074bCAB751A1922706', symbol: 'ZINU', decimals: 18 },
    ],
  },
  {
    pair: '0xA60e25B317EEb5E7e12aF002500304a3f9D0bcA5',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x959aB3394246669914BdDEAeB50f8Ac85648615e', symbol: 'ZKPAD', decimals: 18 },
    ],
  },
  {
    pair: '0x5a3a6A4f9F29b4B240298D6F9ADC775412933eB1',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x61B41e0244133B9c9c47A57e51a5EF70be2c5DD4', symbol: 'BOLT', decimals: 18 },
    ],
  },
  {
    pair: '0x58FB07E1Fd51edd7bBa91f870ff751e67e33Cec5',
    tokens: [
      { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xF64f319a3e1AdCE41406783453e8f63a9D378948',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6D27b6252B980Ba4350A1e349a3b684237D5e986', symbol: 'HUSH', decimals: 18 },
    ],
  },
  {
    pair: '0x60aA425628dDBc640c7547cCFCB0c546Db07a88d',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x92706b35B48eA6Ec83bDeCe5555D92674ec94cA8', symbol: 'TOOLS', decimals: 18 },
    ],
  },
  {
    pair: '0x6d3C76C42139c5F769910F9569b9FD726452C6EB',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xCFfeC2c683762831D16a9C5b9c70ba1789bbA1f3', symbol: 'DOF', decimals: 18 },
    ],
  },
  {
    pair: '0x8d51E776f66ca64Ea3f51098a5F2Aac31E01A563',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x5e38CB3e6c0faaFAa5C32C482864fCef5A0660Ad', symbol: 'ZKSHIB', decimals: 18 },
    ],
  },
  {
    pair: '0x9f01ecFf182d159c2888E132Ba24009035eFbD06',
    tokens: [
      { address: '0x503234F203fC7Eb888EEC8513210612a43Cf6115', symbol: 'LUSD', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xF168249833a8244B9d29c123d983E1246446c1A7',
    tokens: [
      { address: '0x080823F341b5332228b46144E3a6FAb52a7Ce79D', symbol: 'WOOF', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x7841660A4323482C9DDE5052e6198A49A56De37b',
    tokens: [
      { address: '0x1127eC84C53D0Ba6D7adB9C8F49342B7E2Ee9458', symbol: 'zkAI', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xFa327A93D82407eaC248858E36F8DBF3008E62C7',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8d266fA745b7Cf3856AF0c778828473B8d33a149', symbol: '$ZFLOKI', decimals: 18 },
    ],
  },
  {
    pair: '0xF7a13fc63b18341843B8197F074528943098c1A6',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8aAAF6E6167825829Ab29F260f246AFE742FB243', symbol: 'zCULT', decimals: 18 },
    ],
  },
  {
    pair: '0xcE7306da570C8F0CDFE0E6F224b83fFD1E32613E',
    tokens: [
      { address: '0x3c0f7Dda83FC0E4DA3fFd726e42E13b93790CC92', symbol: 'zkRoshi', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xf9a7ff47A346E242590f87546d1995DE91B8b8B1',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7C9becB53A7702244Ca260Fd01B4748756CE7BB3', symbol: 'ZKRISE', decimals: 18 },
    ],
  },
  {
    pair: '0x67F01aCbb25c7Ad655405E2E9d0DF9DFC859EE47',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8E8046a8626057489dEbCcfaeD41900C8691E507', symbol: 'ZKSaitma', decimals: 9 },
    ],
  },
  {
    pair: '0x486aDD3A302459DF72441DEAaBC8915f0844d6EC',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xAF3dC9D26CE4E2C2C26397F8746e04fA2FAB4742', symbol: 'ZKEBRA', decimals: 18 },
    ],
  },
  {
    pair: '0x3d04A8054C1A846370778BA2A4805d1Fe4F30405',
    tokens: [
      { address: '0x0231B3DE40B6B3BDd28dcEf037F1b7a3fCf5A95a', symbol: 'ZYN', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x78A70FcdC18a80E1f2BED79a97522F4152106BFB',
    tokens: [
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
      { address: '0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656', symbol: 'DAI', decimals: 18 },
    ],
  },
  {
    pair: '0x90CFBAF341d7296ABaD4475Dae2182a3b14bb44e',
    tokens: [
      { address: '0x45559297BdEDf453e172833AC7086f7D03f6690B', symbol: '$ZKINU', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x4AF1c74B1fe14c4945F35A2bc95B52f5b43Ca168',
    tokens: [
      { address: '0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656', symbol: 'DAI', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x5a97D7A43DC9325F189eB7f93D15458fde826458',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x94466dCFe241db963AF1bc9741a94DAA87AB2169', symbol: 'zkLotto', decimals: 6 },
    ],
  },
  {
    pair: '0x19fC0949730bBf1466C3a1718E3CaEFF15C64eda',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xBD4372e44c5eE654dd838304006E1f0f69983154', symbol: 'NODL', decimals: 18 },
    ],
  },
  {
    pair: '0xa11dBD314CCC3DfeA6094Ab4808D8993C698A52C',
    tokens: [
      { address: '0x158193f88991AB5dF71d58677Da222272Af193F2', symbol: 'BELLS', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x75C6EC0e4bd90D01E79158EB969d592C649bA9D3',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x503234F203fC7Eb888EEC8513210612a43Cf6115', symbol: 'LUSD', decimals: 18 },
    ],
  },
  {
    pair: '0xa812Af9E4a0902CB4d07AA0311bbc1E19Ac19840',
    tokens: [
      { address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', symbol: 'USDC', decimals: 6 },
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
    ],
  },
  {
    pair: '0xf44624B150Fd126748eD7f7fB819459bEF13Cbe4',
    tokens: [
      { address: '0x2141d7fe06A1d69c016fC638bA75b6Ef92Fa1435', symbol: 'ZKID', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x553A6fD0bCB69450F4050FD57b5b99cA9157E74A',
    tokens: [
      { address: '0x06662147240414cc0Dc25E6414100750D346Bc44', symbol: 'FLASHDASH', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xE63Cdd571fA9D5b271871B7000384F9EDa84Fb4F',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8E86e46278518EFc1C5CEd245cBA2C7e3ef11557', symbol: 'USD+', decimals: 6 },
    ],
  },
  {
    pair: '0x62F6E9594728A1D8789CFc6c51C1195A02111216',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xB00610B85A8214b4C5a5731D338E14aaa05e0B15', symbol: 'ZKISHU', decimals: 18 },
    ],
  },
  {
    pair: '0x8FC43eF21794821F8979078E142196E3827950c0',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xCFfeC2c683762831D16a9C5b9c70ba1789bbA1f3', symbol: 'DOF', decimals: 18 },
    ],
  },
  {
    pair: '0x18729525745E9367a8b7e02b5fB4C257388FfDc2',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x89F69aD54e5D05A7A7A1314ecBc7d56D965D3020', symbol: '$WOJAK', decimals: 18 },
    ],
  },
  {
    pair: '0xd5a69D2bD59ae04EA931B4e2bD30aED6A412Ce10',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xed4040fD47629e7c8FBB7DA76bb50B3e7695F0f2', symbol: 'HOLD', decimals: 18 },
    ],
  },
  {
    pair: '0x203cc35A44c384a560D6F598dDe33bB0580C0355',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xA4C00e85ceBc898e885F5055171dc424dbA8bF45', symbol: 'PANDA', decimals: 18 },
    ],
  },
  {
    pair: '0xd23a64aDA1Ac698872848D7806908212AB7FE6fb',
    tokens: [
      { address: '0x27130f9e45318e833728D32FCACde30E639CDc5A', symbol: 'ZKA', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x3C6334fe201091EFbfEeF6F1cebf61F0553f607A',
    tokens: [
      { address: '0x32ec102cD9D885D9c72c6686B001f8C9541AC05F', symbol: 'ZksEx', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x3EA437558603889e95ca4EEe29C235de50Ddb001',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC5519158537f936679cE3F6215bDB4A8ac7A778a', symbol: 'ZKNYAN', decimals: 18 },
    ],
  },
  {
    pair: '0xBF7FBEc1B2EA06cd0cFF4DE093EE584Ab05D98fe',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDA4F01E8A5f86e56f48292144e8DdFAbda17Ef14', symbol: 'YIELD', decimals: 18 },
    ],
  },
  {
    pair: '0x192eFc9a2bB1780A9b4123c672D9096A0c0f52b3',
    tokens: [
      { address: '0x17625b19480f117EE4b1B686A3b44467Eb203d93', symbol: 'MiniDoge', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xE38Be3278D0CC3b4c6d9D196023415843A52cE31',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xF42d97Dbff4AdC5fe32966338C306859A5766511', symbol: 'ZKINU', decimals: 9 },
    ],
  },
  {
    pair: '0x8652959E506d05f037f2aF3C152247EB52F51660',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xa1B6D68e8F35469Cc9a7a7042DeD3749DAD75B6c', symbol: 'ZKF', decimals: 18 },
    ],
  },
  {
    pair: '0x16d8B1Ea7556320d6312F7C9F19eBEEfD0286cC4',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0xBBeB516fb02a01611cBBE0453Fe3c580D7281011', symbol: 'WBTC', decimals: 8 },
    ],
  },
  {
    pair: '0x74321686b356F34722540362f73299753d0CDfff',
    tokens: [
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0x3A5603eF1F0d92f995d173b911Fe1eeFE643bC16',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xFA9653F7a15f38c8ABBcA6F139e49bE06752d09C', symbol: 'zkBITCOIN', decimals: 18 },
    ],
  },
  {
    pair: '0x7Ce4aaF72A22b29A2fb48Ec13194cF876757cD00',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xAC12D34dc5720865f81b16F3e7fac9799Df4F391', symbol: 'BUNS', decimals: 18 },
    ],
  },
  {
    pair: '0x14D76E7ED7463aa51b8b76eFa55393d371D15A47',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8E817eEe4A987EAd05d03cCACb354F67b0DBd63d', symbol: 'zkINA', decimals: 18 },
    ],
  },
  {
    pair: '0x420F0d10531A8b979c3448Bec90F2009aF5D0244',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xeF0cb46C2B13737c0CcBF9E5706dDEe95d409A30', symbol: 'zkMOON', decimals: 18 },
    ],
  },
  {
    pair: '0x14381d5d1352322B038BC988025A1E74dba1BFFe',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xd4169E045bcF9a86cC00101225d9ED61D2F51af2', symbol: 'wrsETH', decimals: 18 },
    ],
  },
  {
    pair: '0xc3717Bc80C9900ff158078A4D36b414458Fa7dcB',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x75eEa25cb24a95EF8d30B279DB3d9424Ad045b75', symbol: 'ZKI', decimals: 18 },
    ],
  },
  {
    pair: '0x0BC2B6A097094228731434956BA2fAfa9a7cD9eb',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDa562340A395ba2F5D72a5EE1B1b60c578768578', symbol: 'GORILLA', decimals: 18 },
    ],
  },
  {
    pair: '0xA98f4e432D14Bfd9456113f4b59498DA32d28447',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6d38eDC3fd269cfDB7EB63dC03fd514d23Ba21AB', symbol: 'ZOLLO', decimals: 18 },
    ],
  },
  {
    pair: '0x7670313E7D93D85ac96768B92d9B2db3168F8B4e',
    tokens: [
      { address: '0x460009bf2353e859f5F59131F0e6A31b8F630Dca', symbol: 'zkGold', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xa1962e4f3676eC7Db3eb4c9564a0Fd6dDF11f04f',
    tokens: [
      { address: '0x052a61eB8194619390156835eDF6fEe29dffDC6D', symbol: 'PRINT', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xA5b095a5d66f86536a64F0e1A6b26A6780758C06',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xA923771462180BFA32FB2c0E3B13e676DA7AC9cF', symbol: 'ZKBONK', decimals: 18 },
    ],
  },
  {
    pair: '0x29E46e2C52D46fBEAD577270984635d2A8D3Fc85',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x93b517eD777069b1823405fC496e9B80C5bBE485', symbol: 'ORRALOZ', decimals: 18 },
    ],
  },
  {
    pair: '0x6499A449d7F2dEFaB76f54A45c9003E0160E385a',
    tokens: [
      { address: '0x545Bc9BD069C687Fab0888Ebc927Bd6DeaD4aa2E', symbol: 'UFI', decimals: 5 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x1ef25cB1EF3A271Fa385851874d3ce8B37a5dc26',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xb313BED135831e0Ba1a4bEaB85e341a097e13993', symbol: 'GEMS', decimals: 18 },
    ],
  },
  {
    pair: '0x9A4aCA3F1a1fCAe4fd7dD4C40e7Ab4C338F9afD2',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xe6A0Ff0ce51c29fDE4Fd518c9FD147010360b59C', symbol: 'ZKGOAT', decimals: 18 },
    ],
  },
  {
    pair: '0xFeB26AeC0c00B0a721703535a0E541969D00BB28',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x682c1A84feFCEfbDB7caB5e1A5102E4b42A37914', symbol: 'ZKBIRD', decimals: 18 },
    ],
  },
  {
    pair: '0x38374c0983f47C60A9a7c4bFf47f3Da6adF84783',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x77Afaa43D24C1599243F9ce0cD442D79f16CD84C', symbol: 'zkERA', decimals: 6 },
    ],
  },
  {
    pair: '0x5201b081f63B1915b00ce02Da88c4f91dd339bFC',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x703b52F2b28fEbcB60E1372858AF5b18849FE867', symbol: 'wstETH', decimals: 18 },
    ],
  },
  {
    pair: '0x59443C61b3Ac70248E464898535C047b9dc0BFa0',
    tokens: [
      { address: '0x2C7b3Fb68b27544BD7D630126D10185443d74cC8', symbol: 'ZKL', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x71407fE535D7f09bB54205260f93595CbDB6F2B4',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xc67aF34d9233dCa9914B105F85e43659382Ed936', symbol: 'zKronos', decimals: 18 },
    ],
  },
  {
    pair: '0x48884dA95C13101DB35e74f3124E1d2213E0cf7B',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xd9519E91119E861585ea093Db457Df5163191189', symbol: 'ZKSINU', decimals: 18 },
    ],
  },
  {
    pair: '0x69A99a15792b75538D39A69b940b3299BCD802D9',
    tokens: [
      { address: '0x2a93D5A40Fdb3182Ae2402D589bE125f01B8A852', symbol: 'PEPE', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xE7AA15811C8419818c8B45A297F64A52ab3e8Ae1',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xD861dE0cE8D2c48637B27C44A8f6A074c937af35', symbol: '$DOF', decimals: 9 },
    ],
  },
  {
    pair: '0xd2FC796c5C4008418Ba30A2426628188FfA0feD9',
    tokens: [
      {
        address: '0x30a49eE2A0814bc9Cb56bD6d8a2941C23154683d',
        symbol: 'ZKWATERFALL',
        decimals: 18,
      },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x0f8B6572DCd59b1f8b153e3Ef3D60853298C253C',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xacE41ffA123a779428eDE67bf9b82eA2783572b1', symbol: 'ZOHM', decimals: 9 },
    ],
  },
  {
    pair: '0x97dA7978b2125651AcdC4A2Ca0567B660A603D7E',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xf98Af2d49D332351EA7B357d0995172FE5dff076', symbol: 'PRINT', decimals: 9 },
    ],
  },
  {
    pair: '0xBf9fB54A7626D3caaba42721B3c2C50Ca0B42543',
    tokens: [
      { address: '0x36962c52Bbc20b7a4a39626Bee124F4Df853D3A8', symbol: '$zkFEG', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x2bE9c31698Ef9D8e157E9698C3a65C4329fF1ec7',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x638B587a96280397E8A891E8f50896c59708a83E', symbol: 'CRH', decimals: 18 },
    ],
  },
  {
    pair: '0xE85d4E3D6139c8629C0EAaD30e924269010fac5C',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7caEb5Fb539a1529b496f01e63994483f963D760', symbol: 'BUBBLE', decimals: 18 },
    ],
  },
  {
    pair: '0x0e207a58511C0890F51d33B66eDDE92F3A32b625',
    tokens: [
      { address: '0x11f87CCe3afE6759E9b5a5897B0e5e91739d51e4', symbol: 'zkPEPE', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x6b606465584ad86B07448389318D1e1B9A2dD473',
    tokens: [
      { address: '0x52DA661112fBC4A20f44f95b12a876e8328306e6', symbol: 'DOF', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xa40e0492388bEc33496090e934D249B6ed5AE591',
    tokens: [
      { address: '0x42c6dfd6029eBA01b2cD701885EA4277162CC393', symbol: 'SPIRAL', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x7C0466324484e6200B8A40Be619F70f4a17800b0',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xEC07e452d9B8e89188B18e10E9C4aCff620001B9', symbol: 'ZKPEINU', decimals: 9 },
    ],
  },
  {
    pair: '0x5722dC30cF95Fd0798A6d09665993Cb069BCAA3d',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x787c09494Ec8Bcb24DcAf8659E7d5D69979eE508', symbol: 'MAV', decimals: 18 },
    ],
  },
  {
    pair: '0xBDEE183DEC1A3df6B514c6aA9e69951cE1fa8162',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
    ],
  },
  {
    pair: '0x28313c005AB16D6FE5C238FAaD43e15e00861607',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xec54bD14c88878ddf4c838D23C926AAF0Ff9c8b4', symbol: 'ZLOKI', decimals: 18 },
    ],
  },
  {
    pair: '0x186c65DE26a1974Be45b56202A6cdD5535Df63b5',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x503234F203fC7Eb888EEC8513210612a43Cf6115', symbol: 'LUSD', decimals: 18 },
    ],
  },
  {
    pair: '0xa47190f80E7ac084ffBA35f53BB5F4bdcE9f3433',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xaCf4aE2cE015AFF0aDC3E2a43D3B10641dE1CC2e', symbol: 'ZkAI', decimals: 9 },
    ],
  },
  {
    pair: '0x0cea0Db8aBc63b6537C28aF8Aa0654516f95e711',
    tokens: [
      { address: '0x564B94bdA371579B17F2B1777a45c9B3AAD8D490', symbol: '$CoreHunter', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x70c55Cb63326662A19B68E1102b40FdfAE703043',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x787c09494Ec8Bcb24DcAf8659E7d5D69979eE508', symbol: 'MAV', decimals: 18 },
    ],
  },
  {
    pair: '0x285Cda20448C222d2BAb46948B9a3D9AACEe80a1',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x92D86594ef8b313e1D402C0Afb55BD126463Dcd2', symbol: 'PEPE2.0', decimals: 18 },
    ],
  },
  {
    pair: '0x631326185F56F92C1C267DA2554Fe4F1A27756A6',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x87F33782e1ba3ae8Fe3D7bEeA2aC988F8F5f1E05', symbol: 'ZKDOGE', decimals: 18 },
    ],
  },
  {
    pair: '0x0F032B888f83509aa7cA6b2EDd67f85150714d18',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDbA8f47e8cd16985298dA5CB8dbf9BF91643a771', symbol: 'CHAD', decimals: 18 },
    ],
  },
  {
    pair: '0x35d3e3A091dCa3a5Aafb0B3766317FED4f424387',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xD76D25245fEBa6382D757aF678364d97C6b84A7e', symbol: 'BMUTE', decimals: 9 },
    ],
  },
  {
    pair: '0x5Ccfba0063Ae8cF6323a63A3c1953A41cF1b97F7',
    tokens: [
      { address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', symbol: 'USDC', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x1195Af62Eaa27660E50E8e7c02527f3b8dC84fcc',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xc7316261CDA88230c8a74d684e361434a38910Ba', symbol: 'ZONK', decimals: 18 },
    ],
  },
  {
    pair: '0xB7d4b367541B862c5a3cD55549E9F4A537679548',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      {
        address: '0x81D60E05C805C27aD5cdb63948c3c7027D3aCfB9',
        symbol: 'ZKSHIBA INU',
        decimals: 18,
      },
    ],
  },
  {
    pair: '0xCb56034911aE65453d1318f51656a9b8c0bF7Fe2',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656', symbol: 'DAI', decimals: 18 },
    ],
  },
  {
    pair: '0xFf2c6230b241a5c183E8f42d3b1805A4ACD9Fb3E',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC8Ac6191CDc9c7bF846AD6b52aaAA7a0757eE305', symbol: 'MVX', decimals: 18 },
    ],
  },
  {
    pair: '0xAa805c52019E275EBF2058e0d656E9676027EFfF',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC7882F291d3FaB78f45872675E9DF4Dd5dB27101', symbol: '$Colax', decimals: 9 },
    ],
  },
  {
    pair: '0x1851D3F6e9b35629f1eC047233341bd128acd820',
    tokens: [
      { address: '0x0ED45c96C58D203Cfa505Dc10985951D8fdBdF89', symbol: 'pepe', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xFC26c2065dc274a260948994905cB38037F6BC26',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x82bED26789f4C3Bb6A0d1053D9Cc8d6d0C6b26D2', symbol: 'MAN', decimals: 18 },
    ],
  },
  {
    pair: '0x750a48bB87020c7bF2783CA15c37d1D2B4168053',
    tokens: [
      { address: '0x444A76f68B373a02CB06f905Ae31857975368B65', symbol: 'ZKG', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xb4129e3c8AD2E717030c92CF7129c944d7e96F9A',
    tokens: [
      { address: '0x5aaDcC28707F56F73294CdE6BA88a2aF8b2497F9', symbol: 'zKOOPA', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xcf0DaadF5431a719cC76BA815d26C26e8A62E01f',
    tokens: [
      { address: '0x1C56B098cD06F6e9e4D1723D5AAf016436F30d55', symbol: 'Sharu', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xf355f1b251b7859460D6F25070a776e3b4aa351A',
    tokens: [
      { address: '0x520E920cf385B3D67A7978f8f87ad5eA09768750', symbol: 'MOND', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xd22e694e4d3C1Bd7A4F7776f78EF81452D4b3f12',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xF8919e2d347cE5eD30Fddb6D5d033f3f59A91E7c', symbol: 'ZkCult', decimals: 9 },
    ],
  },
  {
    pair: '0x3B0E1186B7f3fe69122736eeE3D1446D96E11d88',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xeB34017E79B177480469bF442016F9C5F3037cfa', symbol: 'ZksLock', decimals: 18 },
    ],
  },
  {
    pair: '0x675a678b62258B41Aaf589D5C0cf0190730A6FD9',
    tokens: [
      { address: '0x1f7d02eB231E1EA3dB122e11a5F68273461dbDf3', symbol: 'VOLCANO', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x80919B68FF05eC31684A7f781A40e9A4975f3d4d',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x741AEb387abf6A44DdAEF53998bc97c2696606F1', symbol: 'ZOGE', decimals: 18 },
    ],
  },
  {
    pair: '0x1C6862Fe46B010e8702d3cF559fb8eB58e33d4a3',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x703b52F2b28fEbcB60E1372858AF5b18849FE867', symbol: 'wstETH', decimals: 18 },
    ],
  },
  {
    pair: '0x5779Bb9e33BB4A3346Bb355E0C3cf4ceF851B17f',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xef357189073a1B5bD7d38c47573b0D68B7791dC1', symbol: 'STARK', decimals: 18 },
    ],
  },
  {
    pair: '0x87e6a08281352Aac647a6f8B0950fF59Ca8CbaCC',
    tokens: [
      { address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', symbol: 'USDC', decimals: 6 },
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
    ],
  },
  {
    pair: '0x39d89E4129845b49E6979f321bebB5b8E22A2Eb4',
    tokens: [
      { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
      { address: '0xBBeB516fb02a01611cBBE0453Fe3c580D7281011', symbol: 'WBTC', decimals: 8 },
    ],
  },
  {
    pair: '0x0D04D9d962e69e7cf871Dc2Faf4872EF050FfB24',
    tokens: [
      { address: '0x2bAFb659C57546bC4964452b0704169Db3Ba2f16', symbol: 'ZKS', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xEF62570719590388C20de3c5B78d96e60010968D',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0xA49Db34e75EAdF7a9b90283A38DA28aEc88Bf5FA',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x885335db60a4aaE9133e3f4A84969AD91CAcC061', symbol: 'zkPEPE', decimals: 9 },
    ],
  },
  {
    pair: '0xF347B41dFb671e67973fb347B9759Ad52F952D37',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7E983C35762bDD83E7b49818756Dc9a17f570D37', symbol: '$CROSS', decimals: 9 },
    ],
  },
  {
    pair: '0xD38D6F2e896C6324b7CE8136cB1928619FcAf25b',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x65006841486feb84570d909703aD646DdEaF0F5B', symbol: 'STEAK', decimals: 18 },
    ],
  },
  {
    pair: '0x5E7DF657F18A7aE5c27abb0483163670863177fd',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xF1F70F838eF52CBCFf9E2f3f58E1397c6b72D4A8', symbol: 'ZKL', decimals: 18 },
    ],
  },
  {
    pair: '0xa842F0a174db4CB1669d65C98a5C1f54914D9Cdb',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x5C2733D62c9efD7B26eeBc569408d1b839C56132', symbol: 'ZONKI', decimals: 18 },
    ],
  },
  {
    pair: '0x5130c2Bbf7DBC1f3A3eA27530Ef446Bd7Fdd6740',
    tokens: [
      { address: '0x17189a6620c7B5Fe591F18423FbDA2694A7C7601', symbol: '$BOLT', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x1AA14479c245d3d990B18eAe96bc74B21A744322',
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x8E86e46278518EFc1C5CEd245cBA2C7e3ef11557', symbol: 'USD+', decimals: 6 },
    ],
  },
  {
    pair: '0x92A534eAA8253ED98Ae17B39442770DC74a0a82c',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xCE2005145a571806039099C5C0bd4FE9d7f2d10e', symbol: 'LOTTO', decimals: 18 },
    ],
  },
  {
    pair: '0x1dd8BD97DB8F43359449A5Aa91a0A8b828b02FAB',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xEc1F48eD072dd5A62eFF43d836C4561774b9Fdf6', symbol: 'zKoala', decimals: 18 },
    ],
  },
  {
    pair: '0x62c8a4e37Ad37D4072C370E8D65Fa1c8d1954e37',
    tokens: [
      { address: '0x2A2b5BBeA6Bf881BB557A3e5301A90Ef1eA0c85F', symbol: 'ZKfloki', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xbc47DE79F57b450E6C6D61e0B3AdB9237B5F8116',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDea6d5161978d36b5C0FA6a491faA754f4BC809C', symbol: 'IDO', decimals: 18 },
    ],
  },
  {
    pair: '0xf3Df576b133381fa8f91D1c1f1BFf394A87a3c63',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xD2D6cBbd38acd5F10c7Dc39608F9EEB71B1e4F36', symbol: 'ZKEK', decimals: 18 },
    ],
  },
  {
    pair: '0x2F29458109A54Fdb1C9980e0dCB891201fdA1DBa',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xf00b72140987E136422e1f1CA563212E73b970E2', symbol: 'ONYX', decimals: 18 },
    ],
  },
  {
    pair: '0xf6325F0D3fcd24d7C59b8c3073ef6c51ad23488f',
    tokens: [
      { address: '0x3bEb70E1bE524388CE8B2DCA5174e0598d864e49', symbol: 'zksDex', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x69e55253a5A1f4AB3491229297E8128C8cC96bd0',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xc396B68659CB42676dea43efa53849D3BD6b13e9', symbol: 'Osmo Dex', decimals: 8 },
    ],
  },
  {
    pair: '0x7C8Eee7f4da1883777EB33c1db828Bb1F88D0727',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xcf1b7B98eB4bD08acc8f0A54f4d0DC2E9913Ee7d', symbol: 'zCSNO', decimals: 18 },
    ],
  },
  {
    pair: '0xb39EAAb38167dd2457531f3D1532a8846e242293',
    tokens: [
      { address: '0x4A30DD5F8E6781dD315C3E05AF42f687dDB37345', symbol: 'OT', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xe50f03007bCFF12C6Dc3C907E9cDc66B09C40115',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x82FB7760bEC82cD1d80994e51dBB41fdbcb24D55', symbol: 'ZONE', decimals: 18 },
    ],
  },
  {
    pair: '0x9978dddbEF7618C780dcb5CC3F67DEE625be560a',
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x812F99B8dDdCf65dA61F6826a59CC9cb5903089C', symbol: 'LEVIA', decimals: 18 },
    ],
  },
];
