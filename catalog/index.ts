import type { Check } from '@deficheckup/engine';
import { liquitySurplusCheck } from './liquity-surplus/check';
import { lidoWithdrawalsCheck } from './lido-withdrawals/check';
import { ribbonV2Check } from './ribbon-v2/check';
import { immutableWithdrawalsCheck } from './immutable-withdrawals/check';
import { aaveV2RewardsCheck } from './aave-v2-rewards/check';
import { compoundV2Check } from './compound-v2/check';
import { creamCheck } from './cream/check';
import { dsproxyCheck } from './dsproxy/check';
import { givTokenDistroCheck } from './giv-tokendistro/check';
import { hyperliquidCheck } from './hyperliquid/check';
import { instadappDsaCheck } from './instadapp-dsa/check';
import { koiFarmCheck } from './koi-farm/check';
import { koiFeesCheck } from './koi-fees/check';
import { koiAmplifierCheck } from './koi-amplifier/check';
import { koiLpCheck } from './koi-lp/check';
import { kittyLootFarmCheck } from './kitty-loot-farm/check';
import { solanaStakeCheck } from './solana-stake/check';
import { solanaRentCheck } from './solana-rent/check';
import { meteoraDlmmCheck } from './meteora-dlmm/check';
import { kaminoLiquidityCheck } from './kamino-liquidity/check';
import { marginfiCheck } from './marginfi/check';
import { jupiterLockCheck } from './jupiter-lock/check';
import { merklCheck } from './merkl/check';
import { safeLockingCheck } from './safe-locking/check';
import { safeOwnerCheck } from './safe-owner/check';
import { uni2020Check } from './uni-2020/check';
import { zksyncLiteCheck } from './zksync-lite/check';

/**
 * Every check the app runs. `example/` stays in the folder as the template for new checks, but it
 * is not part of this list.
 */
export const checks: readonly Check[] = [
  liquitySurplusCheck,
  lidoWithdrawalsCheck,
  ribbonV2Check,
  immutableWithdrawalsCheck,
  instadappDsaCheck,
  dsproxyCheck,
  givTokenDistroCheck,
  aaveV2RewardsCheck,
  hyperliquidCheck,
  merklCheck,
  safeOwnerCheck,
  compoundV2Check,
  creamCheck,
  koiFeesCheck,
  koiLpCheck,
  koiAmplifierCheck,
  koiFarmCheck,
  safeLockingCheck,
  uni2020Check,
  zksyncLiteCheck,
  kittyLootFarmCheck,
  solanaStakeCheck,
  solanaRentCheck,
  meteoraDlmmCheck,
  kaminoLiquidityCheck,
  marginfiCheck,
  jupiterLockCheck,
];
