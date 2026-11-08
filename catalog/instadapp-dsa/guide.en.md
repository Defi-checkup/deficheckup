---
title: 'Instadapp DSA Withdraw: Leftover Funds | DeFi Checkup'
description: 'Find tokens left in an Instadapp DeFi Smart Account. Check the DSA number and full address, then follow official withdrawal instructions and compare gas costs.'
targetQuery: 'instadapp DSA withdraw'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries: ['Instadapp leftover funds', 'DeFi Smart Account withdrawal', 'find old DSA']
---

# Instadapp DSA: withdraw leftover funds

An Instadapp DSA withdrawal moves tokens from your DeFi Smart Account back to your wallet. If you
closed an old strategy but left ETH or tokens inside that smart account, checking only your main
wallet's balances can miss them. Match the DSA number and complete address before withdrawing.

> The registry, balances and withdrawal estimate were verified on 2026-11-01. Instadapp's
> official withdrawal instructions and app code were checked. The connected account selector
> and final withdrawal screen still need a browser walkthrough.

## What happened to the funds in my DSA?

An Instadapp DeFi Smart Account is a separate contract account. Tokens held by that contract do
not become your wallet's direct balance simply because you finish using it. A leftover transfer,
unused borrowed asset or reward may remain there until an authorized owner withdraws it.

Instadapp's [account documentation](https://docs.instadapp.io/get-started/setup/) explains that
each DSA has its own Ethereum address and account number. This guide covers assets sitting in
the DSA, rather than every deposit it may have made into another protocol.

## Who is affected?

The scanner follows the owner's linked account list in InstaList,
`0x4c8a1BEb8a87765788946D6B19C6C6355194AbEb`, on Ethereum. For each discovered DSA it reads ETH
and the catalog's 18 listed Ethereum tokens. The report identifies the DSA number and full
holding-contract address.

The check stops after 25 accounts or its time budget. If it cannot finish the list or some
balances fail to load, it marks the result incomplete. A clean result does not rule out another
token, another network or assets deposited into an external protocol.

If you also used Maker or DeFi Saver, read the [DSProxy guide](/protocols/dsproxy/). That is a
different account system. The [Compound V2 guide](/protocols/compound-v2/) explains why debt or
locked collateral is not a loose-token balance.

## How to get it out

1. Open [Instadapp's official app](https://defi.instadapp.io) and use the wallet listed as a DSA
   owner. Connect inside that official app, not on DeFi Checkup.
2. Select the account with the DSA number from your finding. Compare its entire address with
   the report. Do not create a new smart account to retrieve funds from an old one.
3. Follow [Instadapp's standard withdrawal instructions](https://guides.instadapp.io/smart-wallets/defi-smart-account-dsa/withdrawing-to-your-connected-wallet):
   open Withdraw in the side panel, choose the held asset and enter the amount to withdraw.
   The documentation's last paragraph uses deposit wording inconsistently; verify the live
   action says withdrawal and pays the intended recipient before proceeding.
4. Review the token, amount, recipient and Ethereum fee in your trusted wallet. When copying a
   recipient, use your own wallet as the source, never transaction history. Compare the full
   address to avoid address poisoning.
5. After confirmation, verify the asset arrived in the recipient wallet. Repeat only for other
   assets you intend to withdraw. A lending position may require a separate redemption before
   its underlying token can be withdrawn from the DSA.

The app's initial HTML displayed a loading shell on 2026-11-01. Its published JavaScript includes
withdrawal and `BASIC-A` connector code, which supports the documented operation but does not
confirm the connected screen works for your account.

## What it costs

The catalog recorded `eth_estimateGas` simulations on 2026-11-01 for an empty-balance DSA:
148,640 gas for a token withdrawal and 69,819 for ETH. These were simulations, not paid transfers.
The check uses 170,000 gas for a token with a real balance and 70,000 for ETH.

Each estimate covers a withdrawal, not unwinding a leveraged strategy or repaying a loan. The
report converts it to USD at current gas prices. Separate assets and extra protocol operations
may need additional transactions.

## Deadline and risks

There is no withdrawal deadline reported for loose DSA balances. Ownership and the account's
permissions still matter. A balance inside a contract is not evidence that anyone who knows the
address can withdraw it. An unknown token may also be spam or have restrictions; the scanner's
listed token coverage is deliberate.

## How to find an old Instadapp DSA balance

[Scan the owner address](/). The scanner looks up DSAs and reads their supported balances. No
wallet connection. No signatures. Review any incomplete-account warning before assuming the
report found every account.

## FAQ

### Why are my tokens in a DSA instead of my wallet?

The DSA is a separate account used for Instadapp operations. Assets left there remain at its
contract address until an authorized withdrawal moves them.

### Which account should I select in Instadapp?

Use the DSA number and complete holding-contract address in the finding. A new DSA or another
existing account will not contain the same loose balances.

### Can the scanner find every token in every DSA?

It reads ETH and 18 listed Ethereum tokens, with an account and time limit. Other assets,
networks and positions deposited into external protocols are outside that balance check.

### How much does a DSA withdrawal cost?

The scanner uses 170,000 gas for a token and 70,000 for ETH. These estimates build on the
2026-11-01 simulations, and do not cover repayment or strategy unwinding.

### Is a DSA the same as a DSProxy?

No. They are different smart account systems with different registries and app routes. A
DSProxy finding should be reviewed through the DSProxy guide rather than these DSA steps.

## Verified on

2026-11-01. Official app HTML and withdrawal JavaScript, Instadapp account and withdrawal docs,
catalog InstaList traversal, token list and recorded simulations. Account switching and final
wallet screens remain pending browser review.
