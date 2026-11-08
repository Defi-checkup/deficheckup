---
title: 'Withdraw KittyPunch Loot Farm Stakes | DeFi Checkup'
description: 'Check KittyPunch farm stakes on Flow EVM, check the minimum that blocks a full exit, and compare unstaking costs before redeeming LP or vault receipt tokens.'
targetQuery: 'withdraw KittyPunch farm stake'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# KittyPunch Loot Farm stakes

> The official farms page loads and is linked from KittyPunch's own documentation. The steps
> below follow the contract and the app's published code. We have not yet walked through
> the wallet steps in the live app.

## What it is

KittyLootFarm holds LP and vault receipt tokens on Flow EVM. Stakers collect points for KittyPunch's
loot system. A receipt token left in the farm is still a position, even when a portfolio tracker
does not cover Flow EVM. Points are not valued as withdrawable money.

## Who is eligible

Anyone with a stake in the 12 verified farms of `0x653659DC5177720fCd92248559C5763Ac2fBFa9E`.
The check reads `farms(id)` and `userInfo(address, id)`, and checks that the contract holds enough
of the receipt token to return it. New farms require verification before they are included.

The contract requires the remaining stake to be at least `minStakeAmount`. All 12 farms had a
minimum of 1 wei on 2026-11-01. We simulated a full withdrawal from a public staker: it reverted
with "Remaining must be gt min". Withdrawing the stake minus 1 wei succeeded. Only the
withdrawable portion is counted as found. A minimum left alone is reported as unavailable today,
not as money you can withdraw. The contract owner can change the minimum and sweep tokens.

## How to get it out

1. Open https://app.kittypunch.xyz/farms, linked from
   https://kittypunch.gitbook.io/kittypunch-docs. Use your trusted wallet on Flow EVM.
2. Select the farm holding your position. Withdraw your stake minus the current minimum.
   Withdrawing everything reverts while the minimum is positive.
3. The on-chain operation is `unstake(farmId, amount)` on the contract above. It returns the
   receipt token, not its underlying assets. Removing liquidity or redeeming a vault is another
   operation and costs an additional fee. Review the position in the official app first.

DeFi Checkup only reads public data. It never asks you to connect a wallet or sign.

## What it costs

You pay FLOW for the unstake transaction. Two real withdrawals used 81,311 and 85,441 gas:
`0xf437d749fafc5403d039cec67599a94f62a1892d7c661e98c6218ee0c61f7cdb` and
`0x1990018401a8ad1b378e214553421a12b9e7ce8041f536bf46e1ea1b42e38596`.
A simulation of another withdrawal estimated 107,909 gas; the check uses this higher estimate.
This covers unstaking only. Redeeming LP or vault tokens costs extra.

## Deadline

No withdrawal deadline in the verified contract. Its owner can change farm settings, including
the minimum, and can sweep tokens out of the contract. Read the current result before acting.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Why does a full withdrawal revert?

The checked farm requires a positive minimum remaining stake. The recorded test succeeded when withdrawing all but the 1 wei minimum.

### Does unstaking return the underlying assets?

It returns the staked receipt token. Redeeming a vault or removing liquidity is a separate operation.

### What does unstaking cost?

The check uses a 107,909 gas simulation estimate on Flow EVM. This covers unstaking only, not later receipt-token redemption.

## Verified on

2026-11-01. Contract and token reads on Flow EVM, official app configuration and
[verified contract source](https://evm.flowscan.io/address/0x653659DC5177720fCd92248559C5763Ac2fBFa9E?tab=contract).
