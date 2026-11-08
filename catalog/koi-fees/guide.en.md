---
title: 'Claim Koi Pool Fees on zkSync Era | DeFi Checkup'
description: 'Check swap fees left in legacy Koi and Mute pools on zkSync Era, including after removing liquidity. Read claim rules, measured gas costs and coverage limits.'
targetQuery: 'claim Koi pool fees'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Koi (formerly Mute) unclaimed pool fees

> Steps in "How to get it out" are written from how Koi pools work on-chain. They have not
> yet been walked through in the live app.

For the complete exit, including LP, fees, Amplifiers and farms, read the
[Mute.io and Koi withdrawal guide](/protocols/koi-lp/).

## What it is

Koi, first called Mute, was the main native exchange on zkSync Era. Its pools pay swap fees to
liquidity providers, but not automatically: each pool sets the fees aside in a separate contract
and credits every provider's share, to be claimed later. Many people removed their liquidity and
never claimed those fees. They remain credited until claimed under the checked pool rules.

Some portfolio trackers show these fees as a deposit in the pool. Since the wallet holds no
liquidity anymore, the position looks fake. It is not: the fees are real and can be claimed.

Koi's own site says its zkSync product is no longer live (checked on 2026-11-01). The pools are
smart contracts on zkSync Era, which is still running, and the catalog recorded a successful fee-claim simulation.

## Who is eligible

Any wallet that provided liquidity in a Koi pool and did not claim all its fees. The check reads
your credited fees in the 145 pools whose fee contract held at least $10 on 2026-11-01, about
$338,765 in total, out of the 2,504 pools of the factory
(`0x40be1cBa6C5B47cDF9da7f963B6F761F4C60627D`). The largest is the USDC.e/WETH pool
(`0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4`).

If you still provide liquidity, the amount shown can be a little lower than what you get: fees
earned since your last interaction with the pool are added when you claim.

## How to get it out

Before copying a recipient, use your own wallet, never transaction history, and compare the
complete address to avoid address poisoning. Verify the full contract destination separately.

1. Open Koi's app at https://dapp.koi.finance, linked from koi.finance, and connect your wallet.
   If the app no longer offers a claim, the pool contract can be called directly: `claimFees()`
   on the pool's address, shown in full in the report.
2. Claim the fees of the pool. One transaction pays both tokens of the pool.
3. The tokens arrive in your wallet on zkSync Era. Bridge or swap them as usual.

## What it costs

One zkSync Era transaction per pool: we measured 303,144 gas, about three cents on 2026-11-01.

## Deadline

No deadline. The fees stay credited until you claim them.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Can fees remain after removing liquidity?

Yes. Pool fee credits are separate from the LP token balance and can remain after liquidity is removed.

### Are the fees a fake LP position?

A zero LP balance does not make the credited fees fake. The check reads fee credits separately and checks the covered pool list.

### What does a fee claim cost?

The recorded claim used 303,144 zkSync Era gas on 2026-11-01. The report estimates the current USD cost from current gas prices.

## Verified on

2026-11-01
