---
title: 'Liquity V1 Collateral Surplus: Claim ETH | DeFi Checkup'
description: 'Check ETH collateral surplus left after a Liquity V1 redemption or liquidation. Verify the credited address, claim route and Ethereum gas before claiming.'
targetQuery: 'Liquity claim collateral surplus'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Liquity V1: claim collateral surplus

Liquity V1 can credit ETH to your address after a full redemption or certain liquidations.
That surplus stays in a separate pool until claimed. It is separate from an open Trove.

> Contracts and a public claim simulation were checked on 2026-11-02. Connected frontend steps
> still need browser review. DeFi Checkup never connects a wallet or asks for signatures.

## Who is eligible

The check reads `getCollateral(address)` and `getETH()` on Ethereum CollSurplusPool,
`0x3D32e8b97Ed5881324241Cf03b2DA5E2EBcE5521`. A positive credit with sufficient pool backing
is reported as ETH. An underbacked credit is shown without a recoverable amount or dollar value.
Other Liquity balances, smart wallet ownership and Liquity V2 positions are outside this check.

## How to get it out

1. Start at [Liquity's official V1 frontend list](https://www.liquity.org/frontend). Liquity does
   not operate its own frontend; the listed interfaces are independent operators.
2. Use a V1 interface with the address credited by the surplus pool. Review the surplus claim
   there. The [V1 borrowing FAQ](https://docs.liquity.org/liquity-v1/faq/borrowing) explains the
   collateral surplus after redemption.
3. The contract route is `claimCollateral()` on BorrowerOperations,
   `0x24179CD81c9e782A4096035f7eC97fB8B783e007`. Users cannot call the pool's restricted
   `claimColl` function directly. Do not open a new Trove just to recover this credit.
4. Compare the full contract address and ETH amount before confirming on the external interface.
   If a smart wallet was credited, its authorized owner must use that wallet's execution route.

## What it costs

One Ethereum claim transaction needs ETH for gas. The scanner uses an estimate of **100,000 gas**,
not a measured transaction cost. A public `eth_call` succeeded, but that is a simulation rather
than a mined claim or a guarantee of future execution. Compare the current wallet fee with the
surplus. A tiny credit can cost more to claim than it is worth.

## Deadline

No claim deadline was found in the verified V1 contracts. Pool backing and the claimant's ability
to receive ETH still matter. The check does not recover liquidation losses or repaid debt.

## Check your address

[Scan your address](/) without connecting a wallet or signing. Review the coverage limits and
any incomplete warning before relying on a result.

## FAQ

### Does this include the ETH in an active Trove?

No. This check covers only collateral already credited to CollSurplusPool.

### Can another address claim my surplus?

BorrowerOperations claims for its caller. Knowing an address does not give control of its credit.
Use the address credited by the pool, including a smart wallet if that was the borrower.

### Is this a free claim?

The credit itself is already recorded, but claiming still costs Ethereum gas. The scanner's fee
is an estimate; compare it with the surplus and the current wallet estimate before proceeding.

## Verified on

2026-11-02. [Official deployment](https://github.com/liquity/dev/blob/main/packages/lib-ethers/deployments/default/mainnet.json),
[Sourcify pool source](https://sourcify.dev/server/v2/contract/1/0x3D32e8b97Ed5881324241Cf03b2DA5E2EBcE5521?fields=all),
BorrowerOperations source, pinned on-chain reads and a public claim simulation. Frontend list
content was checked; the connected recovery screen remains pending review.
