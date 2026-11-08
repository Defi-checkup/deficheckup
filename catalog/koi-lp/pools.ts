import type { EvmAddress } from '@deficheckup/engine';
import type { KoiToken } from '../koi-fees/pools';

export interface KoiLpPool {
  /** The pool (pair) contract, in full. Its LP token is the pool itself. */
  pair: EvmAddress;
  /** Stable or volatile curve. The router's removeLiquidity asks for it. */
  stable: boolean;
  tokens: readonly [KoiToken, KoiToken];
}

// Koi (formerly Mute) pools on zkSync Era that still held at least $10 of liquidity. Built on
// 2026-11-01 from the factory 0x40be1cBa6C5B47cDF9da7f963B6F761F4C60627D: getReserves() and
// totalSupply() of all 2,504 pools, priced with DefiLlama (confidence of at least 0.9). These 153
// pools held about $1,043,316; the USDC.e/WETH pool alone held $810,115. Part of that liquidity sits
// in Koi's own farm and bond contracts, not in wallets. Symbols and decimals were read on-chain.
export const KOI_LP_POOLS: readonly KoiLpPool[] = [
  {
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x7C21e2e777CecaF969BF7B7AEF0E3Bf23d043672',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xBBeB516fb02a01611cBBE0453Fe3c580D7281011', symbol: 'WBTC', decimals: 8 },
    ],
  },
  {
    pair: '0x9d2811B85c1d736427722817B69e4D1E98016BB0',
    stable: true,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
    ],
  },
  {
    pair: '0x6499A449d7F2dEFaB76f54A45c9003E0160E385a',
    stable: false,
    tokens: [
      { address: '0x545Bc9BD069C687Fab0888Ebc927Bd6DeaD4aa2E', symbol: 'UFI', decimals: 5 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xf9a7ff47A346E242590f87546d1995DE91B8b8B1',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7C9becB53A7702244Ca260Fd01B4748756CE7BB3', symbol: 'ZKRISE', decimals: 18 },
    ],
  },
  {
    pair: '0x33EC51BEc17A25A7Bea04BCD600Cc805142efDeD',
    stable: false,
    tokens: [
      { address: '0x244C238325fC1Bdf6EdeD726EE1b47d55895D944', symbol: 'ZORRO', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x96AF3aa1d4648Cd75749CbD8e70c8Bf1e7900aEE',
    stable: false,
    tokens: [
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x58FB07E1Fd51edd7bBa91f870ff751e67e33Cec5',
    stable: false,
    tokens: [
      { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x5a3a6A4f9F29b4B240298D6F9ADC775412933eB1',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x61B41e0244133B9c9c47A57e51a5EF70be2c5DD4', symbol: 'BOLT', decimals: 18 },
    ],
  },
  {
    pair: '0x042Ded90C26EEA4D860F8E3Bd363Cc4B17CAA00C',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xbFB4b5616044Eded03e5b1AD75141f0D9Cb1499b', symbol: 'ZKDOGE', decimals: 18 },
    ],
  },
  {
    pair: '0xB67e768AeE21Aa86aD9230f2951F260b9908e896',
    stable: false,
    tokens: [
      { address: '0x1f559e1044D3c48871754592B7FD5602B66F7003', symbol: 'ZKOI', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x2C0737AAf530714067396131Ee9BE9cee4cf09A0',
    stable: true,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x7C0466324484e6200B8A40Be619F70f4a17800b0',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xEC07e452d9B8e89188B18e10E9C4aCff620001B9', symbol: 'ZKPEINU', decimals: 9 },
    ],
  },
  {
    pair: '0x19fC0949730bBf1466C3a1718E3CaEFF15C64eda',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xBD4372e44c5eE654dd838304006E1f0f69983154', symbol: 'NODL', decimals: 18 },
    ],
  },
  {
    pair: '0xd5a69D2bD59ae04EA931B4e2bD30aED6A412Ce10',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xed4040fD47629e7c8FBB7DA76bb50B3e7695F0f2', symbol: 'HOLD', decimals: 18 },
    ],
  },
  {
    pair: '0xA60e25B317EEb5E7e12aF002500304a3f9D0bcA5',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x959aB3394246669914BdDEAeB50f8Ac85648615e', symbol: 'ZKPAD', decimals: 18 },
    ],
  },
  {
    pair: '0x3a446ECc4B6F1bF0D45709d100E2371C32f6C392',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0x3C6334fe201091EFbfEeF6F1cebf61F0553f607A',
    stable: false,
    tokens: [
      { address: '0x32ec102cD9D885D9c72c6686B001f8C9541AC05F', symbol: 'ZksEx', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x553A6fD0bCB69450F4050FD57b5b99cA9157E74A',
    stable: false,
    tokens: [
      { address: '0x06662147240414cc0Dc25E6414100750D346Bc44', symbol: 'FLASHDASH', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xBe21BCD3a21dC4Dd6C58945f0F5DE4132644020a',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xc8Ec5B0627C794de0e4ea5d97AD9A556B361d243', symbol: 'WISP', decimals: 18 },
    ],
  },
  {
    pair: '0xA98f4e432D14Bfd9456113f4b59498DA32d28447',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6d38eDC3fd269cfDB7EB63dC03fd514d23Ba21AB', symbol: 'ZOLLO', decimals: 18 },
    ],
  },
  {
    pair: '0xa1ADE248490a3f78a1B9EC88F7FFa98b1b24c8E6',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x97734f72Ca1c0a1dC5F08a5b09204CB2Bd887A2F', symbol: 'GTS', decimals: 18 },
    ],
  },
  {
    pair: '0x14381d5d1352322B038BC988025A1E74dba1BFFe',
    stable: true,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xd4169E045bcF9a86cC00101225d9ED61D2F51af2', symbol: 'wrsETH', decimals: 18 },
    ],
  },
  {
    pair: '0xFC26c2065dc274a260948994905cB38037F6BC26',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x82bED26789f4C3Bb6A0d1053D9Cc8d6d0C6b26D2', symbol: 'MAN', decimals: 18 },
    ],
  },
  {
    pair: '0xA0ba071F191b39e12B3d16F00C2b40089E5b76E0',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x90eea899185105d583d04B7BDBfb672FcE902a53', symbol: 'ZKPepe', decimals: 18 },
    ],
  },
  {
    pair: '0x675a678b62258B41Aaf589D5C0cf0190730A6FD9',
    stable: false,
    tokens: [
      { address: '0x1f7d02eB231E1EA3dB122e11a5F68273461dbDf3', symbol: 'VOLCANO', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xd088DE21b66207dE40bfB560fe380e4C8DB37bb8',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xCcAc181B35705d61fD166D3aE67466e9C2C137eA', symbol: 'ZNK', decimals: 18 },
    ],
  },
  {
    pair: '0x0BC2B6A097094228731434956BA2fAfa9a7cD9eb',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDa562340A395ba2F5D72a5EE1B1b60c578768578', symbol: 'GORILLA', decimals: 18 },
    ],
  },
  {
    pair: '0x5201b081f63B1915b00ce02Da88c4f91dd339bFC',
    stable: true,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x703b52F2b28fEbcB60E1372858AF5b18849FE867', symbol: 'wstETH', decimals: 18 },
    ],
  },
  {
    pair: '0x6fb43C1fBa34dFBF81D3dF01E464Ad3b38bE62A2',
    stable: false,
    tokens: [
      { address: '0x0250B200422eA4EDc34DbeCc0F15aF182853Bf7B', symbol: 'Never', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x192eFc9a2bB1780A9b4123c672D9096A0c0f52b3',
    stable: false,
    tokens: [
      { address: '0x17625b19480f117EE4b1B686A3b44467Eb203d93', symbol: 'MiniDoge', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x69A99a15792b75538D39A69b940b3299BCD802D9',
    stable: false,
    tokens: [
      { address: '0x2a93D5A40Fdb3182Ae2402D589bE125f01B8A852', symbol: 'PEPE', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xB7d4b367541B862c5a3cD55549E9F4A537679548',
    stable: false,
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
    pair: '0xBDEE183DEC1A3df6B514c6aA9e69951cE1fa8162',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
    ],
  },
  {
    pair: '0xbfADD7d3AacECC7af6E5ABdeEb216E90ae199Dd1',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x9290A318D83CD12B47a452CD590FE7213E0073EC', symbol: 'BERNIE', decimals: 18 },
    ],
  },
  {
    pair: '0xd0c991F54c54022aD5f98B1468668Da7Dc33B8Ef',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xA51Bc2433a33c448DD40F7074bCAB751A1922706', symbol: 'ZINU', decimals: 18 },
    ],
  },
  {
    pair: '0x9BAD35EDB9380a4E45225A78F1F65289b2FCa65A',
    stable: false,
    tokens: [
      { address: '0x44F95088D5666050C8731A15FB46277025B24dF9', symbol: 'ELNGMA', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x62F6E9594728A1D8789CFc6c51C1195A02111216',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xB00610B85A8214b4C5a5731D338E14aaa05e0B15', symbol: 'ZKISHU', decimals: 18 },
    ],
  },
  {
    pair: '0xa812Af9E4a0902CB4d07AA0311bbc1E19Ac19840',
    stable: true,
    tokens: [
      { address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', symbol: 'USDC', decimals: 6 },
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
    ],
  },
  {
    pair: '0xb85feb6aF3412d690DFDA280b73EaED73a2315bC',
    stable: false,
    tokens: [
      { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x75C6EC0e4bd90D01E79158EB969d592C649bA9D3',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x503234F203fC7Eb888EEC8513210612a43Cf6115', symbol: 'LUSD', decimals: 18 },
    ],
  },
  {
    pair: '0xBDD2F71C5Ff75901e7FDAAaC4C5B5B83d6959EAa',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6Eaa57B60584B359307D0F9A3c0bd0C781ED69e0', symbol: 'ZKTRUMP', decimals: 18 },
    ],
  },
  {
    pair: '0x182881e87a5AD0e7C3F30AdF997937100e508569',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8C8Af9F918A6603fD7f39A8E8Ae455B3b1c2529E', symbol: 'ZKF', decimals: 18 },
    ],
  },
  {
    pair: '0x7C8Eee7f4da1883777EB33c1db828Bb1F88D0727',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xcf1b7B98eB4bD08acc8f0A54f4d0DC2E9913Ee7d', symbol: 'zCSNO', decimals: 18 },
    ],
  },
  {
    pair: '0x150306D92a75bEBB95A69230f7e75DaD22D42850',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xB06BA73AcD716052C1e7859A59642c7684550C0f', symbol: 'ZKF', decimals: 18 },
    ],
  },
  {
    pair: '0xd2FC796c5C4008418Ba30A2426628188FfA0feD9',
    stable: false,
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
    pair: '0xFa327A93D82407eaC248858E36F8DBF3008E62C7',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8d266fA745b7Cf3856AF0c778828473B8d33a149', symbol: '$ZFLOKI', decimals: 18 },
    ],
  },
  {
    pair: '0xAbf8157A005fCC8d754926d7deCE07ff93E8f663',
    stable: false,
    tokens: [
      { address: '0x2c2BeBFd2F6512Dcd185E2Bf29d1DC498cF20056', symbol: 'ZFK', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x1AA14479c245d3d990B18eAe96bc74B21A744322',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x8E86e46278518EFc1C5CEd245cBA2C7e3ef11557', symbol: 'USD+', decimals: 6 },
    ],
  },
  {
    pair: '0x312a402df5aC86DF59b47C1fc0064734320915dC',
    stable: false,
    tokens: [
      { address: '0x03bD411dAbfF0B13480F45e1050d511c7Ea29998', symbol: 'ZLOVE', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x3EA437558603889e95ca4EEe29C235de50Ddb001',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC5519158537f936679cE3F6215bDB4A8ac7A778a', symbol: 'ZKNYAN', decimals: 18 },
    ],
  },
  {
    pair: '0x78A70FcdC18a80E1f2BED79a97522F4152106BFB',
    stable: true,
    tokens: [
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
      { address: '0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656', symbol: 'DAI', decimals: 18 },
    ],
  },
  {
    pair: '0x440b30599613b45236f43da94f464D6b69601d71',
    stable: false,
    tokens: [
      { address: '0x32F052ACb5626E1158baa2A2CDdaaBB5f644aB69', symbol: 'zkCheemsInu', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x773374958A210B1774d8267be574B59CC2aba060',
    stable: false,
    tokens: [
      { address: '0x0A75b1226a121478F7AC6B37aC9001a34a6832B7', symbol: 'ZKI', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x0e207a58511C0890F51d33B66eDDE92F3A32b625',
    stable: false,
    tokens: [
      { address: '0x11f87CCe3afE6759E9b5a5897B0e5e91739d51e4', symbol: 'zkPEPE', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xF64f319a3e1AdCE41406783453e8f63a9D378948',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6D27b6252B980Ba4350A1e349a3b684237D5e986', symbol: 'HUSH', decimals: 18 },
    ],
  },
  {
    pair: '0xd22e694e4d3C1Bd7A4F7776f78EF81452D4b3f12',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xF8919e2d347cE5eD30Fddb6D5d033f3f59A91E7c', symbol: 'ZkCult', decimals: 9 },
    ],
  },
  {
    pair: '0x16d8B1Ea7556320d6312F7C9F19eBEEfD0286cC4',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0xBBeB516fb02a01611cBBE0453Fe3c580D7281011', symbol: 'WBTC', decimals: 8 },
    ],
  },
  {
    pair: '0x4AF1c74B1fe14c4945F35A2bc95B52f5b43Ca168',
    stable: false,
    tokens: [
      { address: '0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656', symbol: 'DAI', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x9f01ecFf182d159c2888E132Ba24009035eFbD06',
    stable: false,
    tokens: [
      { address: '0x503234F203fC7Eb888EEC8513210612a43Cf6115', symbol: 'LUSD', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x1bb4855770Eb93e96f5793ABCAcc3106c2Becf31',
    stable: false,
    tokens: [
      { address: '0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42', symbol: 'MUTE', decimals: 18 },
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
    ],
  },
  {
    pair: '0xA49Db34e75EAdF7a9b90283A38DA28aEc88Bf5FA',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x885335db60a4aaE9133e3f4A84969AD91CAcC061', symbol: 'zkPEPE', decimals: 9 },
    ],
  },
  {
    pair: '0xf1f7F2269f4E4B3D1e29F99C0a3146366ca7D5ae',
    stable: false,
    tokens: [
      { address: '0x117F11D3f1A78CB4ea7e0517d9Ced156731497C1', symbol: 'test', decimals: 18 },
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
    ],
  },
  {
    pair: '0x1C96318BFd32358117a20B0C1bBa06DEF93733B5',
    stable: false,
    tokens: [
      { address: '0x2039bb4116B4EFc145Ec4f0e2eA75012D6C0f181', symbol: 'BUSD', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x03E6d700F85BaDfC059E958B93bb0Ad604867cCA',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x644Aa65dE98E0E2422c569cc085df55E3B23Cef2', symbol: 'ZKEN', decimals: 18 },
    ],
  },
  {
    pair: '0x5Ccfba0063Ae8cF6323a63A3c1953A41cF1b97F7',
    stable: false,
    tokens: [
      { address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', symbol: 'USDC', decimals: 6 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xE63Cdd571fA9D5b271871B7000384F9EDa84Fb4F',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8E86e46278518EFc1C5CEd245cBA2C7e3ef11557', symbol: 'USD+', decimals: 6 },
    ],
  },
  {
    pair: '0xbD787aE52791b975dda21587936171cA3872f4d3',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xCD6D43112e9D7A9E38C80c98B61ce7733B1dAAfb', symbol: "DON'T", decimals: 9 },
    ],
  },
  {
    pair: '0xcc686523F485f237dcE685D51A66546d40Bfbc27',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6De27426D15875Ee70cD9917B3F6D54F7f47E42e', symbol: 'ZK🐱', decimals: 9 },
    ],
  },
  {
    pair: '0x8C1DfE46737fB25840b4B37056BFcA472234eaf0',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656', symbol: 'DAI', decimals: 18 },
    ],
  },
  {
    pair: '0x40B5a5e136b02C051298D0A611fdAA321cEDF939',
    stable: false,
    tokens: [
      { address: '0x3153349b6C2a10141f4eeD0F01a0C5Fbe3626dAb', symbol: 'ZKBD', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xEe4C25Ff2208b2fA9ef4Cf50385365F035512092',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8aBE4D2B6cfc67D30dCbB5AB475e43AB179F83a7', symbol: 'PABLETE', decimals: 18 },
    ],
  },
  {
    pair: '0x8aE2547feCB82B8c2A17c5774Ae7642E82E090ca',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x953b3fAd4FE3908484e3d991c90a73df845960AA', symbol: 'ETHEREUM', decimals: 18 },
    ],
  },
  {
    pair: '0x139E7dDf7b989fdFa1DaF024Abd6d979c2d695a0',
    stable: false,
    tokens: [
      { address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', symbol: 'USDC', decimals: 6 },
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
    ],
  },
  {
    pair: '0x2D4c331e133c72D8b147f105E4365c2315B2F068',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC4e0753ac6FC41B228415050900253cD850854f2', symbol: 'TESTING', decimals: 18 },
    ],
  },
  {
    pair: '0x0EcB95C300a92e0Bc7384BBeFDa7ea12287f630D',
    stable: false,
    tokens: [
      { address: '0x2eD713a31c11614791eA05EdA24440DFea243D54', symbol: 'ZPS', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xe62634873070D5bB606Fc2470BDFd7D8aea9609d',
    stable: false,
    tokens: [
      { address: '0x4530AD92659eFC96A68f722f93867377bC1C6b4A', symbol: 'ZkAI', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xBF7FBEc1B2EA06cd0cFF4DE093EE584Ab05D98fe',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDA4F01E8A5f86e56f48292144e8DdFAbda17Ef14', symbol: 'YIELD', decimals: 18 },
    ],
  },
  {
    pair: '0x3c3Ddf23dA8ceedDfeE0a49dF43C3426161aE6fa',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x70236AD2A9A8C6F650A7450bD76A9A0F2Beda2C7', symbol: 'ZKBONK', decimals: 18 },
    ],
  },
  {
    pair: '0x186c65DE26a1974Be45b56202A6cdD5535Df63b5',
    stable: true,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x503234F203fC7Eb888EEC8513210612a43Cf6115', symbol: 'LUSD', decimals: 18 },
    ],
  },
  {
    pair: '0x1F2fb5baf3cB1D1e20d8bdD8af807dDDC549aF33',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7d81AA13604D74761f75AFF653F8F2F71c712950', symbol: 'ZKHUSKY', decimals: 18 },
    ],
  },
  {
    pair: '0x110937a49aA7dA9D593c43E101f45FE186B32A15',
    stable: false,
    tokens: [
      { address: '0x4Ee0B9a641f0a5AbFe83c26eA3e310d6EF82fFd5', symbol: 'ZKSHIBA', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xB9c64e87f0874480CB22327d53519954ff88f59d',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xea2b4F30F0F3A2F90428Aca660429e4adB5EF239', symbol: 'ZksCat', decimals: 9 },
    ],
  },
  {
    pair: '0x9363a486cEdC0dbccC1d44EAA427C4479884017D',
    stable: false,
    tokens: [
      { address: '0x3e65a23ee3E50bCa17456cE0F198bD86a9652275', symbol: 'ZKDC', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xb6416Bed805Ff4cd7771B3F65135Ab8AA982002A',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xa49BD3587D6e576E27C46D6CDD69F8675B3b5266', symbol: 'ZBase', decimals: 9 },
    ],
  },
  {
    pair: '0x7cB5301f6e730E2cECfa1983Cf44c3584043Ff1E',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x5DA75bBE42bFC580FC9F21D6671e9C645B891fDf', symbol: 'Bones', decimals: 9 },
    ],
  },
  {
    pair: '0x35547eF3BA721bB053E32D0bBA032abAD21c9199',
    stable: false,
    tokens: [
      { address: '0x2aDa5fcD4312759644C0b1c352B84059268092Ce', symbol: 'MPT', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xEBdcD309f9d555B8AcC115C3B269a2a4AF2177fd',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDc12A45344bF59ea8f879F7dc0D9F54D4E56A0B6', symbol: 'ZKTV', decimals: 9 },
    ],
  },
  {
    pair: '0xF7a13fc63b18341843B8197F074528943098c1A6',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x8aAAF6E6167825829Ab29F260f246AFE742FB243', symbol: 'zCULT', decimals: 18 },
    ],
  },
  {
    pair: '0xea7E114C7ACb13076cc1a234eA53D6AddfE16f93',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x9F0eA11E706DC5BEC753092506574055912F22a1', symbol: 'COPA', decimals: 9 },
    ],
  },
  {
    pair: '0xA433b674E4569CEbD39F80556BDB5b86C9228f10',
    stable: false,
    tokens: [
      { address: '0x3423d4E2b89605d54492b0AB7B25Bcdd9bF5aeE9', symbol: 'SURF', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xb814ccd26FFF2e5192a05b0b63695454655adeC1',
    stable: false,
    tokens: [
      { address: '0x56E1fcB428F8a6154c6bDE8754269Ee280612E4C', symbol: 'F2', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xd8e0d34E3D0A7C926AE93A026753688BB4FA9cbE',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x9e0e13ce3C9FEAe640856D78A2D4985085993734', symbol: 'DIT', decimals: 18 },
    ],
  },
  {
    pair: '0xE6B9d6d1646BECa223B6914f4701e1165867909e',
    stable: false,
    tokens: [
      {
        address: '0x1612BF511E7D0215cB26a028D3697CcAc5b17e5F',
        symbol: 'get zksync airdrop',
        decimals: 18,
      },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x9E93430C5245a527fac603C70e5F50981CB3Bb7B',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xE15b69660aFcEAD954623ba7E121e3cCE77CDf15', symbol: 'Saitama', decimals: 9 },
    ],
  },
  {
    pair: '0xaaa8546a2b3491bB26A0Ad13fBc5c5b7d8d9fA2B',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC2aacb88f9d6Fd5fa10188935ed6be848B88Aee0', symbol: 'DT1', decimals: 9 },
    ],
  },
  {
    pair: '0x62E02eC69F16FAe138Be11Ea5144FD78510b5aa5',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x61eA026567C4033E2A52c14780327F6F433A5a31', symbol: 'HELLO', decimals: 18 },
    ],
  },
  {
    pair: '0x56183ca8Bc02a1B6521ADfccc84ffAfa7ae2b514',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC3EC4ae3387Ae7f7148C6fAeb78cb81A5A012A49', symbol: 'zKSwap', decimals: 9 },
    ],
  },
  {
    pair: '0xCaD3558ff3222b95d90e8B8Ac6b34Aa3565E64b6',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xcC7662C11eDB59B23AeAF7Bab75E21Eb3b10894c', symbol: 'Icles', decimals: 18 },
    ],
  },
  {
    pair: '0x438b0138fe921A3104d1d1fd5640c44a54Bc7113',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xb221feCd00096E1Ed49f32e85dBf3d0a749cd0BD', symbol: 'Saitama', decimals: 9 },
    ],
  },
  {
    pair: '0x8E29B713D4CE1f07fb2E78c27Cc285Fca7850EB8',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x9921CE487Efb10cf54a27ebD7E7645B359019F7d', symbol: 'AKJ', decimals: 18 },
    ],
  },
  {
    pair: '0xb82A1797e28d5a0D67Ed8E229A35dd81676fe20f',
    stable: false,
    tokens: [
      { address: '0x568151265467a429C7d399897D06A0Fb62Ab0f4C', symbol: 'OS2', decimals: 8 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xA509af787AE0aE4f35d45460Be60F9446e1D4de2',
    stable: false,
    tokens: [
      { address: '0x26bDB893a32c1d2cE1Baa49f268Aa9a07e7c05da', symbol: 'ZKTV2', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x4a9138c46E2E51260073BD6788AF237d65e7B1cb',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x810E2D0E0536A6d336e131BfBd9587B9f76BEDB1', symbol: 'DT', decimals: 9 },
    ],
  },
  {
    pair: '0x5889089A5df826eaE6ef97cc2892Bf120D76709A',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC70Af5a31157edE700178dEc18EC0DA83f7fDE27', symbol: 'ZETHTEST5', decimals: 18 },
    ],
  },
  {
    pair: '0xc85EBA221937a0b450536747eBC4D98d0181130A',
    stable: false,
    tokens: [
      { address: '0x25A50F681f6ed57c0e0D979Eb13d43a58f8A6A83', symbol: 'SYNC', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xba8a885E7FCE28F05B4fCA8F653072C7E159557A',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7995D64a3e288F92A93B26b6C00152E2755E13e3', symbol: 'FSYNC', decimals: 9 },
    ],
  },
  {
    pair: '0xe1AcB461DB280065FB9bdBf6E0958BdCB098FC25',
    stable: false,
    tokens: [
      { address: '0x0B8238811F6Ce4b428F48e3E22b21Dc147A8b3fc', symbol: 'ZKM', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xFf2c6230b241a5c183E8f42d3b1805A4ACD9Fb3E',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xC8Ac6191CDc9c7bF846AD6b52aaAA7a0757eE305', symbol: 'MVX', decimals: 18 },
    ],
  },
  {
    pair: '0x38221FD812Cd0b941bc8C2db8739606F4f844eAe',
    stable: false,
    tokens: [
      { address: '0x4F93Bee96F718fCb59eC3E2e73767eD6dd470CD9', symbol: 'zksBONK', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x150377e388f61167F81D0e26eC32785389209ee3',
    stable: false,
    tokens: [
      { address: '0x2dE8E2b50BC428E3479A75B073FEDf0111Be3289', symbol: 'FOT', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x5722dC30cF95Fd0798A6d09665993Cb069BCAA3d',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x787c09494Ec8Bcb24DcAf8659E7d5D69979eE508', symbol: 'MAV', decimals: 18 },
    ],
  },
  {
    pair: '0x38374c0983f47C60A9a7c4bFf47f3Da6adF84783',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x77Afaa43D24C1599243F9ce0cD442D79f16CD84C', symbol: 'zkERA', decimals: 6 },
    ],
  },
  {
    pair: '0x1be35109Cc8308ea706E6D5E53c818D2C05ce64D',
    stable: false,
    tokens: [
      { address: '0x240d17bCaa8FC99881e08d4298609f807a4aba82', symbol: '$PEPE', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x84d4D65116f7BbA15cA4B441ef4C0A6A93DB4C0F',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x62deC5d068F8bE5E469B39A14A7CFaAc7F8a58E0', symbol: 'MFT', decimals: 18 },
    ],
  },
  {
    pair: '0xEF62570719590388C20de3c5B78d96e60010968D',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0x8FC43eF21794821F8979078E142196E3827950c0',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xCFfeC2c683762831D16a9C5b9c70ba1789bbA1f3', symbol: 'DOF', decimals: 18 },
    ],
  },
  {
    pair: '0x3FE0E66130cE31c3Ef8059d6FdDBaB250D719577',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x5daFB02a174915dfd3818FB997089cd55243133f', symbol: 'EOT', decimals: 18 },
    ],
  },
  {
    pair: '0xe1d6A1c300A987150f87626C6C312d759f5b2a40',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xe64b80eaB2a4D1877f63198c4Fe0b96b02aF8BaF', symbol: 'ZKup', decimals: 18 },
    ],
  },
  {
    pair: '0x0A499Ec28D6d83c21F663D5Ee214DA1AEBCD4D7f',
    stable: false,
    tokens: [
      { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0xa1A9193E4e901c6f242360dD24f19D224A55e5B4',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x81554e3a82005695FbaDdC4891A6F02eea84644b', symbol: 'MOFX', decimals: 15 },
    ],
  },
  {
    pair: '0x526dbeb88b5eD0d44236DaaD9C4EAaA0b4CDa23b',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x605e6e14bf4d45c6B7A1AE00fe57ceb9D58BA429', symbol: 'CHENKO', decimals: 18 },
    ],
  },
  {
    pair: '0x492Bd36f535c4A39193d8ac43B7cabCe7a2895Dc',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x87FDd473d26B94DFC2d4b4841CfB6F866681FE12', symbol: 'ZKLAB', decimals: 18 },
    ],
  },
  {
    pair: '0x8017b29F7Eb5e3a62Bf7945dB8A308BAbD4D9F35',
    stable: false,
    tokens: [
      { address: '0x28a487240e4D45CfF4A2980D334CC933B7483842', symbol: 'MATIC', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x622567b17bE5A30d0c31598eAB465e040133Ea0D',
    stable: false,
    tokens: [
      { address: '0x2949c2EC8295139ef2C7d3EF9584314De6cf6C20', symbol: '$MOOMAGA', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xc1a1ad40c57Bea6ba5A6e4969F8564981DD55115',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xE24478aD11a4b50Fca8A8aCA3e0dF82190C837B3', symbol: 'MEOW', decimals: 9 },
    ],
  },
  {
    pair: '0x98BDDEa1aBCa07Cc63DD2f7ab6d3016C4De7Ad1C',
    stable: false,
    tokens: [
      { address: '0x41eFE32b2C7B026741378B3C33a51fBA1D21d324', symbol: 'zklabs', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xe4fAa243434A376bdd1497b74b690BFb74EBe326',
    stable: false,
    tokens: [
      { address: '0x2bAA672670dD38e01a6133a3b40eB3f2Cb7F3F85', symbol: 'CHENKO', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xfcF53727beA5F619ECB9d5837E7d7B4D151D8A3c',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0xdb211E501A1F514eEa562e42E39B97161AE7b00d', symbol: 'ZKSMETAFI', decimals: 18 },
    ],
  },
  {
    pair: '0x366F1Fd1A67bB38e70d4Ca0E4f7326d4E426c77E',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x959aB3394246669914BdDEAeB50f8Ac85648615e', symbol: 'ZKPAD', decimals: 18 },
    ],
  },
  {
    pair: '0x7841660A4323482C9DDE5052e6198A49A56De37b',
    stable: false,
    tokens: [
      { address: '0x1127eC84C53D0Ba6D7adB9C8F49342B7E2Ee9458', symbol: 'zkAI', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0x2aD03eD321934dDB294f31438fdD0eE0E3132d5C',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xfc0CB5F3A1c21fD53665a743B44a1A85349681Bf', symbol: 'KILLARB', decimals: 18 },
    ],
  },
  {
    pair: '0x309B7896BF03a17106Ad7F09B8BFfb0e7379719b',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xE9aBfbA23Fb8962Ec836E41FCa086A9A4bb5c3f1', symbol: '#rat', decimals: 18 },
    ],
  },
  {
    pair: '0x4281E36F7Ec392f8fDbb14E34B8D077d007aca97',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xd7C02C3F8e025bA72725b8A0C14fa9154FA3616c', symbol: 'OSY', decimals: 9 },
    ],
  },
  {
    pair: '0x407B7C9B25C21AD62c18691328e4182DF05C0aE2',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xaEEb80f15e35991b8cf3fE42160f2CFeD600a3b6', symbol: 'HEX', decimals: 9 },
    ],
  },
  {
    pair: '0x64b79D62fB8bbAD7b38A660a5bcF37650a92f7A4',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xfEb6A01637Af4Bb5E7A6E5991F5883a79221AD64', symbol: 'ACOPE', decimals: 18 },
    ],
  },
  {
    pair: '0x8566E15db81C554313A3528B06889898A2aDA706',
    stable: false,
    tokens: [
      { address: '0x3228FB9FfaC31bd6f8538927412bB2a97b7345FD', symbol: 'USRTEST', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xe093999d06f4eD9E36d5E4F5E01f9eDEa7974C5a',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x7E7BCB202b8926D1381f2F9422b1e39EF86fE681', symbol: 'ZkAI', decimals: 9 },
    ],
  },
  {
    pair: '0x5703a68eFb30EF1dD5575c7F4f67784b2D239C5D',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xB6A685607Bd408150f99a7cb520cb94beEb40b50', symbol: 'test1', decimals: 10 },
    ],
  },
  {
    pair: '0xcDf232378b71377945413E097640a8cCba679Ec5',
    stable: false,
    tokens: [
      { address: '0x18dAc9a3540C7c9Daa705EF6Da02847EC2C471D9', symbol: 'TESTING', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xB99DaaEeefEac4ccd1C8107a694Ca43B0556c625',
    stable: false,
    tokens: [
      { address: '0x0c9F9cFF49f59a91C5F1014ab9c3aD4027Ce2622', symbol: 'ZKFI', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xaf172edD09dEc647a4a02799ca76d70699c94f2f',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x6af533258F56A430913Bf630119bB59b59EF0B3b', symbol: 'LFG', decimals: 9 },
    ],
  },
  {
    pair: '0xB64C49B5b38135CE23AE965EcD751AaaA8FE520b',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xd5386AbE580b85bf9aFE5216F55Ae28F520b5206', symbol: 'OASIS', decimals: 18 },
    ],
  },
  {
    pair: '0x4b464370e63dD60B472B0D1A176ef12A3a24b03d',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x9Aee99C54336D6f7d822bc6C56C7A0E738C94ccC', symbol: 'ZKsHobbes', decimals: 18 },
    ],
  },
  {
    pair: '0x74321686b356F34722540362f73299753d0CDfff',
    stable: false,
    tokens: [
      { address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', symbol: 'USDT', decimals: 6 },
      { address: '0xa995ad25Ce5eB76972ab356168f5e1D9257E4d05', symbol: 'KOI', decimals: 18 },
    ],
  },
  {
    pair: '0xfE323479dc0b71106678aDa165d9c6741A12A804',
    stable: false,
    tokens: [
      { address: '0x451e0E30Dce712c4ec919494F1D779759ADd8Ba4', symbol: 'DentaZK', decimals: 9 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xf3519985B885AFD79cd94ABf98BE522180E56763',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x960C020D846EF2F1b749a3703a0ff96CbCc1e2e6', symbol: 'PROD', decimals: 18 },
    ],
  },
  {
    pair: '0xa842F0a174db4CB1669d65C98a5C1f54914D9Cdb',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0x5C2733D62c9efD7B26eeBc569408d1b839C56132', symbol: 'ZONKI', decimals: 18 },
    ],
  },
  {
    pair: '0x28084A05c5EBE026D9b13271775D77B88bAb4135',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xE5c0f7DC04E15D16dD2808Af9edc27b135564ff3', symbol: 'zkTest', decimals: 9 },
    ],
  },
  {
    pair: '0x203cc35A44c384a560D6F598dDe33bB0580C0355',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xA4C00e85ceBc898e885F5055171dc424dbA8bF45', symbol: 'PANDA', decimals: 18 },
    ],
  },
  {
    pair: '0xFd4A6050B8650C885041D32Ae39c1BaCb7Fbaed8',
    stable: false,
    tokens: [
      { address: '0x0C611c2CdBB26acce22952D7630ab9Cc02598C0d', symbol: 'SPARK', decimals: 18 },
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
    ],
  },
  {
    pair: '0xbc47DE79F57b450E6C6D61e0B3AdB9237B5F8116',
    stable: false,
    tokens: [
      { address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', symbol: 'WETH', decimals: 18 },
      { address: '0xDea6d5161978d36b5C0FA6a491faA754f4BC809C', symbol: 'IDO', decimals: 18 },
    ],
  },
  {
    pair: '0x267dd8D455de158d29c878F4f3A81517DD05F1C8',
    stable: false,
    tokens: [
      { address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', symbol: 'USDC.e', decimals: 6 },
      { address: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', symbol: 'ZK', decimals: 18 },
    ],
  },
];
