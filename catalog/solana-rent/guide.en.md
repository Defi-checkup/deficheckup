---
title: 'Reclaim Solana Rent From Empty Accounts | DeFi Checkup'
description: 'Find SOL held in empty Solana token accounts. Check close authority, actual refundable balances and fees before closing accounts through a wallet you trust.'
targetQuery: 'reclaim Solana rent'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries:
  ['close empty Solana token account', 'Solana rent refund', 'Token-2022 close authority']
---

# Reclaim Solana rent from empty token accounts

Reclaiming Solana rent means closing empty token accounts and returning their SOL storage
balance to a destination you control. It does not require selling a token or sending money to a
recovery address. The refundable amount is the SOL actually held in each eligible account.

> Account closure rules were checked against Solana's official documentation and source on
> 2026-11-01. Wallet cleanup screens are general instructions, pending a browser walkthrough.
> The official page was readable through the documentation fetch, while a direct GET returned
> a Vercel 429 checkpoint in this environment.

## What happened to the SOL in empty accounts?

A Solana token balance uses a token account that holds its own SOL storage reserve. Spending or
transferring the last token does not necessarily close that account. The empty account can keep
its SOL until an authorized close operation returns it.

The [official account closure documentation](https://solana.com/docs/tokens/basics/close-account)
explains that closing transfers the account's lamports to the chosen destination and deletes the
account. Receiving the token again later may require recreating the account and funding its
storage reserve again.

## Who can reclaim this rent?

The scanner reads empty accounts owned by the address in both official token programs:

- SPL Token: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`.
- Token-2022: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`.

The raw token balance must be zero. A frozen zero-balance account can still qualify. A separate
close authority must be the scanned address; otherwise the scanner excludes the refund and
explains why. Paying to create an account does not by itself give you the right to close it.

Withheld transfer fees must be harvested before closure. Confidential and unsupported extensions
are excluded and make the result incomplete. Nonempty wrapped SOL accounts are outside this
check, even though the program supports closing them under different rules. The check inspects
up to 500 accounts per program and warns if the list is longer.

Inactive native stake accounts have a different withdrawal process. See the
[Solana stake withdrawal guide](/protocols/solana-stake/) instead of treating them as empty token
accounts.

## How to get it out

1. Review the empty-account count and refundable SOL in the report. Read any exclusions before
   assuming every account owned by the wallet can be closed.
2. Read [Solana's official CloseAccount instructions](https://solana.com/docs/tokens/basics/close-account).
   Open your trusted wallet or an account-cleanup tool you have independently verified. The
   official documentation explains the operation; it is not itself a wallet cleanup service.
3. Inspect the source accounts and destination. Each included token balance must be zero, and
   the signing wallet must have the needed owner or close authority. Do not burn valuable
   tokens simply to make an account empty.
4. Select only the empty accounts you intend to close. Inspect every instruction and the
   returned SOL before signing in that wallet or tool. An unexplained transfer or token
   approval is not part of the basic empty-account closure described here.
5. Copy the refund destination from your own wallet, never transaction history. Compare the
   entire address to avoid address poisoning. Confirm the fee and then check the destination
   after the transaction finishes.

DeFi Checkup never connects a wallet, signs or sends this transaction. The exact cleanup controls
depend on the wallet or tool and have not been verified in a connected browser.

## What it costs and how much SOL comes back

The check sums actual account lamports rather than multiplying by a fixed rent amount. Its
public recorded fixture held 0.00148844 SOL on 2026-11-01. That is an example measurement, not a
standard refund for every account.

The [documented Solana base fee](https://solana.com/docs/core/fees) is 5,000 lamports per signature,
or 0.000005 SOL. The scanner estimates one single-signature transaction per account. Batching
can cost less; priority fees, additional signatures and service charges can cost more. The
refund shown is gross, before those costs.

## Deadline and risks

There is no protocol deadline reported for an eligible empty account. It retains its SOL until
it is closed. Recreating the account later costs a new reserve. Excluded extensions and a
separate close authority can prevent closure even when a wallet displays zero tokens.

## How to check reclaimable Solana rent

[Scan your Solana owner address](/). No wallet connection. No signatures. The scanner reads both
token programs and distinguishes eligible refunds from excluded accounts. An incomplete result
means some accounts or extensions could not be evaluated, not that the remainder are safe to close.

## FAQ

### Is Solana rent a fee I can always claim back?

This check finds SOL still held in eligible empty token accounts. It is not a refund of all past
network transaction fees or every storage payment made by the wallet.

### Can I close an account that still has tokens?

The scanner only includes zero-token accounts. Nonempty token accounts need different handling;
nonempty wrapped SOL is deliberately outside this check.

### How much SOL does each account return?

It returns its actual lamports, not a universal constant. The recorded example held 0.00148844
SOL on 2026-11-01, and other accounts can hold different amounts.

### What does closing an empty token account cost?

The documented base fee is 0.000005 SOL per signature. The check estimates one single-signature
transaction per account; batching, priority fees and tool charges can change the total.

### Can I receive the token again after closing its account?

Yes, but a token account may need to be recreated and funded with a storage reserve. Closing
an empty account does not ban the wallet from receiving that token again.

## Verified on

2026-11-01. Official closure and fee documentation, the
[Token-2022 close processor](https://github.com/solana-program/token-2022/blob/program@v10.0.0/program/src/processor.rs),
catalog parsing rules and public recorded fixtures. Direct documentation access returned 429;
wallet cleanup controls and direct page access remain pending browser review.
