---
title: 'Ribbon V2 Withdrawals and Unredeemed Shares | DeFi Checkup'
description: 'Check two Ribbon Theta V2 vaults for matured withdrawals, unredeemed shares and paused receipts. Keep pending rounds separate and review gas before withdrawing.'
targetQuery: 'Ribbon complete withdrawal'
intent: 'Informational'
verifiedOn: '2026-11-02'
featured: false
---

# Ribbon Theta V2: finish a withdrawal

A Ribbon standard withdrawal has two steps. Initiating it queues shares; completing it after the
round closes pays the underlying asset. Unredeemed shares and paused positions need different
actions and are not counted as an immediately available ETH or WBTC payout.

> Verified contract reads and public simulations were recorded on 2026-11-02. The connected
> legacy app and explorer forms still need browser review. No transaction was sent.

## Who is eligible

This check covers only these Ethereum vaults from the
[official deployment list](https://docs.ribbon.finance/developers/contract-addresses):

- ETH Call: `0x25751853Eab4D0eB3652B5eB6ecB102A2789644B`.
- WBTC Call: `0x65a833afDc250D9d38f8CD9bC2B1E3132dB13B2F`.

It reads withdrawals, deposit receipts, share balances, the current round and the separate
pauser receipts at `0xE04e8Ae290965AD4F7E40c68041c493d2e89cDC3`. Other Theta vaults,
V1, Earn, Lend, staked shares and other networks are outside this finite list.

A matured withdrawal uses the finalized round's price per share with integer rounding, and checks
available underlying token backing. A queued withdrawal in the current round is described separately
without a claimable value. Unredeemed and paused receipts are shown in share units without a dollar
value. Redeeming a share does not itself withdraw the underlying asset.

## How to get it out

1. Read [Ribbon's official withdrawal guide](https://docs.ribbon.finance/theta-vault/user-guides/how-to-withdraw).
   Match the full vault address and the type of finding before taking action.
2. For a matured withdrawal, the verified route is `completeWithdraw()` on that vault. The
   official guide documents using its explorer page and **Write as Proxy** if needed. Use the
   address that initiated the withdrawal. Check the expected underlying amount and fee first.
3. For unredeemed shares, `maxRedeem()` retrieves shares held by the vault for your account.
   An underlying withdrawal still needs `initiateWithdraw` followed by `completeWithdraw` after
   rollover. Do not treat the share redemption as a cash payout.
4. For a paused position, follow the
   [official pause and resume guide](https://docs.ribbon.finance/theta-vault/user-guides/how-to-pause-and-resume).
   Resuming redeposits assets into the vault; it does not send them directly to your wallet.
   Keeper processing, pauser funding and team action may be needed before a separate withdrawal.
5. If a round has not closed, completing the withdrawal reverts. The old weekly rollover schedule
   is not a promise that a stopped or deprecated vault will process automatically. The official
   guide says those vaults may require team action. Never pay a private recovery agent.

ETH Call pays ETH by unwrapping WETH; WBTC Call pays WBTC. These steps cannot reverse option
losses or guarantee that a vault or pauser can pay every receipt. A credit with insufficient
backing is shown without a confirmed recoverable amount.

## What it costs

Estimates, not measurements: **150,000 gas** for a completed withdrawal and **100,000 gas** for
share redemption alone. Initiating a new withdrawal, resuming a position or other actions cost
extra. Paused receipts and pending rounds have no quoted cash-out fee. You need ETH on Ethereum.
The public completion simulation succeeded for a mature round; another public sample reverted
because its round was still open. Neither was a mined transaction.

## Deadline

The official guide states that completing a standard withdrawal has no deadline. Round closure
is a waiting condition, not an expiry date. Stopped vaults and paused positions can remain blocked.

## Check your address

[Scan your address](/) without connecting a wallet or signing. Review the coverage limits and
any incomplete warning before relying on a result.

## FAQ

### Why does my queued withdrawal not appear as claimable ETH?

The round must close first. Its final price per share can change until then. A pending withdrawal
is described in the report without adding an estimated payout to your recoverable total.

### Can I cancel a queued withdrawal?

The official guide says a queued standard withdrawal cannot be cancelled. Confirm the vault and
share amount before initiating one.

### Does a clean result cover every Ribbon product?

No. This check covers the two listed Ethereum vaults and their verified pauser only. Failed reads
produce an error or an incomplete warning instead of implying that the missing positions are empty.

## Verified on

2026-11-02. Official contract and withdrawal documentation, both vault proxies, their current
[Sourcify implementation](https://sourcify.dev/server/v2/contract/1/0xEaf743E9FE7449Ae3Ce02Bc01712666530D2666e?fields=all),
pauser and asset sources, pinned public receipts and claim simulations. Connected app controls
remain pending browser review.
