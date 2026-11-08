---
title: 'Hyperliquid Withdraw: Find Old Balances | DeFi Checkup'
description: 'Check overlooked Hyperliquid perps, spot, staking and vault balances. Learn which withdrawal route applies, what can delay it and where to check current fees.'
targetQuery: 'hyperliquid withdraw funds'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries:
  ['Hyperliquid Send vs Withdraw', 'HYPE unstaking queue', 'Hyperliquid vault withdrawal']
---

# Hyperliquid: withdraw funds from the right account

Hyperliquid withdrawals depend on where the balance sits: perps, spot, staking or a vault.
An asset can be visible in one account but unavailable for an immediate external withdrawal.
Check the account type before choosing Send, transferring between accounts or starting an exit.

> The official app and current withdrawal documentation were checked on 2026-11-01. Perps,
> spot, staking and vault screens still need a connected browser walkthrough. This guide does
> not verify a withdrawal for a real wallet.

## What happened to an overlooked Hyperliquid balance?

Hyperliquid is not treated as a dead protocol by this check. Its account system separates funds
that a general wallet tracker may not display together. Closing a trade does not withdraw its
remaining USDC; holding HYPE in staking or equity in a vault is also separate from a spot balance.

The scanner's public API check reads these four areas. It does not withdraw, trade, unstake or
query a private account login. Use the address belonging to the account you actually used.

## Who is affected?

The check covers:

- Withdrawable USDC reported for the perps account, rather than the full value of open positions.
- Every returned spot token balance. An unpriced token is shown without a USD estimate.
- HYPE delegated, undelegated in staking or pending transfer back to spot.
- Reported equity in each deposited vault, with its full vault address where available.

Known values below one US cent are excluded. Spot prices need a sufficiently traded USDC market:
the catalog uses a $1,000 daily volume threshold, verified on 2026-11-01. A quoted value is not a
promise of sale proceeds. The check does not cover general HyperEVM wallet holdings or every
subaccount. Staking and vault findings are gross balances, not necessarily available cash now.

## How to get it out

1. Open [the official Hyperliquid app](https://app.hyperliquid.xyz) and select the account that
   holds the finding. Use your trusted wallet inside that app. DeFi Checkup never requests a
   connection or signature.
2. **Perps USDC:** inspect the amount currently withdrawable without changing open positions.
   The [official onboarding guide](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading)
   directs users to Withdraw on the trade page. Review the available chain and method in the
   current modal; do not rely on an old tutorial's single destination option.
3. **Spot:** inspect the specific asset and its withdrawal support. A transfer between spot and
   perps is different from leaving Hyperliquid. Follow the external withdrawal flow for the asset
   and destination network you intend to use.
4. **Staking:** undelegate HYPE if necessary, then request the transfer from staking to spot.
   The [official staking documentation](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/staking)
   specifies a one-day delegation lockup and a seven-day queue for staking-to-spot transfers.
   HYPE already pending in that queue cannot be withdrawn a second time.
5. **Vaults:** open the vault matching the full address in the report and inspect its withdrawal
   conditions. Vault equity is not a fixed payout; lockups and the vault's current position can
   affect an exit. Withdraw to your account before arranging an external withdrawal.
6. Before an external transfer, verify the asset, network and full recipient in your wallet.
   Copy addresses from your own wallet, never transaction history, and compare every character
   to avoid address poisoning.

The [official withdrawal troubleshooting page](https://hyperliquid.gitbook.io/hyperliquid-docs/support/faq/withdrawal-issues/withdrawal-has-not-arrived-in-my-wallet)
explains that Send moves assets to another Hyperliquid account. It is not an external withdrawal.
If an action says Send Spot or Send USDC, verify that this is really the operation you intend.

## What it costs

The catalog does not assign a fixed USD claim cost to these balances. Internal account movements
have no ordinary Ethereum gas transaction, but external withdrawals have route-specific fees.
The current official onboarding guide says gas may apply depending on chain and method.

Older instructions mentioning only a $1 Arbitrum withdrawal do not describe every current route.
Review the live quote, any swap and any later network transaction before deciding whether to exit.

## Deadline and risks

No general withdrawal deadline is reported. Staking queues, delegation locks, vault conditions,
open-position margin and external network availability can delay access. A partial API response
is marked incomplete. A successful read of account equity does not prove immediate liquidity.

## How to check overlooked Hyperliquid funds

[Scan your account address](/) to read perps, spot, staking and vault balances together. No wallet
connection. No signatures. Use the account-type label in each finding to choose the route above.

## FAQ

### Why does Hyperliquid show funds I cannot withdraw yet?

Some balances secure open positions, remain delegated, wait in a staking queue or belong to a
vault. Their account value is different from the amount currently available for an external exit.

### Is Send the same as Withdraw?

No. Hyperliquid's official troubleshooting docs distinguish a transfer to another Hyperliquid
account from an external withdrawal. Review the action and network before confirming.

### How long does unstaking HYPE take?

The checked staking docs specify a one-day delegation lockup and a seven-day queue to transfer
from staking to spot. Check the current account status before starting another action.

### What is the withdrawal fee?

It depends on the asset, destination chain and method offered in the current app. The scanner
leaves this cost unknown rather than applying a historical single-route fee to every balance.

### Does the scan include my HyperEVM wallet?

This check reads the covered HyperCore perps, spot, staking and vault API balances. It is not a
general HyperEVM token or DeFi position scan.

## Verified on

2026-11-01. Official app HTML and entry JavaScript, current onboarding, staking and withdrawal
troubleshooting docs; catalog API parser and fixtures. Connected withdrawal routes and vault
screens remain pending browser review.
