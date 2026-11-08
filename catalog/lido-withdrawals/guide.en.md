---
title: 'Lido Finalized Withdrawal: Claim ETH | DeFi Checkup'
description: 'Find finalized Lido withdrawal NFTs with ETH still unclaimed. Check current ownership, exact claimable ETH, request limits and Ethereum gas before using Lido.'
targetQuery: 'Lido withdrawal claim ETH'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Lido: claim a finalized withdrawal

A finalized Lido withdrawal reserves ETH for the current unstETH NFT owner. ETH does not arrive
until the owner claims it. The check reads the contract's exact claimable ETH, rather than
assuming the originally requested stETH amount will be paid.

> The official claim page, contracts and a public claim simulation were checked on 2026-11-02.
> The connected request list and confirmation screen still need browser review.

## Who is eligible

The check covers WithdrawalQueueERC721 on Ethereum,
`0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1`. It checks the current owner's NFTs, their
finalization and claim status, checkpoint hints and `getClaimableEther` amounts. Transferred
NFTs belong to their current owner, even when a different address requested the withdrawal.

Discovery stops before requesting the owner list if `balanceOf` exceeds **64 NFTs**. It also
has a time budget and rejects inconsistent ownership or list responses as incomplete. For a
larger list, use Lido directly. This is not a historical scan of already burned NFTs.

## How to get it out

1. Open [Lido's official claim page](https://stake.lido.fi/withdrawals/claim).
2. Use the wallet that currently holds the NFT, inside Lido only. Match the request ID in the
   finding with the request list and confirm that it is ready to claim.
3. Review the ETH amount and gas fee. Claiming burns that request's unstETH NFT. You do not need
   to transfer the NFT to a recovery service or request another withdrawal.
4. Confirm the claim in your trusted wallet, then verify receipt of ETH.

The [queue documentation](https://docs.lido.fi/contracts/withdrawal-queue-erc721/) describes
`claimWithdrawal` and batch claims. Requests awaiting finalization are reported separately;
they are not added to the claimable ETH. A nominal stETH amount can differ from the final payout.

## What it costs

The check estimates **150,000 gas per request**, not a measured cost. Claiming several requests
in one transaction may cost less than separate claims. The live wallet estimate is the amount
to review before proceeding. You need ETH for Ethereum fees.

The recorded public claim was an `eth_call` simulation, not a paid transaction. A smart contract
wallet must be able to execute the claim and receive ETH.

## Deadline

No expiry for a finalized request was found in the verified queue source. This does not guarantee
future app availability. Unfinalized requests remain subject to queue processing and protocol risks.

## Check your address

[Scan your address](/) without connecting a wallet or signing. Review the coverage limits and
any incomplete warning before relying on a result.

## FAQ

### Why is my NFT visible but ETH has not arrived?

Finalization and claiming are separate steps. The current NFT owner must claim the reserved ETH.

### Does an incomplete result mean I have no claim?

No. Review the official app if the count limit, time budget, ownership changes or a failed read
prevented a complete check. Never sign anything on another site merely to discover requests.

### Can I claim from the address that originally requested the withdrawal?

Only if that address still owns the unstETH NFT. After a transfer, the current NFT owner holds
the claim right. The scanner verifies current ownership before showing claimable ETH.

## Verified on

2026-11-02. Official claim page and queue documentation,
[deployment](https://docs.lido.fi/deployed-contracts/),
[proxy source](https://sourcify.dev/server/v2/contract/1/0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1?fields=all),
current implementation, pinned reads and public request 140174 claim simulation. Connected
screens remain pending browser review.
