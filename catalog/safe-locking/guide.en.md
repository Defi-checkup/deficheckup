---
title: 'Withdraw Locked SAFE Tokens | DeFi Checkup'
description: 'Check SAFE tokens left in the Ethereum locking contract after Safe{Pass}. Understand unlocking, the one-day cooldown and withdrawal costs before taking action.'
targetQuery: 'withdraw locked SAFE tokens'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# SAFE token locking

> Steps in "How to get it out" are written from how the locking contract works on-chain. They have not
> yet been walked through in the live app.

## What it is

In 2024 Safe let SAFE holders lock their tokens to earn points in Safe{Pass}, its rewards program.
The program has since been discontinued, but the locked tokens did not move by themselves. Some
holders never unlocked them; others asked to unlock and never came back for the final withdrawal.

Most wallets show only the SAFE in your wallet, so locked SAFE is easy to forget.

## Who is eligible

Any wallet that locked SAFE in the locking contract on Ethereum
(`0x0a7CB434f96f65972D46A5c1A64a9654dC9959b2`). The check reads two amounts:

- **Unlocked but never withdrawn:** you already asked to unlock it, so it only needs one withdrawal
  once the one-day cooldown has passed. The report says if part of it is still cooling down.
- **Still locked:** it needs an unlock, a one-day wait, then the withdrawal.

## How to get it out

1. Open the Safe app at https://app.safe.global and connect the wallet that locked the SAFE.
2. If the SAFE is still locked, unlock it and wait one day.
3. Withdraw it. The tokens go back to the same wallet.

If the app no longer shows locking, the contract above can be used directly: `unlock(amount)` and,
a day later, `withdraw(0)`, from the wallet that locked.

## What it costs

We measured 51,929 gas to unlock and 71,101 gas to withdraw one unlock, shown in dollars in the
report at today's gas price. Each extra unlock waiting in the queue adds a little more, which we
estimate. Unlocked SAFE only needs the withdrawal.

## Deadline

No deadline. The SAFE stays in the contract until you withdraw it.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Do I need to unlock before withdrawing?

Still-locked SAFE needs an unlock and the recorded one-day cooldown. Previously unlocked SAFE needs a withdrawal after its cooldown.

### Was my SAFE returned automatically when Safe{Pass} ended?

No. The check looks for balances still held by the locking contract rather than assuming the program ending moved them.

### What does the exit cost?

Recorded operations used 51,929 gas to unlock and 71,101 gas to withdraw one unlock on 2026-11-01. Extra queued unlocks increase the estimate.

## Verified on

2026-11-01
