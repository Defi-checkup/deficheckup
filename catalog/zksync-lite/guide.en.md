---
title: 'zkSync Lite Withdraw After Shutdown | DeFi Checkup'
description: 'Check balances left after the zkSync Lite shutdown, understand Ethereum claims and gas costs, and find the official withdrawal page without connecting a wallet.'
targetQuery: 'zksync lite withdraw after shutdown'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries:
  ['zkSync Lite sunset claim', 'zkSync Lite Ethereum withdrawal', 'zkSync Lite sponsored claim']
---

# zkSync Lite: withdraw after the shutdown

zkSync Lite withdrawals after shutdown now use an Ethereum claim contract. If you left ETH or
tokens on Lite, the old L2 withdrawal flow is no longer the route to use. Start with the official
withdrawal page and check which token balances remain unpaid.

> The claim contract and current app code were checked on 2026-11-01. A complete walkthrough of
> the sponsored and paid withdrawal screens still needs a browser. A successful page request does
> not prove that a withdrawal will succeed.

## What happened to zkSync Lite?

[ZKsync's sunset announcement](https://www.zksync.io/blog/zksync-lite-sunset) says block production
stopped on May 4, 2026. Balances left at shutdown became claims on Ethereum. This is separate from
zkSync Era: assets in a [Koi or Mute pool on Era](/protocols/koi-lp/) need a different withdrawal.

The catalog recorded 5,498.7 ETH in the distributor on 2026-11-01, plus token balances. That is a
historical measurement, not a promise that every claim can be paid now.

## Who is affected?

A wallet with ETH or tokens left on Lite at shutdown may have one claim for each token. The
Ethereum distributor is `0x0a14B696350546110a0D8acDb86226983af9D2a0`. Its
[verified implementation](https://sourcify.dev/server/v2/contract/1/0xfB94f8a45E81fa9f6256Ddb0EEc0735b8520CdeA?fields=all)
checks a Merkle proof before paying the claimant.

An old balance screenshot is not enough. The claim must exist in the official list, remain
unclaimed and have enough backing in the distributor. The scanner checks claim status, pause
state and backing. Known values below one US cent are excluded.

## How to get it out

Before entering or copying an address, take it from your own wallet, never from transaction
history. Address poisoning puts lookalike addresses there. Compare the entire address.

1. Open [the official zkSync Lite withdrawal page](https://lite.zksync.io). The page is titled
   "Withdraw Your Funds". Enter the address that held the Lite balance, or use the page's wallet
   option inside that official site.
2. Review the listed tokens and the claimant address. Each token is a separate claim. The app's
   code supports a sponsored flow and a paid flow; its public configuration selected sponsored
   claims when checked on 2026-11-01.
3. If the sponsored service is unavailable, use the paid flow if the app offers it. Sponsored
   claims failed in our own test on 2026-10-29; that is not evidence that they still fail
   today. Confirm the network is Ethereum and review the gas quote.
4. A paid `claimTo(index, claimant, token, amount, merkleProof)` can be submitted by another
   funded wallet. The contract sends the funds to the claimant bound into the proof. It does not
   send them to the wallet paying gas. Do not replace any proof inputs with guessed values.
5. After confirmation, check the claimant's balance on Ethereum. Do not expect the funds to
   appear on zkSync Era.

## What it costs

The catalog measured 48 real Ethereum claims on 2026-11-01: 66,887 to 122,642 gas per token. The
report uses the higher figure with the current gas price. Sponsored claims depend on the service;
paid claims need ETH in the submitting wallet. Compare the fee with the token's value first.

## Deadline and risks

The checked implementation has no closing deadline or sweep function. Its owner can pause claims,
and the distributor is an upgradeable proxy. A missing deadline does not guarantee permanent
access through the website. The scanner shows a pause or insufficient backing as a warning.

## How to check without connecting a wallet

[Scan your address on DeFi Checkup](/). It reads the official eligibility list through the proxy
and checks Ethereum claim state. No wallet connection. No signatures. An error or partial result
needs a retry; it is not confirmation that the address has no funds.

## FAQ

### Can I still withdraw from zkSync Lite after shutdown?

An unpaid allocation can be claimed on Ethereum if claims are open and the distributor holds
enough of that asset. Use the official withdrawal page rather than the old L2 withdrawal process.

### Do I need ETH in my old Lite wallet?

Not for a permissionless `claimTo` submitted by another wallet. The submitting wallet pays the
Ethereum fee, and the contract pays the original claimant.

### Is zkSync Lite the same as zkSync Era?

No. The Lite sunset claim pays on Ethereum. The scanner's Koi and Mute checks read separate
contracts on zkSync Era.

### How much does a claim cost?

A paid claim needs Ethereum gas for each token. The measured range was 66,887 to 122,642 gas on
2026-11-01. The current ETH cost depends on gas prices and the transaction offered by the app.

### Why does the official page say withdrawals are unavailable?

The app checks service availability before showing its form. Its code includes an unavailable
state. Check the official announcement and return later if that state appears; a loaded website
alone does not mean claims are currently enabled.

## Verified on

2026-11-01. Official sunset announcement, page HTML, ClaimApp JavaScript and public configuration;
Sourcify implementation source; catalog claim checks and recorded gas measurements. Wallet
interaction and sponsorship success remain pending a browser review.
