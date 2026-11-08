---
title: 'Claim UNI Airdrop 2020: What Still Works | DeFi Checkup'
description: 'Check your original UNI airdrop allocation and claim status. Learn what proof the Ethereum contract needs and why an old claim page may no longer be available.'
targetQuery: 'claim UNI airdrop 2020'
intent: 'Informational'
verifiedOn: '2026-11-01'
featured: true
secondaryQueries: ['unclaimed UNI airdrop', 'UNI claim proof', 'Uniswap claim button missing']
---

# Claim the UNI airdrop from 2020

Claiming the UNI airdrop from 2020 requires an eligible allocation that has not already been
claimed. The Ethereum distributor still has no claim deadline in its verified code, but an old
"Claim UNI" tutorial is not proof that today's Uniswap app has a working claim screen.

> On 2026-11-01 the contract source and current app route table were checked. No dedicated UNI
> claim page was confirmed. The bundle contains old claim labels, but `/uni` and `/claim` are not
> registered routes. A final browser check is needed before relying on any app claim option.

## What happened to the original UNI airdrop?

[Uniswap's announcement](https://blog.uniswap.org/uni) describes the September 2020 distribution:
150 million UNI for historical users, including 400 UNI for addresses that called Uniswap before
September 1, 2020, a liquidity-provider allocation and a SOCKS allocation. Buying UNI now does not
create an entitlement to that historical distribution.

The catalog recorded 257,005 UNI remaining in the distributor on 2026-11-01, down from about
12.5 million on 2026-10-04. Its recorded claim activity showed batch claims submitted on behalf of
eligible owners from around October 18, 2026. If you never claimed yourself, the allocation may
already have arrived in the eligible wallet.

## Who is eligible?

Eligibility comes from Uniswap's published Merkle tree. The distributor is
`0x090D4613473dEE047c3f2706764f49E0821D256e` on Ethereum. Its
[verified source](https://sourcify.dev/server/v2/contract/1/0x090D4613473dEE047c3f2706764f49E0821D256e?fields=all)
checks an allocation's index, recipient, amount and proof, then checks whether that index was paid.

An allocation is not an available balance if it was already claimed. The zero address allocation
cannot receive UNI and is reported as lost. Having traded through a different wallet also does
not make your current wallet eligible.

## How to get it out if the app has no claim page

Do not connect to a new "UNI recovery" site because an old tutorial's button is missing. A GET
of `app.uniswap.org/uni` or `/claim` returns an app shell, not evidence of a claim page.

1. Check eligibility and claim status first. If it was paid, inspect the eligible wallet's UNI
   balance and history instead of trying to claim twice.
2. Obtain your entry from [Uniswap's published distribution files](https://github.com/Uniswap/mrkl-drop-data-chunks/tree/c215bf1e4360205acdc6c154389b10a2f287974d/chunks).
   The pinned `mapping.json` maps chunk boundaries; the matching chunk contains the entry for the
   complete eligible address. You need its `index`, `amount` in raw UNI units and full `proof`
   array. The amount in these files is hexadecimal, not a human-readable UNI quantity.
3. Verify that entry's proof against the distributor's Merkle root and check `isClaimed(index)`.
   DeFi Checkup does this verification for its finding, but does not currently display a prepared
   claim or a downloadable proof. Do not reconstruct the raw amount from a rounded display value.
4. If no official claim screen is available, the operation is
   `claim(uint256 index, address account, uint256 amount, bytes32[] merkleProof)` on the
   distributor above. A person comfortable with verified-contract tools can prepare that exact
   call using the published entry. If you cannot verify those inputs, stop and get technical help
   rather than send a guessed transaction.
5. The caller pays Ethereum gas. Anyone can submit a valid claim, and UNI goes to `account`,
   which is bound into the proof. Before copying the recipient, use your own wallet as the source,
   never transaction history, and compare the entire address to avoid address poisoning.

DeFi Checkup provides no claim button and never sends this transaction. The missing confirmed
frontend is a practical limitation, not a claim that the distributor has expired.

## What it costs

A recorded claim used 83,345 gas on 2026-11-01; the scanner budgets 84,000 gas. This is one
Ethereum transaction, with ETH cost determined by the current gas price. A second claim for an
already paid index fails and can still waste gas.

## Deadline and risks

The verified distributor has no expiry or sweep function. Payment still needs enough UNI in the
contract. Do not confuse this historical airdrop with new giveaways or a promise of another drop.

## How to check your original allocation

[Run the read-only scanner](/) with the original address. It loads Uniswap's pinned files,
validates the proof and reads claim status and backing. No wallet connection. No signatures.
An already claimed result does not tell you who currently controls the recipient wallet.

## FAQ

### Can I claim the 400 UNI airdrop now?

Only if your original allocation is valid, unclaimed and backed by enough UNI. The historical
400 UNI amount was not a universal entitlement for every Ethereum wallet.

### Where is the Claim UNI button?

No working claim screen was confirmed in the current app on 2026-11-01. Old labels remain in its
JavaScript, but the checked route table does not register `/uni` or `/claim`.

### Can someone else claim my UNI?

Someone else can submit a valid proof and pay gas. The distributor sends UNI to the address in
the proof, so the submitter cannot replace the recipient with their own wallet.

### How much gas does the old UNI claim use?

The catalog measured 83,345 gas for one real claim on 2026-11-01 and uses an 84,000 gas estimate.
Check the current Ethereum fee before submitting.

### What if I never claimed but the scanner says already claimed?

Check the eligible wallet's UNI transfers. The contract accepts claims on behalf of another
address, and the catalog recorded batch activity doing this in October 2026.

## Verified on

2026-11-01. Official UNI announcement, Sourcify distributor source, published distribution files,
catalog fixtures and gas record; app HTML, JavaScript route table and both legacy paths. Browser
confirmation of any reachable claim modal remains pending.
