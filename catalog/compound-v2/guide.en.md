---
title: 'Compound V2 Withdraw: Deposits and Debt | DeFi Checkup'
description: 'Find old Compound V2 deposits and check debt, available cash and unpaid COMP. Learn when a withdrawal can work and why a displayed balance may be unavailable.'
targetQuery: 'compound v2 withdraw'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries: ['Compound V2 redeem cTokens', 'Compound debt balance', 'unclaimed COMP rewards']
---

# Compound V2: withdraw old deposits and check debt

Compound V2 withdrawals can still work for old deposits, but a displayed cToken balance is not
necessarily money you can take out now. Debt, collateral rules and the cash available in each
market determine what can be redeemed. Check those conditions before paying gas.

> Contract reads and redemption simulations were recorded on 2026-11-01. The V2 app and its
> withdrawal code still load. The connected-wallet screens, including DSProxy handling, need a
> final browser walkthrough.

## What happened to Compound V2?

The catalog's 2026-11-01 verification found new deposits and borrows paused in its 20 Ethereum V2
markets, with COMP distribution stopped. That does not erase existing deposits or borrowing
obligations. The catalog successfully simulated cETH and cUSDC redemptions for public test data.

[Compound's V2 cToken documentation](https://docs.compound.xyz/v2/ctokens/) explains redemption:
you exchange cTokens for the underlying asset. Redemption can fail when it leaves too little
collateral or when the market lacks enough cash. The guide concerns V2, not Compound III.

## Who is affected?

The scanner reads the 20 cataloged markets of Comptroller
`0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B`. It checks your wallet and the current, still-owned
DSProxy found through Maker's registry.

Read the result carefully:

- **Found:** supplied assets. These are gross amounts, not a guarantee that all can be withdrawn
  now. Notes explain debts or insufficient market cash.
- **Fake:** collateral blocked in an account whose debt exceeds the allowed collateral value.
  The deposit exists, but showing it as freely recoverable would be misleading. A separate
  deposit not used as collateral can still be shown as found.
- **Lost:** accrued COMP that the controller cannot currently pay. The recorded balance was
  only 0.0000475 COMP on 2026-11-01. This reward shortfall is separate from your supplied assets.

A DSProxy's loose tokens are also separate from supplied cTokens. Read the
[DSProxy withdrawal guide](/protocols/dsproxy/) and, if you used a DSA, the
[Instadapp account guide](/protocols/instadapp-dsa/). The DSA balance check does not inspect every
position deposited into a lending protocol.

## How to get it out

1. Open [Compound's official V2 app](https://v2-app.compound.xyz). Confirm it is V2 on Ethereum,
   and use the wallet that supplied the assets.
2. If the finding belongs to a DSProxy, use [DeFi Saver](https://app.defisaver.com) to inspect that
   proxy's Compound position. Connecting the owner to a direct-account app does not necessarily
   make the app act through the proxy.
3. Read both supply and borrow balances. If redeeming collateral would breach the account's
   limit, debt must be reduced or collateral support changed first. Do not repay an old debt
   simply because a portfolio tracker suggests a free balance: compare the whole position.
4. Select the supplied asset and its withdrawal option. Review the available cash and try an
   amount within both the account's collateral limit and the market's cash balance.
5. Confirm the asset, recipient and Ethereum fee in your trusted wallet. If you copy a recipient,
   copy from your wallet, never transaction history. Compare the full address to avoid address
   poisoning. Review the result after confirmation before trying another market.

The exact connected screen still needs browser verification. A contract simulation from public
test data does not guarantee your account's redemption will succeed.

## What it costs

The catalog measured 302,334 gas for redemption with two entered collateral markets and 530,546
with seven on 2026-11-01. It estimates each redemption from the number of markets entered. Debt
repayment, approvals and proxy actions can add transactions. The COMP claim estimate is separate:
1,895,370 gas was measured that day for a claim walking all 20 markets.

## Deadline and risks

There is no withdrawal deadline reported by this check. Debt, liquidation exposure and market
cash still matter. DAI had 11.8% and USDC 39.8% cash relative to supplies in the 2026-11-01
verification. These are dated observations, not today's withdrawal limits. Borrower repayments
can change available cash; no waiting period guarantees liquidity will return.

## How to check old Compound balances

[Scan your address](/) to read supported supplies, debt conditions, market cash and COMP backing.
No wallet connection. No signatures. The report preserves incomplete reads instead of treating
them as an empty position. It does not calculate a guaranteed net recovery after debt repayment.

## FAQ

### Can I withdraw from Compound V2 after new deposits were paused?

Pausing new deposits does not itself block redemption. Your withdrawal still depends on
collateral rules, market cash and the current contract state.

### Why does my tracker show a balance I cannot withdraw?

A supplied balance may secure debt. If withdrawing it would leave insufficient collateral, the
controller blocks redemption. The scanner distinguishes blocked collateral from loose tokens.

### Can I recover unpaid COMP rewards?

Only while the controller can fund the claim. On 2026-11-01 it held 0.0000475 COMP, so unpaid
rewards exceeding the available balance were marked lost rather than counted as recoverable.

### How much does a Compound withdrawal cost?

It needs Ethereum gas. Recorded redemptions used 302,334 gas with two entered markets and
530,546 with seven on 2026-11-01. Repayment or approval transactions cost extra.

### Does this check include Instadapp positions?

The Compound check reads the wallet and its registered, still-owned DSProxy. It does not inspect
Compound positions inside an Instadapp DSA. The separate DSA check covers loose ETH and listed
tokens held by that account.

## Verified on

2026-11-01. Official V2 app HTML and JavaScript, official cToken documentation, catalog contract
reads, public test fixtures, redemption simulations and gas measurements. Wallet UI steps and
proxy routing remain pending a browser review.
