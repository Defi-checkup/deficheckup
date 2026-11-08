---
title: 'Claim Giveth GIVstream Rewards | DeFi Checkup'
description: 'Check GIVstream rewards available on Gnosis Chain. Understand what is liquid now, what is still flowing, claim costs and why the old app needs verification.'
targetQuery: 'claim Giveth GIVstream'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Giveth GIVstream

> On 2026-11-01 the GIVstream page that Giveth's docs link to (giveth.io/givstream) returned "page
> not found". Claiming still works on-chain. We have not yet walked through the
> steps below in Giveth's current app.

## What it is

Giveth launched the GIV token in December 2021 with the GIVdrop: 10% of each allocation was liquid
at once and the rest flows over five years through the GIVstream. Every week more GIV becomes
claimable. People who received the GIVdrop, or earned GIV in the GIVeconomy, often left that GIV
flowing without ever claiming it.

## Who is eligible

Any wallet with a GIVstream on Gnosis Chain. The check asks Giveth's TokenDistro contract
(`0xc0dbDcA66a0636236fAbe1B3C16B1bD4C84bB1E1`) how much GIV the wallet can claim right now.
GIVstreams on Optimism and Polygon zkEVM are not checked yet.

## How to get it out

1. Read Giveth's official explanation: https://docs.giveth.io/givstream
2. Open Giveth's official app from giveth.io and connect the wallet that holds the GIVstream, inside
   the official app only.
3. Claim your liquid GIV on Gnosis Chain and confirm the transaction.

## What it costs

One transaction on Gnosis Chain, about 82,000 gas. Gnosis fees are a fraction of a cent, so it is
almost always worth claiming.

## Deadline

Every GIVstream finishes flowing on December 23, 2026. After that date all the remaining GIV is
claimable, and it stays claimable: there is no last day to claim.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Does the end of GIVstream mean I lose unclaimed GIV?

The recorded contract rules make the remaining allocation claimable when streaming finishes, with no last day to claim.

### Does the check cover every GIVstream network?

No. This check covers the cataloged TokenDistro on Gnosis Chain, not other network deployments.

### What does a claim cost?

The catalog recorded 81,933 gas for a Gnosis claim on 2026-11-01. The report uses current network prices for its USD estimate.

## Verified on

2026-11-01
