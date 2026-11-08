---
title: 'DSProxy Withdraw: Recover Leftover Tokens | DeFi Checkup'
description: 'Check ETH and tokens left in a Maker or DeFi Saver DSProxy. Use the app withdrawal route, verify ownership and avoid confusing loose tokens with collateral.'
targetQuery: 'DSProxy withdraw tokens'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries: ['DeFi Saver token withdrawal', 'Maker DSProxy balance', 'DSProxy stuck ETH']
---

# DSProxy: withdraw tokens left in an old smart wallet

A DSProxy token withdrawal can recover loose assets left in an old Maker or DeFi Saver smart
wallet. The proxy has its own address, separate from the wallet that owns it. First establish
that the tokens are held directly by the proxy and that your wallet still controls it.

> Ownership checks and supported balances were verified on 2026-11-01. DeFi Saver's official
> documentation gives a token-withdrawal route. The current connected interface and native ETH
> withdrawal still need a browser walkthrough.

## What happened to my DSProxy balance?

DeFi Saver's [smart wallet documentation](https://help.defisaver.com/general/smart-wallets)
describes its use of Maker's DSProxy and newer Safe smart wallets. An old proxy can keep ETH or
tokens after you close a position. Moving to another interface does not itself transfer those
assets back to your owner wallet.

Loose assets are different from collateral deposited into Maker, Aave or Compound. A token
withdrawal from the proxy cannot redeem a separate lending position or erase its debt.

## Who is affected?

The scanner queries Maker's Ethereum ProxyRegistry,
`0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4`, for the proxy registered to the scanned owner.
It then confirms `owner()` still matches that wallet and reads ETH plus 18 cataloged tokens.

The registry remembers the latest proxy built for an owner. Older proxies are outside this
lookup. Transferred ownership, other registries, other networks and unlisted tokens can also
explain why a remembered asset does not appear.

For supplied cTokens and debt, use the [Compound V2 guide](/protocols/compound-v2/). For a
separate account created through Instadapp, use the [DSA guide](/protocols/instadapp-dsa/).
A new Safe and an old DSProxy are not interchangeable destinations.

## How to get it out

1. Open [DeFi Saver](https://app.defisaver.com) with the wallet that currently owns the proxy.
   Confirm the selected network is Ethereum and compare the complete proxy address with the
   finding. Do not create a new smart wallet to access an existing proxy's funds.
2. DeFi Saver's [official token withdrawal instructions](https://help.defisaver.com/general/troubleshooting/how-can-i-withdraw-tokens-from-my-smart-wallet)
   describe the Tokens section of Portfolio and an alternative
   [Token withdrawal page](https://app.defisaver.com/smart-savings/emergency-dai-withdraw).
   The latter URL returns the app shell; the documented connected screen still needs review.
3. For the alternative route, enter the full token contract address of the asset held by your
   proxy. Confirm the token on the explorer from its own contract, not by symbol alone. The docs
   say this interface defaults to DAI, so do not assume it selected your finding's token.
4. Select Withdraw and review the amount, asset and recipient. For native ETH the official docs
   give the full sentinel `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`; this is an interface
   identifier, not a destination to which you should send ETH.
5. Review the transaction in your trusted wallet and check the destination balance after
   confirmation. Copy recipient addresses from your own wallet, never transaction history, and
   compare them in full to avoid address poisoning.

Only the owner can authorize the relevant proxy action. Do not use arbitrary `execute` targets
or copied transaction data from a stranger. The official docs provide the supported route;
this site does not construct or send it.

## What it costs

The scanner estimates 150,000 Ethereum gas for a token withdrawal and 70,000 for native ETH.
These are unmeasured DSProxy estimates as of 2026-11-01, based on the expected proxy operation.
They are not recorded DSProxy transaction costs. Additional approvals or protocol redemptions
can cost more, and each token may need a separate transaction.

## Deadline and risks

There is no withdrawal deadline reported by the balance check. Current ownership and the
selected account matter more than the age of the proxy. If a token is used as protocol
collateral rather than held loose, withdrawing may be blocked by debt or require another action.
Never treat a gross supplied amount as the net proceeds of closing a position.

## How to check a forgotten DSProxy

[Scan the owner wallet](/). It looks up the current registered proxy, confirms ownership and
reads the supported balances. No wallet connection. No signatures. A failed ownership or balance
read is reported rather than being treated as proof that the proxy is empty.

## FAQ

### Can I withdraw tokens sent directly to my DSProxy?

DeFi Saver documents a token-withdrawal route for assets held directly by the smart wallet.
Your connected wallet must control the proxy, and the token must permit the transfer.

### Why does the scanner not show an older proxy I used?

The registry lookup returns the latest proxy built for the owner. It does not enumerate every
historical proxy, and the scanner excludes a proxy whose ownership has moved elsewhere.

### Should I enter the proxy address as the token address?

No. The token-withdrawal form asks for the token contract, while the proxy is the account
holding that token. Verify both complete addresses and their different roles.

### What does a DSProxy withdrawal cost?

The current estimates are 150,000 gas for a token and 70,000 for ETH, unmeasured as of
2026-11-01. The wallet's current transaction quote is more specific.

### Will withdrawing loose tokens repay my old Compound debt?

No. Loose token transfers and a Compound debt position are separate actions. Inspect the
lending position before deciding whether to repay, redeem or move any asset.

## Verified on

2026-11-01. Official DeFi Saver app, documented token-withdrawal route and smart wallet docs;
catalog registry, ownership and token checks. Connected Portfolio, alternative withdrawal screen
and ETH handling remain pending browser review. Gas remains an estimate.
