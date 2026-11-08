// Official app farm configuration, checked against farms(0..11) on 2026-11-01.
// Each token's symbol(), decimals() (18) and balanceOf(KITTY_LOOT_FARM) read on-chain.
export const FARMS = [
  {
    token: '0x75186A42dB5a6c63095ADB5Cf5F1EA30Cc57FDA2',
    name: 'FROTH/WFLOW LP',
    symbol: 'PS-V2',
  },
  {
    token: '0xff08315328040dA4Ca1bE88E1165E88abeA1C431',
    name: '3kitty LP',
    symbol: 'FLOWETHUSDF',
  },
  {
    token: '0x141e8176d77F7E53212d0698942d1C0B46086A17',
    name: 'PYUSD0/WFLOW vault',
    symbol: 'IV-KITTY-PYUSD0-WFLOW-3000',
  },
  {
    token: '0x4AceFD7134Ec058010e357212ef117e1bCe035e3',
    name: 'WETH/PYUSD0 vault',
    symbol: 'IV-KITTY-WETH-PYUSD0-3000',
  },
  {
    token: '0x105e57aF0e57162aB7cF94557FBE53aa6dcd1AF4',
    name: 'PYUSD0/WETH vault',
    symbol: 'IV-KITTY-PYUSD0-WETH-3000',
  },
  {
    token: '0x768Ca5F3ea60a073ccb5Fb6e65B0cc798025489A',
    name: 'WBTC/PYUSD0 vault',
    symbol: 'IV-KITTY-WBTC-PYUSD0-3000',
  },
  {
    token: '0x967a7Dd8fEF383197eE1129b8343cAe098110873',
    name: 'PYUSD0/WBTC vault',
    symbol: 'IV-KITTY-PYUSD0-WBTC-3000',
  },
  {
    token: '0x2E00f868903eF28CA7a8954BBd15002045d9172c',
    name: 'FROTH/PYUSD0 vault',
    symbol: 'IV-KITTY-FROTH-PYUSD0-10000',
  },
  {
    token: '0x9062c6Fe6DbCD6A0FCd048Deb2340320A440bfE6',
    name: 'PYUSD0/FROTH vault',
    symbol: 'IV-KITTY-PYUSD0-FROTH-10000',
  },
  {
    token: '0xF9C600FC3A25b8d164Fb8aA8a39074D419417D03',
    name: 'stgUSDC/PYUSD0 vault',
    symbol: 'IV-KITTY-stgUSDC-PYUSD0-100',
  },
  {
    token: '0x5D80D80Ea919B015fcdE001A77020A7cB835112a',
    name: 'PYUSD0/stgUSDC vault',
    symbol: 'IV-KITTY-PYUSD0-stgUSDC-100',
  },
  {
    token: '0x6B289141a3C75376C6C18B729BE8604A930ACf7b',
    name: 'WFLOW/PYUSD0 vault',
    symbol: 'IV-KITTY-WFLOW-PYUSD0-3000',
  },
] as const;
