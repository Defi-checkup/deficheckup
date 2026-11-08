import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { farmAbi, kittyLootFarmCheck, KITTY_LOOT_FARM, UNSTAKE_GAS } from './check';
import { FARMS } from './farms';

// Public withdrawer found in the Unstake event at Flow EVM block 80438533.
const STAKER = '0x0000000000000000000000025102e3E348871DFB';
// Recorded on 2026-11-01: userInfo(STAKER, 1) = [6944287853306000, 412].
const STAKE = 6_944_287_853_306_000n;
function context({
  amount = 0n,
  minimum = 1n,
  fail = '',
  count = 12n,
  reserve = STAKE,
  price = 1 as number | null,
} = {}) {
  const readContract = vi.fn(async ({ functionName, args }: ReadRequest) => {
    if (functionName === fail) throw new Error('RPC failed');
    if (functionName === 'getFarmsLength') return count;
    const id = Number(args?.[functionName === 'userInfo' ? 1 : 0]);
    if (functionName === 'farms')
      return [
        FARMS[id]!.token,
        45n,
        271_128_081_876_152_351_672n,
        80_438_533n,
        59_408_784_708_468_127_851_969n,
        true,
        minimum,
      ];
    if (functionName === 'userInfo') return [id === 1 ? amount : 0n, 412n];
    if (functionName === 'balanceOf') return reserve;
    throw new Error('Unexpected read');
  });
  const gasCostUsd = vi.fn(async () => 0.001);
  const ctx = { readContract, priceUsd: async () => price, gasCostUsd } as unknown as CheckContext;
  return { ctx, readContract, gasCostUsd };
}

describe('KittyLootFarm', () => {
  it('reads all verified farms with the full address', async () => {
    const { ctx, readContract } = context();
    expect(await kittyLootFarmCheck.check(STAKER, ctx)).toEqual({ kind: 'nothing' });
    expect(readContract).toHaveBeenCalledWith({
      network: 'flow-evm',
      to: KITTY_LOOT_FARM,
      abi: farmAbi,
      functionName: 'userInfo',
      args: [STAKER, 0n],
    });
    expect(readContract).toHaveBeenCalledTimes(25);
  });
  it('reports only the withdrawable receipt tokens and the minimum separately', async () => {
    const { ctx, gasCostUsd } = context({ amount: STAKE });
    expect(await kittyLootFarmCheck.check(STAKER, ctx)).toEqual({
      kind: 'found',
      findings: [
        {
          title: '3kitty LP staked in KittyLootFarm',
          network: 'flow-evm',
          amount: { raw: STAKE - 1n, decimals: 18, symbol: 'FLOWETHUSDF' },
          valueUsd: 0.006944287853305999,
          claimCostUsd: 0.001,
          deadline: null,
          heldBy: KITTY_LOOT_FARM,
          note: 'Withdraws the LP or vault receipt token. Removing its underlying assets is a separate step with an additional fee. Points are not a cash reward.',
        },
      ],
      notices: [
        'Farm 1 (3kitty LP): 1 base unit cannot currently be withdrawn because of minStakeAmount. The owner can change this minimum.',
      ],
    });
    expect(gasCostUsd).toHaveBeenCalledWith('flow-evm', UNSTAKE_GAS);
  });
  it('calls the residual minimum lost today, without claiming it can be withdrawn', async () => {
    expect(await kittyLootFarmCheck.check(STAKER, context({ amount: 1n }).ctx)).toMatchObject({
      kind: 'lost',
      reason: expect.stringContaining('cannot currently be withdrawn'),
    });
  });
  it('uses the current minimum, including a minimum raised above the stake', async () => {
    expect(
      await kittyLootFarmCheck.check(STAKER, context({ amount: 2n, minimum: 3n }).ctx),
    ).toMatchObject({ kind: 'lost' });
    expect(
      await kittyLootFarmCheck.check(STAKER, context({ amount: 2n, minimum: 0n }).ctx),
    ).toMatchObject({ kind: 'found', findings: [{ amount: { raw: 2n } }] });
  });
  it('keeps an unpriced finding', async () => {
    expect(
      await kittyLootFarmCheck.check(STAKER, context({ amount: STAKE, price: null }).ctx),
    ).toMatchObject({ kind: 'found', findings: [{ valueUsd: null }] });
  });
  it('does not call a failed read or missing reserves nothing', async () => {
    for (const fail of ['userInfo', 'farms', 'balanceOf']) {
      expect(
        await kittyLootFarmCheck.check(STAKER, context({ amount: STAKE, fail }).ctx),
      ).toMatchObject({ kind: 'error' });
    }
    expect(
      await kittyLootFarmCheck.check(STAKER, context({ amount: STAKE, reserve: 0n }).ctx),
    ).toMatchObject({ kind: 'error' });
  });
  it('keeps verified findings if the list changes, without walking unverified farms', async () => {
    const { ctx, readContract } = context({ amount: STAKE, count: 1_000n });
    expect(await kittyLootFarmCheck.check(STAKER, ctx)).toMatchObject({
      kind: 'found',
      partial: expect.any(String),
    });
    expect(readContract).toHaveBeenCalledTimes(26);
  });
  it('rejects an invalid address without reads', async () => {
    const { ctx, readContract } = context();
    expect(await kittyLootFarmCheck.check('invalid', ctx)).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
