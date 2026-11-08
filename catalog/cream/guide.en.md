---
title: 'Withdraw From Cream Finance: Limits | DeFi Checkup'
description: 'Cream Finance withdrawals on Ethereum are blocked. Check old crToken balances, understand why they are marked lost, and avoid paying gas for failed withdrawals.'
targetQuery: 'withdraw from Cream Finance'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries:
  ['Cream Finance withdrawal paused', 'crToken balance lost', 'Cream Ethereum redemption']
---

# Withdraw from Cream Finance: why Ethereum funds are blocked

Withdrawing from Cream Finance's old Ethereum lending markets is blocked. A crToken balance in
a portfolio app does not mean the underlying asset can be recovered today. The catalog marks
these positions as lost so you can identify them without paying gas for a failed redemption.

## What happened to Cream's Ethereum markets?

Cream was built from Compound's lending design. Following the October 2021 exploit, its Ethereum
Comptroller was changed on November 1, 2021 to reject redemptions. The project's contract
verification records the withdrawal rejection as `redeemer is paused`, starting at block 13532288.

On 2026-11-01, the catalog's verification read the contract source and simulated withdrawals in
both a market with cash and a market without it. Both were rejected. Insufficient cash is not
the only problem: the controller blocks the withdrawal itself.

The [official Cream app](https://app.cream.finance) still serves an interface. Its JavaScript
includes withdrawal controls, but that does not override the old Ethereum controller's rules.
A visible button is not proof that your particular crToken can be redeemed.

## Who is affected?

This check covers crToken balances across the 92 cataloged markets of Ethereum Comptroller
`0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258`. The
[verified proxy source](https://sourcify.dev/server/v2/contract/1/0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258?fields=all)
identifies the Unitroller; its implementation determines redemption permissions. The rejection
was recorded in the catalog verification, rather than inferred from the website's appearance.

A crToken is a receipt for a supplied asset. The scanner reads the receipt balance and, where
readable, its stored exchange rate to describe the position. This is not a sale price or a
recoverable USD balance. A broken exchange-rate read is not silently valued at zero.

Cream markets on BNB Chain, Polygon and Arbitrum are outside this check. Do not generalize this
Ethereum result to every product with the Cream name. For a separate old Compound position, see
[Compound V2 withdrawal conditions](/protocols/compound-v2/).

## How to get it out

There is no verified withdrawal route for these Ethereum deposits today. The useful steps are
to identify the receipt and confirm the restriction, not to send another redemption transaction.

1. Compare the crToken's full contract address and network with your wallet's receipt holdings.
   Use your wallet and the token's explorer page as sources, never an address copied from
   transaction history. Compare the entire address to avoid address poisoning.
2. Read the scanner's lost-position explanation. A nominal underlying amount describes the old
   deposit; it is excluded from recoverable findings.
3. If you inspect [Cream's official app](https://app.cream.finance), keep the market and network
   distinction clear. Do not submit a withdrawal merely because the interface offers a button.
4. If a future official notice says redemptions reopened, verify the applicable controller and
   simulate the specific withdrawal before paying gas. This guide does not establish any future
   compensation, redemption or recovery entitlement.

A stranger cannot unlock the paused controller by asking for your seed phrase, an approval or an
upfront recovery payment. This guide has no recovery service to recommend.

## What it costs

Checking the address on DeFi Checkup is free. There is no recommended paid withdrawal action for
these markets. A reverted Ethereum transaction can still consume gas, which is why the report
provides the blocked result before you visit the app.

## Deadline and risks

The relevant restriction is a withdrawal block recorded since 2021-11-01, not a missed claim
window. No recovery date was verified. Keeping the receipt, transferring it or seeing a quoted
portfolio value does not establish that Cream can return the underlying asset.

## How to check your Cream balance

[Scan the address that holds the crTokens](/). No wallet connection. No signatures. Cream
positions appear separately as lost; they do not inflate the amount found. An unreadable result
needs investigation and should not be interpreted as proof that there were no deposits.

## FAQ

### Can I withdraw from Cream Finance on Ethereum now?

The catalog's verified controller state blocks redemptions from the covered Ethereum markets.
No working withdrawal route for those deposits was confirmed on 2026-11-01.

### Why does my wallet still show crETH or crUSDC?

The receipt token can remain in your wallet after redemption is blocked. Its presence records a
position, but does not make the underlying asset withdrawable.

### Will a market with cash let me redeem?

Not under the verified withdrawal restriction. The recorded simulations rejected a redemption
even in a market that held cash.

### Should I pay a recovery service or try a higher gas fee?

No verified service can bypass the controller restriction. Paying a higher fee does not change
the redemption rule, and a reverted transaction can still cost gas.

### Does this apply to Cream on every chain?

This guide and check cover the 92 cataloged Ethereum markets only. They do not verify withdrawal
conditions on other networks.

## Verified on

2026-11-01. Official app HTML and withdrawal code; Sourcify Unitroller source; catalog market list,
recorded controller verification and redemption simulations. No recovery transaction was sent.
