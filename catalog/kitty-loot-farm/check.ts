import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type Finding,
} from '@deficheckup/engine';
import { FARMS } from './farms';

// From app.kittypunch.xyz/farms, chunk 9086-8dcc47f777731e1c.js. Read on Flow EVM on
// 2026-11-01: getFarmsLength() = 12; farms(0..11) and userInfo(public staker, 0..11).
// Verified source: evm.flowscan.io/api/v2/smart-contracts/0x653659DC5177720fCd92248559C5763Ac2fBFa9E.
export const KITTY_LOOT_FARM = '0x653659DC5177720fCd92248559C5763Ac2fBFa9E';

// Real unstake receipts on 2026-11-01: 81,311 and 85,441 gas. Simulation of the public
// farm 1 staker's amount minus 1 wei estimated 107,909 gas. Use that higher measured estimate.
export const UNSTAKE_GAS = 107_909n;

export const farmAbi = [
  {
    type: 'function',
    name: 'getFarmsLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'farms',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bool' },
      { type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'userInfo',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }],
  },
] as const;
const tokenAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const kittyLootFarmCheck: Check = {
  id: 'kitty-loot-farm',
  name: 'KittyPunch Loot Farm stakes',
  networks: ['flow-evm'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.kittypunch.xyz/farms',
  deadline: null,
  contracts: evmContracts('flow-evm', KITTY_LOOT_FARM, ...FARMS.map((farm) => farm.token)),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) return { kind: 'error', reason: 'Not a valid EVM address.' };
    let incomplete = false;
    const notices: string[] = [];
    const count = ctx
      .readContract({
        network: 'flow-evm',
        to: KITTY_LOOT_FARM,
        abi: farmAbi,
        functionName: 'getFarmsLength',
      })
      .then(
        (value) => {
          if (typeof value !== 'bigint' || value !== BigInt(FARMS.length)) incomplete = true;
        },
        () => {
          incomplete = true;
        },
      );
    const perFarm = await Promise.all(
      FARMS.map(async (farm, id): Promise<Finding | null> => {
        try {
          const read = (functionName: 'farms' | 'userInfo') =>
            ctx.readContract({
              network: 'flow-evm',
              to: KITTY_LOOT_FARM,
              abi: farmAbi,
              functionName,
              args: functionName === 'farms' ? [BigInt(id)] : [address, BigInt(id)],
            });
          const [data, user] = await Promise.all([read('farms'), read('userInfo')]);
          if (
            !Array.isArray(data) ||
            data.length !== 7 ||
            typeof data[0] !== 'string' ||
            data[0].toLowerCase() !== farm.token.toLowerCase() ||
            !data.slice(1, 5).every((v: unknown) => typeof v === 'bigint' && v >= 0n) ||
            typeof data[5] !== 'boolean' ||
            typeof data[6] !== 'bigint' ||
            data[6] < 0n ||
            !Array.isArray(user) ||
            user.length !== 2 ||
            !user.every((v: unknown) => typeof v === 'bigint' && v >= 0n)
          ) {
            throw new Error('Unexpected farm data.');
          }
          const staked = user[0] as bigint;
          if (staked === 0n) return null;
          const minimum = data[6] as bigint;
          const raw = staked > minimum ? staked - minimum : 0n;
          const retained = staked < minimum ? staked : minimum;
          if (minimum > 0n)
            notices.push(
              `Farm ${id} (${farm.name}): ${retained} base ${retained === 1n ? 'unit' : 'units'} cannot currently be withdrawn because of minStakeAmount. The owner can change this minimum.`,
            );
          if (raw === 0n) return null;
          const reserve = await ctx.readContract({
            network: 'flow-evm',
            to: farm.token,
            abi: tokenAbi,
            functionName: 'balanceOf',
            args: [KITTY_LOOT_FARM],
          });
          if (typeof reserve !== 'bigint' || reserve < raw)
            throw new Error('Insufficient farm reserves.');
          const [price, claimCostUsd] = await Promise.all([
            lookupPrice(ctx, 'flow-evm', farm.token),
            ctx.gasCostUsd('flow-evm', UNSTAKE_GAS),
          ]);
          const amount = { raw, decimals: 18, symbol: farm.symbol };
          return {
            title: `${farm.name} staked in KittyLootFarm`,
            network: 'flow-evm',
            amount,
            ...valueAtPrice(amount, price),
            claimCostUsd,
            deadline: null,
            heldBy: KITTY_LOOT_FARM,
            note: 'Withdraws the LP or vault receipt token. Removing its underlying assets is a separate step with an additional fee. Points are not a cash reward.',
          };
        } catch {
          incomplete = true;
          return null;
        }
      }),
    );
    await count;
    const [first, ...rest] = perFarm.filter((f): f is Finding => f !== null);
    const missing =
      'Some KittyLootFarm positions or reserves could not be read, or the farm list changed.';
    if (first)
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(notices.length ? { notices } : {}),
        ...(incomplete ? { partial: missing } : {}),
      };
    if (incomplete) return { kind: 'error', reason: missing };
    if (notices.length) return { kind: 'lost', reason: notices.join(' ') };
    return { kind: 'nothing' };
  },
};
