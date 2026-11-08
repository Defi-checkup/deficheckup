---
title: 'Immutable X Pending L1 Withdrawals | DeFi Checkup'
description: 'Check prepared Immutable X withdrawals awaiting Ethereum finalization. See supported Stark keys and assets, token balances, gas costs and unresolved cases.'
targetQuery: 'Immutable X pending withdrawal finalise'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Immutable X: finalize a pending L1 withdrawal

A withdrawal prepared on Immutable X can remain in the Ethereum bridge until finalized on L1.
This is separate from the automated migration to Immutable zkEVM. This limited check reads the
standard address-derived Stark key for ETH, IMX and USDC, without asking for a connection or signature.

> The official recovery manual, contracts and a public withdrawal simulation were checked on
> 2026-11-02. Explorer forms and connected confirmation screens still need browser review.

## Who is eligible

The Ethereum bridge is `0x5FDCCA53617f4d2b9134B29090C87D01058e27e9`. The
[official finalization manual](https://github.com/immutable/imx-migration-contracts/blob/main/docs/finalise-pending-withdrawals.md)
applies to standard withdrawals initiated on or before 11 February 2026 that remain unfinalized.
That cutoff is not a deadline for claiming.

For standard keys, the Stark key is the numeric value of the Ethereum address. The check confirms
that `getEthKey` resolves to that same address, verifies each listed asset's registration data,
and reads `getWithdrawalBalance`. The current implementation returns actual token units, already
converted from quantum units. Applying quantum a second time would overstate the amount.

Supported assets are native ETH, IMX at `0xf57e7e7c23978c3caec3c3548e3d615c346e79ff` and
USDC at `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`. Legacy Stark keys, other fungible assets,
NFTs and balances that never became pending L1 withdrawals are outside this check.

Every positive result carries a coverage warning. If no supported balance can be confirmed, the
check reports incomplete coverage, not that the whole Immutable X account is empty. A failed asset
lookup or unresolved recipient also remains explicit. There is no historical log scan or proxy route.

## How to get it out

1. Open the [official manual](https://github.com/immutable/imx-migration-contracts/blob/main/docs/finalise-pending-withdrawals.md).
   Use its mainnet bridge explorer link. Compare the full bridge address with the one above.
2. Read `getEthKey` for the Stark key and compare the entire recipient with your intended address.
   Registration can be permanent. Do not proceed if the recipient is unknown to you.
3. Check the token's asset ID in the official mainnet table and your finding. The documented
   function is `withdraw(ownerKey, assetType)` through the bridge proxy. Review the amount,
   asset ID, recipient and Ethereum fee in a trusted wallet on the external interface.
4. The function may be called by anyone, but pays the registered recipient. Finalizing a withdrawal
   does not redirect funds to the caller. You do not need to initiate another withdrawal on L2.

If you used a legacy key, use existing public transaction details or official support to investigate.
DeFi Checkup does not recreate keys or request signatures. The official manual describes a separate,
unaudited local registration tool for some legacy cases. That process is outside this scanner's
coverage, can be expensive, and should never be run through a recovery link sent by a stranger.

## What it costs

The scanner estimates **150,000 gas per standard-key withdrawal**, not a measured cost. You need
ETH on Ethereum for fees. The recorded ETH withdrawal succeeded in `eth_call`; that simulation
is not a mined transaction or a guarantee that every asset can be paid later.

Key registration is not included in that estimate. The official manual says registration can use
about **8 million gas**. Some assets or keys may not be recoverable through this limited route;
no ETH, IMX or USDC balance here proves recovery of an NFT or a different Stark key.

## Deadline

No finalization deadline was found in the official manual or the verified withdrawal route.
The February cutoff and March migration dates are not claim expiry dates.

## Check your address

[Scan your address](/) without connecting a wallet or signing. Review the coverage limits and
any incomplete warning before relying on a result.

## FAQ

### Why is the result always marked incomplete?

The standard key cannot reveal other legacy keys you may have used. The three listed assets also
cannot rule out a pending withdrawal for another token or NFT. The warning makes that limit explicit.

### Do I need to sign a message so the scanner can find my key?

No. This scanner derives only the standard key from the address you provide. It never connects,
signs or recreates a Stark key. An unresolved key remains unresolved.

### Is the February cutoff a deadline to collect my funds?

No. The official manual uses it to identify which prepared withdrawals it covers. It does not
state a finalization expiry date. The scanner records no recovery deadline for this route.

## Verified on

2026-11-02. Official finalization manual, bridge proxy and current
[Sourcify migration implementation](https://sourcify.dev/server/v2/contract/1/0x273b65a7231321D4ee47a4c47408Ef43517455Ec?fields=all),
asset registrations, token sources and decimals, pinned reads and a public withdrawal simulation.
Connected explorer screens remain pending browser review.
