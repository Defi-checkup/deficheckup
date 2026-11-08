---
title: 'Find Meteora DLMM Positions and Rent | DeFi Checkup'
description: 'Find liquidity and pending fees in Meteora DLMM positions, including positions outside their range, plus SOL rent held in empty position accounts today.'
targetQuery: 'Meteora DLMM positions'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Meteora DLMM positions

Find empty Meteora DLMM position accounts that hold refundable SOL rent, and non-empty positions
that need a closer look in Meteora. Liquidity outside its range is still a position, not an empty
account. Token amounts and withdrawal availability for non-empty positions are not calculated here.

> Account layouts, the official SDK's empty-position rule and public mainnet accounts were checked.
> We have not walked through the recovery flow in the app. These are general instructions, with
> app steps left for browser review.

## What it is

Meteora DLMM keeps liquidity in separate position accounts. Removing liquidity can leave an account
open with a SOL storage deposit. A position can also retain liquidity, unclaimed fees or rewards
after you stop using a pool. Price leaving the position's bin range does not remove that liquidity.

## Who is eligible

Your address must match the position owner in program
`LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`. An operator address alone is not enough.

The check covers the original 70-bin `PositionV2` layout. It discovers extended positions too, but
marks them incomplete instead of counting their rent or decoding their additional bins. Up to 500
positions are inspected, and current range status is checked for up to 10 pools.

Only positions with zero liquidity shares and zero pending fees and rewards count as empty. Their
actual lamport balances are reported as SOL rent. Non-empty positions are shown without a token
amount or USD value. The official app must calculate those amounts and check locks, pool conditions
and any separate fee owner. They are excluded from the USD total.

The layout and empty test follow the
[official IDL](https://github.com/MeteoraAg/dlmm-sdk/blob/af36dd53ab180783ccecda306926189a4700953c/idls/dlmm.json)
and [position implementation](https://github.com/MeteoraAg/dlmm-sdk/blob/af36dd53ab180783ccecda306926189a4700953c/commons/src/extensions/position.rs).
Read Meteora's [dynamic position explanation](https://docs.meteora.ag/core-products/dlmm/dynamic-positions)
for range, ownership and fee details.

## How to get it out

1. Open [Meteora's official site](https://www.meteora.ag) and review the DLMM positions belonging
   to your wallet. DeFi Checkup never asks for a wallet connection, signature or transaction.
2. Compare the full holding account in the report with the position you are reviewing.
3. For a non-empty position, review liquidity, fees, rewards and any lock or separate fee owner.
   The app must determine what you can withdraw. Do not treat an unpriced finding as a promise
   of a positive net withdrawal.
4. After all liquidity, fees and rewards are removed, use the app's supported position closure
   flow to recover rent. The official SDK provides a close-if-empty instruction with the owner as
   sender and rent receiver. Confirm the destination and fee in your trusted wallet before signing.

## What it costs

Rent findings estimate one signature per closed account at the documented Solana base fee of
5,000 lamports (0.000005 SOL). This is an estimate, not a measured transaction. Priority fees,
additional signatures and any preceding claims or withdrawals cost more. Batching can cost less.
Fees for non-empty positions are unknown here.

## Deadline

No recovery deadline was identified in the reviewed sources. Locks and program rules still apply,
and the program can be upgraded. An absent deadline does not guarantee future recovery.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results before
using the official app.

## FAQ

### Does being outside the range mean my position is empty?

No. Nonzero liquidity shares still represent a position. The check compares the pool's active bin
with the position range, while Meteora must calculate the underlying token amounts.

### Is the rent refund always the same amount?

No. The report uses each empty position's actual lamport balance. It does not multiply the
number of positions by a fixed storage-deposit estimate.

### Are extended positions covered?

They are discovered but marked incomplete. Their additional bins are not decoded, so the check
does not assume an empty fixed prefix means the entire position is empty.

## Verified on

2026-11-02. Official site, current IDL, SDK closure flow and empty-position rule, executable mainnet
program, empty positions and a non-empty position. RPC responses, slots and discovery provenance
are recorded in the check's offline fixture. App interaction and actual closure remain untested.
