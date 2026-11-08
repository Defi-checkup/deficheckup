---
title: 'Find marginfi Account Positions | DeFi Checkup'
description: 'Find asset shares still recorded in your marginfi accounts on Solana. Review borrowing and account restrictions through the official Project 0 migration page.'
targetQuery: 'marginfi account positions'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# marginfi accounts (Project 0)

Find accounts with positive asset shares in marginfi's Solana lending program. The official
marginfi app now directs users to Project 0 to manage active positions. This check identifies
recorded assets, but does not calculate token amounts, net equity or a withdrawable balance.

> The program ID, account layout, official migration page and public mainnet accounts were checked.
> Interactive management and withdrawal steps have not been tested in the app.

## What it is

marginfi stores deposits and borrowing in separate accounts owned by its lending program. An
account may retain asset shares after you stop using it. Those shares need bank exchange rates to
be converted into token amounts. Borrowing, account health and liquidity can limit withdrawals.

## Who is eligible

The scanned address must be the authority of a `MarginfiAccount` in program
`MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`. Group membership or a similarly named receipt token
does not establish ownership.

The check uses the 2,312-byte layout and authority at byte 40. It inspects active balance slots
for positive asset shares and distinguishes borrowing shares and accrued borrowing premiums.
The layout comes from the
[official account types](https://github.com/mrgnlabs/marginfi-v2/blob/aeafee702d1b807f717db75f87996a67e1977c04/type-crate/src/types/user_account.rs).
Accounts with only borrowing produce an informational notice, not a finding of recoverable funds.

Up to 500 accounts are inspected. An invalid or truncated response is reported as an error or an
incomplete result. The check does not calculate bank values, liquidation risk, pending external
rewards, cross-protocol positions or refundable account rent. Unknown amounts and values are
excluded from the USD total. Small share balances may be dust.

## How to get it out

1. Read the [official marginfi migration page](https://app.marginfi.com). It links to the
   Project 0 app at `https://app.0.xyz` for managing active positions.
2. Review the complete account address shown in the report in the official app. DeFi Checkup never
   requests a wallet connection or signature.
3. Check the account's actual token amounts, borrowing, net equity, health and any restrictions.
   A finding with asset shares does not establish that any amount can be withdrawn today.
4. Follow the app's current withdrawal or repayment flow only after reviewing those conditions.
   Check every asset, destination and fee in a trusted wallet before signing.

## What it costs

Unknown here. Withdrawal or repayment may need multiple instructions, protocol fees, priority fees
or additional operations to keep the account healthy. No complete transaction was simulated or sent.

## Deadline

No recovery deadline was identified in the reviewed sources. Program upgrades, account restrictions,
liquidations and market liquidity can affect recovery even without a fixed deadline.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review borrowing notices and any
incomplete results before using the official app.

## FAQ

### Does a finding mean the account has positive net equity?

No. The check proves positive asset shares, while borrowing can offset those assets. It reports
borrowing separately and leaves token amounts, net equity and USD value unknown.

### Where is the official app now?

The official marginfi app displays a migration page that links to Project 0. Start from that
page and review the complete account address before managing a position.

### Does an empty marginfi account mean refundable rent?

This check does not establish closure eligibility or count account rent. It only identifies
positive asset shares and notices borrowing in the supported account layout.

## Verified on

2026-11-02. Official mainnet program ID, executable program, account layout, signed share balances
of a public authority discovered through the official repository's public mainnet group, and the
official app's Project 0 migration page. The fixture records the discovery query, RPC, date and slots.
Browser interaction and withdrawals remain untested.
