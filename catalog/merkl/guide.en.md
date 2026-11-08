---
title: 'Claim Forgotten Merkl Rewards | DeFi Checkup'
description: 'Find unclaimed Merkl rewards across supported networks. Check campaign rules, estimated gas costs and what the scanner can miss before using the official app.'
targetQuery: 'claim Merkl rewards'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Merkl rewards

> Steps in "How to get it out" are written from how Merkl works. They have not
> yet been walked through in the live app.

## What it is

Merkl runs reward campaigns for hundreds of DeFi protocols: you provide liquidity, lend or hold a
token, and rewards accumulate for you on Merkl. They are not sent to your wallet. You have to claim
them, and small amounts on networks you no longer use are easy to forget.

## Who is eligible

Any wallet that took part in a Merkl campaign on one of the 14 networks DeFi Checkup reads for Merkl (every supported network except Blast, which Merkl's API does not serve). The
check asks Merkl's public API for everything the wallet has earned and subtracts what it already
claimed. Rewards still waiting for Merkl's next update are not counted yet. Balances worth less
than one cent are left out.

## How to get it out

1. Open your dashboard on the official Merkl app: https://app.merkl.xyz/users/ followed by your
   address.
2. Connect the wallet that earned the rewards, inside the official app only.
3. Claim on each network where you have rewards and confirm each transaction.

## What it costs

One transaction per network. On Ethereum we measured about 142,000 gas to claim one token; L2s
cost much less. The report shows the cost in dollars at today's gas price.

## Deadline

No deadline in general, but each campaign sets its own rules. Check the campaign in the app.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Does an empty result prove I earned no rewards?

No. Rewards waiting for the next Merkl update are outside the returned amount, and a failed request is reported as an error.

### Does one transaction claim on every network?

No. The guide estimates a claim per network with available rewards. Review each campaign and the current app route.

### What does a claim cost?

The catalog measured 142,392 gas for an Ethereum claim on 2026-11-01. The app route and number of tokens can change the transaction cost.

## Verified on

2026-11-01
