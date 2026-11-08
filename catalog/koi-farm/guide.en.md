---
title: 'Withdraw Koi Farm Stakes and Rewards | DeFi Checkup'
description: 'Check legacy Koi farm stakes and unpaid rewards on zkSync Era. Review vesting penalties, shared reward balances and the steps to turn unstaked LP into tokens.'
targetQuery: 'withdraw Koi farm'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Koi farm, LP and rewards still staked

> Steps in "How to get it out" are written from how the farm contracts behave on-chain. They have not
> yet been walked through in the live app.

For the complete exit, including LP, fees, Amplifiers and farms, read the
[Mute.io and Koi withdrawal guide](/protocols/koi-lp/).

## What it is

Koi, first called Mute, ran farms on zkSync Era: you staked the LP token of a pool and earned a
reward (KOI, MUTE, ZK, or the token of a partner project) that vested over 30 days. Koi's home page
now points to Robinhood Chain, but the farms are still on zkSync Era. On 2026-11-01, 16 of them
still held about $152,000 of LP, and their rewards were still being paid out.

The stake and unpaid reward are separate. Withdrawing early can forfeit unvested rewards,
and payout also depends on the reward payer holding enough tokens.

## Who is eligible

Any wallet with a stake in one of the 16 farms. The source of these contracts is not published, so
the check reads them by their raw function code (`0x64c73e00`), checked against real claims. It
adds up your stakes in each farm and shows your share of both tokens of the pool at today's
reserves, plus the reward not paid yet.

## How to get it out

Before copying a recipient, use your own wallet, never transaction history, and compare the
complete address to avoid address poisoning. Verify the full contract destination separately.

1. Check the date first. Rewards vest over the month after each deposit, and withdrawing before
   that forfeits the part not vested yet ([Koi's docs](https://docs.koi.finance/mute-switch/amplifier)).
   The report gives the date when a reward is still vesting; most stakes vested long ago.
2. Open Koi's app at https://dapp.koi.finance, connect your wallet on zkSync Era and look for your
   farm position. Withdrawing pays everything in one transaction: your LP token, the vested reward
   and the pool fees earned while staked.
3. If the app no longer lists the farm, a wallet that lets you send custom data can call it
   directly: send a transaction to the farm shown in the report, with no ETH and the data
   `0x3ccfd60b` (the code of `withdraw()`). Block explorers show no write button, because the
   source is not published.
4. You now hold the pool's LP token. Remove the liquidity to get both tokens back (see the Koi
   liquidity check for the steps).

Each reward is paid from a separate contract. The check reads that contract's balance: when it
holds less than your reward, the report says the reward cannot be paid today instead of counting
it as yours. Other stakers claim from the same contract, so even a covered reward is not reserved
for you.

## What it costs

Three zkSync Era transactions: the withdrawal (up to 847,906 gas in real claims, most under
530,000), then the approval and the removal of the liquidity (up to 462,088 gas together). About
13 cents in total on 2026-11-01.

## Deadline

No deadline. People were still withdrawing from these farms in October 2026.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Can an early withdrawal lose rewards?

Yes. Koi documents forfeiture of unmatured rewards on early withdrawal. Check the vesting date before acting.

### Is the unpaid reward reserved for me?

No. A separate reward payer serves other claims too, so its current balance is not a reserved allocation.

### What does withdrawing a farm cost?

Recorded farm withdrawals used up to 847,906 gas in the 2026-11-01 verification. LP approval and removal are separate steps budgeted at up to 462,088 gas together.

## Verified on

2026-11-01
