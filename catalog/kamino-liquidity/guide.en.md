---
title: 'Find Kamino Liquidity Strategy Shares | DeFi Checkup'
description: 'Find Kamino liquidity strategy shares still held in your Solana token accounts. Review old strategies and check the official app for value and withdrawal rules.'
targetQuery: 'Kamino liquidity strategy shares'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Kamino liquidity strategy shares

This check finds receipt tokens for Kamino liquidity strategies in your wallet's SPL Token
accounts, including strategies that are no longer marked live. It reports the exact share balance,
not the underlying tokens or a promised withdrawal value.

> Strategy layouts, the official SDK and public mainnet accounts were checked. We have not walked
> through the app's withdrawal flow. The instructions below are general and await browser review.

## What it is

Kamino liquidity strategies manage positions in liquidity pools. Their shares are receipt tokens
that can remain in your wallet after you stop following a strategy. A share balance is separate
from the amounts of each underlying token and from any current withdrawal restrictions.

## Who is eligible

Your address must own an SPL Token account with a nonzero balance of a share mint registered by
Kamino's liquidity program, `6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc`.
The SPL Token program is `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`.

The check matches token mint addresses to the current strategy registry. It does not identify a
share by its name or symbol, and it does not filter out old strategies. The share mint at byte 720
and its precision at byte 752 follow the
[official strategy layout](https://github.com/Kamino-Finance/kliquidity-sdk/blob/369ed3ffd62338539a9beb4147d411a21489fd35/src/%40codegen/kliquidity/accounts/whirlpoolStrategy.ts).
The [official SDK](https://github.com/Kamino-Finance/kliquidity-sdk/blob/369ed3ffd62338539a9beb4147d411a21489fd35/src/Kamino.ts)
also reads SPL Token accounts to discover these shares.

This check covers up to 500 token accounts and 6,000 strategies. A limit, unavailable registry or
invalid account produces an explicit failure or incomplete result. Staked shares, farming rewards,
Kamino lending, borrowing and lending vaults are outside its coverage. A frozen token account is
identified in the finding and must not be assumed redeemable.

## How to get it out

1. Open [Kamino's official app](https://app.kamino.finance), linked from its
   [official documentation](https://kamino.com/docs).
2. Compare the complete share mint, strategy and holding account addresses in the report with
   the position you are reviewing. DeFi Checkup never asks you to connect a wallet or sign.
3. Review the strategy's current status, underlying tokens, withdrawal restrictions and fees.
   The reported number is a receipt-token balance; it is not a dollar estimate or a guarantee
   that the strategy can pay a withdrawal today.
4. If the official app supports withdrawal for that strategy, follow its current flow in a trusted
   wallet. Check the assets, amounts, destination and full transaction fee before signing.

## What it costs

Unknown here. Redemption can involve more than one instruction or transaction, strategy fees and
Solana priority fees. The check does not present a base-signature fee as a complete withdrawal cost.

## Deadline

No recovery deadline was identified in the reviewed sources. Program upgrades, strategy status
and withdrawal limits can change. No deadline recorded is not a promise of future recovery.

## How to check

[Scan your address](/) without a wallet connection or signature. These unpriced shares are excluded
from the USD total. Review coverage and incomplete results before taking action.

## FAQ

### Does the share balance tell me how much I can withdraw?

No. It is the exact receipt-token balance. The official app must calculate underlying assets,
check strategy restrictions and quote the actual withdrawal and its fees.

### Does this check include staked shares or Kamino lending?

No. It reads liquidity-strategy shares in your SPL Token accounts. Shares deposited into a farm,
lending deposits and lending vaults need separate checks.

### Are old strategies excluded?

No. The registry match includes strategies regardless of their live status. That helps identify
old shares, but does not establish that a particular strategy currently permits withdrawal.

## Verified on

2026-11-02. Official program ID and strategy layout, executable mainnet program, the complete
5,612-strategy registry, share balances of the public wallet in the SDK's read-positions example,
and the official app link. Slots, RPC requests and source provenance are in the offline fixture.
Interactive withdrawal steps remain untested.
