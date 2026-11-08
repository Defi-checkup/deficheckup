---
title: 'Mute.io Withdraw Liquidity: Koi on zkSync | DeFi Checkup'
description: 'Find old Mute and Koi liquidity, fees, Amplifier stakes and farm rewards on zkSync Era. Learn exit steps, gas estimates and the penalty for unvested rewards.'
targetQuery: 'Mute.io withdraw liquidity'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries:
  [
    'Koi remove liquidity zkSync',
    'Mute Amplifier withdraw',
    'Koi farm vesting penalty',
    'claim Koi fees',
  ]
---

# Mute.io: withdraw liquidity from Koi on zkSync Era

Mute.io liquidity withdrawals now involve the legacy Koi contracts on zkSync Era. If you used
Mute or Koi, your funds can sit in a pool LP token, unpaid swap fees, an old Amplifier or a newer
farm. Identify which one holds the balance before trying to remove liquidity.

> Contract behavior, recorded withdrawals and current app code were checked on 2026-11-01.
> The app still contains pool and farm routes, but whether it displays every legacy position
> needs a browser walkthrough. A 200 response from the app is only a loaded shell.

## What happened to Mute and Koi on zkSync?

Koi was formerly Mute. Its [current home page](https://koi.finance) points to Robinhood Chain,
while the [legacy app](https://dapp.koi.finance) still serves zkSync pool and farm code. Changing
frontends does not automatically remove LP tokens or move old positions to another chain.

The catalog's 2026-11-01 measurements found about $1,043,316 in 153 pools, $338,765 backing fees in
145 pools, $125,950 of LP in six Amplifiers and $152,408 of LP in 16 farms. These are dated totals,
not today's valuations or amounts guaranteed recoverable by an individual wallet.

## Who is affected, and which check applies?

All four checks concern zkSync Era, not the [zkSync Lite sunset](/protocols/zksync-lite/).
The pool factory is `0x40be1cBa6C5B47cDF9da7f963B6F761F4C60627D`.

- **LP in your wallet:** `koi-lp` reads your pool-token balance in the 153 cataloged pools with
  at least $10 liquidity when selected from 2,504 pools on 2026-11-01. It values your share from
  pool reserves. It does not find staked LP by reading only your wallet balance.
- **Unclaimed pool fees:** [the Koi fees check](/protocols/koi-fees/) reads credited fees in 145
  pools whose fee contract held at least $10 that day. Fees can remain after you remove LP.
- **Old Mute Amplifiers:** [the Amplifier check](/protocols/koi-amplifier/) reads stakes in six
  contracts whose reward periods ended in 2023. The existing guide lists all six complete
  addresses and dates.
- **Newer Koi farms:** [the farm check](/protocols/koi-farm/) reads stakes in 16 contracts using
  selector `0x64c73e00`. Their source is unpublished; the catalog matched the response layout
  against recorded withdrawals. Rewards vest over 2,592,000 seconds, or 30 days.

These are fixed coverage lists. Smaller pools, other farms, bonds and unlisted products can be
missed. A reward balance is also limited by the funding available in its separate payer contract.

## How to get it out

Before copying a recipient, copy it from your own wallet, never from transaction history. Compare
the entire address to avoid address poisoning. Match the network and full pool or staking
contract in the report rather than relying on a token symbol.

### 1. Remove LP held directly in your wallet

Open [the legacy Koi app](https://dapp.koi.finance), select zkSync Era and inspect Pools. The
published app registers `/pool` and specific pool routes. Select the pool matching your LP and
review removal of liquidity, including both tokens returned, minimum amounts and the recipient.
An LP allowance may require approval before removal.

The catalog verified router `0x8B791913eB07C32779a16750e3868aA8495F5964` against the factory.
The router's `removeLiquidity` operation needs the two tokens, LP amount, stable/volatile pool
flag, minimum outputs, recipient and deadline. Do not guess those parameters if the app cannot
show your pool. A direct contract operation needs independent verification of the exact pool and
transaction, and this site does not prepare it.

### 2. Claim swap fees, even if you already removed liquidity

The pool's `claimFees()` pays both credited tokens in one transaction. Removing LP and collecting
fees are separate actions. A no-LP balance does not prove the fee amount is fake. The app bundle
contains fee-claim code; whether it exposes the relevant legacy fee control needs browser review.
Fees earned since the last pool interaction can make the final payout differ from the read value.

### 3. Unstake an old Mute Amplifier, then remove LP

Match the Amplifier's complete address to the finding. The recorded `withdraw()` takes no inputs
and returns the staked LP, pool fees and a MUTE reward. The catalog measured real withdrawals in
October 2026 and checked the behavior on 2026-11-01.

If the app no longer lists it, the recorded fallback is a call to that Amplifier with zero ETH
value and calldata `0x3ccfd60b`, the selector of `withdraw()`. These contracts have unpublished
source, so a verified write interface may be absent. Use a wallet capable of inspecting a custom
call only if you can independently verify the exact destination and operation. This is not a
claim that a generic unknown contract with that selector is safe.

Once LP arrives in your wallet, follow the pool removal step above to receive the two underlying
tokens. Unstaking alone does not complete the liquidity withdrawal.

### 4. Withdraw a Koi farm, checking vesting first

[Koi's farming docs](https://docs.koi.finance/mute-switch/amplifier) state that early withdrawal
forfeits remaining unmatured rewards. Check the vesting date in the report before acting. The
full unpaid reward is not necessarily the amount payable if you leave early.

Inspect Farms in the legacy app. Its JavaScript registers `/farm`, `/farm/:poolId` and
`/farmv2/:poolId`. A recorded farm `withdraw()` returns LP, vested rewards and pool fees.
The same zero-value `0x3ccfd60b` fallback is documented by the catalog for its covered farms;
it is not backed by published Solidity source. Treat destination verification as essential.
Then remove the returned LP through its pool.

A reward payer's balance is shared by other claims. The scanner marks an uncovered reward
unavailable, and a currently covered reward is not reserved for you.

## What it costs

All figures below were recorded or estimated on 2026-11-01, in zkSync Era gas units:

- LP: approval up to 108,262 gas and removal up to 353,826 gas. The conservative combined
  allowance is 462,088 gas, roughly $0.05 at the recorded prices.
- Fees: one claim measured 303,144 gas, roughly $0.03 at the recorded prices.
- Amplifier: withdrawal up to 582,123 gas, then up to 462,088 gas for approval and LP removal.
  The recorded total estimate was roughly $0.10.
- Farm: withdrawal up to 847,906 gas in 64 recorded claims, most below 530,000, then up to
  462,088 gas for approval and removal. The recorded total estimate was roughly $0.13.

These historical dollar values are not today's quote. The report uses current gas prices and
does not include a later swap or bridge. Several findings can describe parts of one exit, so
summing every displayed estimate may overstate the number of distinct operations.

## Deadline and risks

The covered checks report no withdrawal deadline. Unpublished farm and Amplifier source limits
what can be guaranteed about future behavior. Liquidity, token prices and reward backing change;
vesting penalties still apply. Do not deposit new funds to recover an old position or assume the
new chain's interface can move an old zkSync stake.

## How to check all four kinds of Mute and Koi balance

[Scan your zkSync wallet address](/). The scanner runs the four checks separately and shows the
full holding contracts. No wallet connection. No signatures. Read partial-result warnings and
match the finding type to the relevant exit above.

## FAQ

### Is Mute.io now Koi Finance?

Yes, the catalog covers the legacy Mute and Koi contracts on zkSync Era. The current Koi home
page points to another chain, which does not migrate the old positions automatically.

### Why do I have Koi fees but no LP tokens?

Fees can remain credited after liquidity is removed. The fees check reads those credits
separately from the wallet's LP balance, so an empty LP balance does not invalidate the fees.

### Can I withdraw LP from an ended Mute Amplifier?

The catalog recorded successful withdrawals from its covered legacy Amplifiers in October 2026. Their `withdraw()` returns LP; removing that LP into underlying tokens is a separate step.

### What does removing Koi liquidity cost?

The 2026-11-01 recorded maxima were 108,262 gas for approval and 353,826 for removal. Staked LP
needs another withdrawal first. Check the current fee quote rather than the historical USD cost.

### Do I lose farm rewards if I withdraw early?

Koi's docs say early withdrawal forfeits unmatured rewards. Review the report's vesting date
and current farm conditions; a full unpaid reward is not a promise of the early-exit payout.

## Verified on

2026-11-01. Official Koi home, legacy app HTML and JavaScript routes, official farming docs;
catalog pool lists, router verification, fixtures, recorded withdrawals and gas measurements.
Legacy position visibility, fee controls, farm exits and custom-call wallet screens remain pending
browser review. No source publication was found for the covered staking contracts.
