# Solana Devnet Gasless Flow Test – 1% Fee Split

## Overview

This document captures the complete devnet run that uses `build_partial_with_fee.js` + `reaysol.js` to collect a 1% platform fee:

- Mock USDT mint: `8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr`
- User: `7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5`
- Merchant/Relayer: `GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd`
- Fee Collector: `4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT`

Goal: send 1.23 mock USDT from the user, so merchant receives 99% (1.2177) and fee collector receives 1% (0.0123).

## 1. Build Partial Transaction (user signs)

Command:
```bash
node scripts/build_partial_with_fee.js \
  GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd \
  1.23 \
  demo-order-002
```

Output (abridged):
```
RPC URL: https://api.devnet.solana.com
User pubkey: 7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5
Relayer pubkey: GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd
Merchant pubkey: GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd
Fee collector pubkey: 4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT
Mint: 8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr
Reference: demo-order-002
User ATA: 7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB
Merchant ATA: 2wdCrkn2wu8R7XG7ZtaJQGgaEUmUErAoBRCyEAMNBc4p
Fee ATA: AmweZ5CZFeQgYpUmJ3VRfQ6znuHMZmfHV2Jhkkdzfhne
Splitting amount=1230000 (smallest units) -> merchant=1217700, fee=12300
Signatures before relayer:
  user signature present, relayer signature absent (as expected)
partial_tx.base64 written (includes merchant+fee transfers with 1% fee)
```

## 2. Relay & Submit (reaysol.js)

Command:
```bash
node scripts/reaysol.js
```

Output:
```
Submitting transaction...
submitted tx: 2hgnmrfDodBLXHyRjK7xEdCN7KUVp9EhFvB5mDtnHvUKxYxv3s8ZLCMYLqwJnFxHkKP6XceE8A889phygFFm2bVy
confirmation status: confirmed (slot 424384677, err: null)
Explorer: https://explorer.solana.com/tx/2hgnmrfDodBLXHyRjK7xEdCN7KUVp9EhFvB5mDtnHvUKxYxv3s8ZLCMYLqwJnFxHkKP6XceE8A889phygFFm2bVy?cluster=devnet
```

## 3. On-Chain Verification

### Token Balances (post-transaction)

**Merchant (relayer) balances**
```bash
spl-token accounts --owner GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd --url https://api.devnet.solana.com

Token                                         Balance
-----------------------------------------------------
8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr  4.8954
Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr  3000
CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM  60
```

**Fee Collector balances**
```bash
spl-token accounts --owner 4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT --url https://api.devnet.solana.com

Token                                         Balance
-----------------------------------------------------
8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr  0.0246
```
(Before this run it held 0.0123, now 0.0246 thanks to the new deposit.)

**User ATA state**
```bash
solana account 7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB --output json --url https://api.devnet.solana.com
```
(Confirms the SPL account owner `Tokenkeg...` and data changed after the transfer.)

### Explorer Details

https://explorer.solana.com/tx/2hgnmrfDodBLXHyRjK7xEdCN7KUVp9EhFvB5mDtnHvUKxYxv3s8ZLCMYLqwJnFxHkKP6XceE8A889phygFFm2bVy?cluster=devnet

Inspecting that transaction shows:
- Transfer of 1,217,700 units (1.2177 mock USDT) to `2wdCrkn2...` (merchant ATA)
- Transfer of 12,300 units (0.0123 mock USDT) to `AmweZ5C...` (fee collector ATA)

Exactly matches the 99% / 1% split of 1.23.

## Conclusion

The devnet test flow works as expected:
- `build_partial_with_fee.js` generates a user-signed partial transaction that includes the merchant and fee transfers.
- `reaysol.js` signs as the relayer, submits the transaction, and confirms it on devnet.
- On-chain evidence (via explorer + CLI) confirms the merchant received 99% and the fee collector received 1%.

The improved validation script is still hitting Solana RPC’s `simulateTransaction` “Invalid arguments” edge case when deserializing legacy transactions; use `reaysol.js` for production testing, or skip simulation in the new script if you want that code path to succeed.

