---
title: 'Find Jupiter Lock Vesting Escrows | DeFi Checkup'
description: 'Find funded Jupiter Lock escrows naming your Solana address as recipient. Review vesting schedules, cancellation and token restrictions in the official app.'
targetQuery: 'Jupiter Lock vesting escrows'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Jupiter Lock recipient escrows

Find funded Jupiter Lock vesting escrows that name your Solana address as recipient. A finding
means an unclaimed allocation and matching tokens were read on-chain. Open Jupiter Lock to check
how much you can claim now. DeFi Checkup leaves the token amount and USD value unknown.

> The program, on-chain IDL, official SDK layout and a public funded escrow were checked.
> Interactive claim steps have not been tested in the app.

## What it is

Jupiter Lock holds tokens in vesting escrows. Tokens can remain there after you stop using an
address, including allocations that have not unlocked yet. A funded escrow can also contain an
unsolicited or spam token; its existence does not establish token value.

## Who is eligible

Your address must be the recipient of a supported 296-byte `VestingEscrow` in program
`LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn`. The check validates its discriminator and recipient,
then reads token accounts owned by the escrow. It reports a position only when the recorded
allocation exceeds claims and an account holds a positive balance of the matching mint.

The layout is verified against the program's on-chain Anchor IDL and Jupiter's
[official generated account decoder](https://github.com/jup-ag/jup-lock-starter/blob/e3b207471a4846bdca351d6709a135d06a14fde2/src/lib/accounts/vestingEscrow.ts).
The token programs are `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` and
`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`.

This check identifies positions, including locked and cancelled escrows with tokens still held.
It does not calculate present entitlement, token transfer fees, transfer-hook requirements or
refundable rent. A cancelled escrow needs particular care: its historical allocation alone does
not establish a remaining claim. Frozen accounts and Token-2022 restrictions are called out.

Up to 500 recipient accounts are inspected, with token reads for up to five unclaimed allocations.
Larger lists and failed reads are marked incomplete or as errors. Other account sizes, root
escrows without an individual recipient escrow, and allocations requiring an uncreated escrow
are outside this check. Unknown amounts are excluded from the USD total.

## How to get it out

1. Open [Jupiter Lock](https://lock.jup.ag/), linked from the
   [official Jupiter documentation](https://developers.jup.ag/docs/lock).
2. Find the complete escrow address and mint shown in the report. DeFi Checkup never asks you to
   connect a wallet or sign anything.
3. Review the vesting schedule, already claimed amount, cancellation state, token identity and
   current claim availability. Do not treat the full allocation or escrow balance as withdrawable.
4. If a claim is available, follow the app's current flow. Review every asset, destination,
   instruction and fee in a trusted wallet before signing. Do not follow links supplied by a token.

## What it costs

Unknown here. Solana base and priority fees, account creation, Token-2022 transfer fees or other
requirements can affect the cost. No claim transaction was simulated or sent.

## Deadline

No universal recovery deadline was identified in the reviewed sources. Each escrow has its own
schedule and cancellation rules. An unlock date is not presented as a recovery deadline.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review any incomplete result and
use the official app to confirm claim availability.

## FAQ

### Does a funded escrow mean I can withdraw its whole balance now?

No. Tokens may still be locked, cancellation may change entitlement, and token restrictions can
prevent a transfer. This check reports a position with an unknown amount.

### Does the check find every Jupiter Lock allocation?

No. It finds existing individual recipient escrows in the verified layout, within the stated
limits. Allocations that still require creating an escrow from a root distribution are excluded.

### Why is a cancelled escrow still listed?

A cancelled escrow can retain a historical unclaimed allocation and matching tokens. That
observation needs review in the official app; it does not establish a remaining recipient claim.

## Verified on

2026-11-02. Official docs and app shell, executable mainnet program, decompressed on-chain Anchor
IDL, official SDK and generated layout, plus a third-party recipient escrow and matching funded
token account. Recorded evidence includes the discovery filters, public RPC, date and slots.
Browser interaction and claims remain untested.
