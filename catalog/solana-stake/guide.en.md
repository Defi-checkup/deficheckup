---
title: 'Withdraw Inactive Solana Stake | DeFi Checkup'
description: 'Find inactive Solana stake accounts you can withdraw, including their storage reserve. Check withdrawal authority, cooldowns, lockups and estimated base fees.'
targetQuery: 'withdraw inactive Solana stake'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Solana native stake accounts

> The checks and withdrawal rules were verified on-chain and in Solana's official source. Wallet
> steps are general instructions: we have not walked through them in a specific wallet.

Empty token accounts use a different operation. See the
[Solana rent refund guide](/protocols/solana-rent/).

## What it is

Native SOL staking uses separate accounts. An inactive account or a stake that finished cooling
down can hold SOL you have not withdrawn, including its refundable storage deposit (rent reserve).
This check counts the entire balance only when a full withdrawal is available now.

## Who is eligible

The scanned address must be the withdrawal authority of an account owned by Solana's Stake program,
`Stake11111111111111111111111111111111111111`. Being the staking authority alone is not enough.

The check uses `getProgramAccounts` with a 200-byte size filter and a withdrawer filter at byte 44.
The staker is at byte 12. These offsets follow the official bincode layout: a 4-byte state variant,
an 8-byte rent reserve, then two 32-byte authority keys. We verified the layout against
[Solana's stake source](https://github.com/solana-program/stake/blob/511afd3a7794f543be3028b333df0353ed113c64/interface/src/state.rs)
and public mainnet accounts on 2026-11-01.

Solana removed `getStakeActivation`. Following
[the official migration instructions](https://solana.com/docs/rpc/deprecated/getstakeactivation),
we read the Clock and StakeHistory sysvars and calculate warmup and cooldown. We also check both
the lockup timestamp and lockup epoch. A lockup that still applies needs its expiry or the
custodian's signature. Its balance is excluded unless the scanned address is also the custodian;
then the finding explains that the wallet must include custodian authorization.

Active and activating stake is reported as information, outside the recoverable total. Partial
withdrawals of excess lamports or a partially cooled delegation are outside this check. Up to 500
accounts are inspected; a longer or partly unreadable list is explicitly marked incomplete.

## How to get it out

1. Read [Solana's official staking page](https://solana.com/staking) and open a wallet you trust
   that supports native stake accounts. DeFi Checkup never asks you to connect or sign.
2. Find the complete stake account address shown in the report. Check that your wallet controls
   its withdrawal authority. That authority must sign the withdrawal in the wallet.
3. If the stake is active, deactivate it first. Cooldown normally takes one epoch (about two days),
   but can take longer when the cluster's cooldown limit applies. A different staking authority
   may manage delegation; the withdrawal authority can also change the staking authority.
4. Once fully inactive and unlocked, withdraw the entire balance to close the stake account and
   recover its rent reserve too. Check the destination and fee in your wallet before signing.

## What it costs

Solana's [documented base fee](https://solana.com/docs/core/fees) is 5,000 lamports per signature,
or 0.000005 SOL. The check estimates one single-signature withdrawal per account. This is a base
fee estimate, not a measured complete wallet transaction. Optional priority fees and extra
signatures cost more; batching can cost less. Deactivating first needs another transaction.

## Deadline

No protocol deadline. Stake lockups and the network's cooldown rules still apply.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Can I withdraw active stake immediately?

The check only counts accounts ready for full withdrawal. Active stake normally needs deactivation and cooldown first.

### Is being the staking authority enough?

No. The covered withdrawal needs the withdrawal authority. A current lockup may also require custodian authorization.

### What does a withdrawal cost?

The estimate is one transaction and one signature per account, using the documented 5,000 lamport base fee. Extra signatures and priority fees can cost more.

## Verified on

2026-11-01. Mainnet program accounts, Clock, StakeHistory, official layout, withdrawal and cooldown
implementation, and official staking page. The public fixture owner was found in a Stake program
initialize instruction in transaction
`3D75z57xmuvmvkr6uySNkoHuN2zqivjL6mQavb41jLsKsHW8mUXH8pe3qVV697EsseajuuSFkZFwcUGzYxQkStp4`.
