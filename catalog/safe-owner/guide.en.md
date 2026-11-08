---
title: 'Find Balances in Safes You Own | DeFi Checkup'
description: 'Find balances in Safes associated with your wallet across supported networks. Check current owners, signature requirements and gas costs before moving funds.'
targetQuery: 'find forgotten Safe wallet balances'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: false
---

# Safes you own

> Steps in "How to get it out" are written from how Safe works. They have not
> yet been walked through in the live app.

## What it is

Safe (formerly Gnosis Safe) is the most used smart contract wallet. Teams, DAOs and individuals
create Safes on many networks, often for a single project or an airdrop, and then forget them.
DeFi Saver also moved its users to Safes in 2024. Portfolio trackers usually show your own wallet,
not the Safes it owns.

## Who is eligible

Any wallet that is an owner of a Safe on one of 13 networks (every network DeFi Checkup reads
except Blast and Flow EVM, which Safe's service does not cover). The check asks Safe's public
transaction service for the Safes your wallet owns and what each one holds, leaving out tokens the
service marks as spam. Who signs is read from each Safe contract: the report says when a Safe needs
several signatures, and when other owners could move the funds without you. If that read fails,
the report says so instead of assuming the Safe is yours alone.

## How to get it out

1. Open the official Safe app: https://app.safe.global
2. Connect the wallet that owns the Safe, inside the official app only.
3. Open the Safe (the report shows its full address) and send the funds to your wallet.
4. If the Safe needs several signatures, the other owners have to confirm the transaction too.

## What it costs

One transaction per transfer. Our estimate is about 90,000 gas, shown in dollars at today's gas
price. It depends on the network: on most L2s it is a few cents.

## Deadline

No deadline. The funds stay in the Safe until its owners move them.

## How to check

[Scan your address](/) without connecting a wallet or signing. Review incomplete results and
coverage limits before deciding whether to use the official app.

## FAQ

### Can one owner always move a Safe balance?

No. The Safe threshold determines how many owner signatures are required. The scanner reads owners and threshold from the contract.

### Does the scan include every network?

No. The Safe service coverage used here includes 13 supported networks and excludes Blast and Flow EVM.

### What does a transfer cost?

The check uses an unmeasured 90,000 gas estimate per transfer as of 2026-11-01. The actual Safe transaction depends on the network and operation.

## Verified on

2026-11-01
