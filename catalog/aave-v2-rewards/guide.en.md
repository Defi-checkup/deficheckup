---
title: 'Aave V2 Rewards: Claim stkAAVE | DeFi Checkup'
description: 'Check unclaimed Aave V2 rewards on Ethereum, find the official claim route and understand stkAAVE, cooldowns and gas before deciding if a claim is worth it.'
targetQuery: 'aave v2 rewards claim'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries: ['unclaimed stkAAVE', 'Aave V2 incentives', 'stkAAVE cooldown']
---

# Aave V2 rewards: claim old stkAAVE incentives

Aave V2 rewards may remain unclaimed even after you closed your lending position. The Ethereum
incentives controller records these rewards separately from deposits and debt. A successful claim
pays stkAAVE, not liquid AAVE, so understand the next steps before spending gas.

> The controller and gas estimate were verified on 2026-11-01. The current Aave app bundle has
> V2 market configuration and reward-claim code. Selecting the legacy market, viewing the reward
> and completing the claim screen still need a browser walkthrough.

## What happened to Aave V2 liquidity rewards?

The catalog verification records the Ethereum V2 liquidity incentive program running from 2021
to May 22, 2022. Those emissions ended. A remaining entitlement can still be read from the
incentives controller, but it does not keep increasing from that ended program.

The payout is stkAAVE, the staked AAVE token associated with Aave's Safety Module. Do not confuse
an old V2 liquidity incentive with a new lending deposit, another network's rewards or rewards
from staking stkAAVE itself.

## Who is affected?

A wallet that supplied or borrowed in an incentivized Ethereum V2 market may have a balance.
The scanner calls `getRewardsBalance` on
`0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5` across the catalog's 32 fixed incentivized assets.
These include the relevant supply and debt tokens, not 32 unrelated networks.

The payout token is `0x4da27a545c0c5B758a6BA100e3a049001de870f5`. This check covers the wallet's
incentives entitlement. It does not redeem aToken deposits or close borrowing positions. If you
used a smart account, also read about [Instadapp DSAs](/protocols/instadapp-dsa/) and
[DSProxies](/protocols/dsproxy/) to distinguish assets held by an account from a wallet reward.

## How to get it out

1. Open [the official Aave app](https://app.aave.com). Connect the wallet that earned the
   incentives inside that app only. DeFi Checkup never requests this connection.
2. Select the Ethereum V2 market and inspect its rewards on the dashboard. The current bundle
   includes the legacy `proto_mainnet` configuration and a "Claim all rewards" action. The
   visibility of that action for a real eligible account is still pending browser verification.
3. Review the token and amount before confirming a claim. The incentives claim pays stkAAVE.
   The app may gather claims differently from the catalog's single controller estimate.
4. To receive liquid AAVE afterward, inspect the Safety Module's current unstaking route. Start
   the cooldown if required, return during the withdrawal window and review the unstake. Follow
   the current app rather than a historical screenshot of the cooldown length.
5. Before copying any destination, copy from your own wallet, never transaction history. Compare
   the complete address to avoid address poisoning, and review each transaction in your wallet.

[Aave's official FAQ](https://www.aave.com/faq) documents cooldown-based unstaking. The V2 reward
claim and any later unstaking are separate operations. Receiving stkAAVE does not complete both.

## What it costs

On 2026-11-01 the catalog measured 169,755 gas for
`claimRewards([], max, user)` with already accrued rewards. It uses 170,000 gas as its claim
estimate. An app claim that includes open-market updates may cost more.

Cooldown and unstaking need separate Ethereum operations and are not included in that claim
estimate. The report converts the estimate using current gas prices. Compare the expected value
with the total route's fees, especially for small rewards.

## Deadline and risks

No claim expiry was found in the catalog verification. The May 22, 2022 date is the end of the
recorded distribution, not a last day to claim. stkAAVE has staking conditions and risks; review
the current Safety Module terms before deciding whether to hold it or unstake.

## How to check unclaimed Aave V2 rewards

[Scan the address that used Ethereum V2](/). The check reads the controller without requesting a
wallet connection or signature. An absent reward is not proof that you have no Aave deposits:
those positions are outside this rewards check.

## FAQ

### Can I claim Aave V2 rewards after closing my position?

A previously accrued incentive can remain in the controller after a position is closed. The
scanner reads the remaining entitlement across its fixed list of incentivized assets.

### Do I receive AAVE or stkAAVE?

The covered Ethereum V2 incentives pay stkAAVE. Turning that into liquid AAVE involves the
Safety Module's separate unstaking process.

### Why can I not find the reward in the current app?

Confirm you selected Ethereum V2 and the earning wallet. The app bundle still includes V2 and
claim code, but this guide has not confirmed the connected screen for every account.

### What does claiming cost?

The catalog estimates 170,000 Ethereum gas from a 169,755 gas measurement on 2026-11-01. Market
updates can cost more; cooldown and unstaking are separate costs.

### Did the rewards expire in May 2022?

That date marks the end of the recorded emissions, not an expiry found by the check. The
controller can still report an unclaimed entitlement from that program.

## Verified on

2026-11-01. Official app HTML, dashboard and app JavaScript, official Aave FAQ, catalog controller
and asset list, recorded gas simulation. Connected claim and current Safety Module screens remain
pending browser review.
