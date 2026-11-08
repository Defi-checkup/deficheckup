---
title: 'Withdraw Mute Amplifier Stakes | DeFi Checkup'
description: 'Find LP tokens left in six legacy Mute Amplifiers on zkSync Era. Review withdrawal requirements, measured gas costs and how to remove liquidity after unstaking.'
targetQuery: 'withdraw Mute Amplifier'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Mute (now Koi) Amplifier, LP still staked

> Steps in "How to get it out" are written from how the Amplifier contracts work on-chain. They have not
> yet been walked through in the live app.

For the complete exit, including LP, fees, Amplifiers and farms, read the
[Mute.io and Koi withdrawal guide](/protocols/koi-lp/).

## What it is

Before it was renamed Koi, Mute ran Amplifiers on zkSync Era: you staked the LP token of a pool
and earned MUTE for a set period. The last of them ended in August 2023. When the rewards stopped,
the staked LP stayed in the contracts. On 2026-11-01, six Amplifiers still held about $126,000 of
LP, spread over thousands of stakers, most of it in the USDC.e/WETH pool.

The catalog recorded successful withdrawals from these covered Amplifiers in October 2026.

## Who is eligible

Any wallet that staked LP in one of these Amplifiers and never withdrew. The check reads
`totalUserStake` for your address in each of them and shows your share of both tokens of the pool
at today's reserves:

| Amplifier                                    | Pool        | Rewards ended |
| -------------------------------------------- | ----------- | ------------- |
| `0x3bdb188cfb6A9173E36A916004144b122eA507cE` | USDC.e/WETH | 2023-05-17    |
| `0xdd3C34aDf2851766DDc302766228d59F43a4386F` | USDC.e/WETH | 2023-06-17    |
| `0x06e8D81f824F8b8758A75Fe9616Dd154400Cb7a4` | USDC.e/WETH | 2023-07-19    |
| `0xCc05E242b4A82f813a895111bCa072c8BBbA4a0e` | USDC.e/WETH | 2023-08-31    |
| `0x0B5d073eA715f38Fde1dE52689CFaB041cC8d278` | WETH/WBTC   | 2023-07-21    |
| `0xBFdD2e0d527A00aA14aAf84ea01a613299aa6908` | WETH/PANDA  | 2023-06-18    |

## How to get it out

Before copying a recipient, use your own wallet, never transaction history, and compare the
complete address to avoid address poisoning. Verify the full contract destination separately.

1. Call `withdraw()` on the Amplifier shown in the report, from the wallet that staked. It takes
   no inputs and pays everything in one transaction: your LP token, the pool fees it earned while
   staked and a small MUTE reward. Check first whether Koi's app at https://dapp.koi.finance still
   lists your Amplifier. If it does not: the contract's code is not published, so block explorers
   show no write button for it. A wallet that lets you send custom data can still call it: send a
   transaction to the Amplifier with no ETH and the data `0x3ccfd60b` (the code of `withdraw()`).
2. You now hold the pool's LP token. Remove the liquidity to get both tokens back (see the Koi
   liquidity check for the steps).

## What it costs

Three zkSync Era transactions: the withdrawal (up to 582,123 gas in real withdrawals of October
2026), then the approval and the removal of the liquidity (up to 462,088 gas together). About ten
cents in total on 2026-11-01.

## Deadline

No deadline. People were still withdrawing from these Amplifiers in October 2026.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Does an ended Amplifier still hold my LP?

It can. The reward period ending does not automatically return staked LP to the wallet.

### Is unstaking the same as removing liquidity?

No. Unstaking returns the LP token. Removing that LP through its pool is a separate operation that returns the underlying tokens.

### What does the exit cost?

The recorded withdrawal maximum was 582,123 gas, plus a conservative 462,088 gas for LP approval and removal, verified on 2026-11-01.

## Verified on

2026-11-01
