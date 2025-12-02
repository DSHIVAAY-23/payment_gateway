# Solana Devnet Gasless Flow – USDC Mint

## Overview

This run reuses the gasless pull-and-split scripts but switches the mint to devnet USDC:

- **Mint**: `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr` (USDC devnet)
- **User**: `7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5`
- **Merchant / Relayer**: `GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd`
- **Fee Collector**: `4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT`

Payment size: **1.50 USDC**  
Split: **99% (1.485 USDC) → merchant**, **1% (0.015 USDC) → fee collector**

## 1. Build Partial Transaction (User Signs)

```bash
export MINT_ADDRESS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
export FEE_COLLECTOR_PUBKEY=4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT
export USER_PUBKEY=7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5

node scripts/build_partial_with_fee.js \
  GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd \
  1.50 \
  usdc-order-001
```

Output (abridged):
```
RPC URL: https://api.devnet.solana.com
User ATA: 9Ebx32bKzKxzcFUH1LjjpJNBfd99JnseLWvmTWdE47e6
Merchant ATA: 5CG3XYtpGxwWsQt2rqqG7zLpapY7UAzFJySD6e4zV6F
Fee ATA: Ey8cSNaHgqgpv4mrDoMZfhmB5TjM9rgQ5g8zM1PiRdAV
Splitting amount=1500000 (smallest units) -> merchant=1485000, fee=15000
partial_tx.base64 written (includes merchant+fee transfers with 1% fee)
```

## 2. Relay & Submit (reaysol.js)

```bash
node scripts/reaysol.js
```

Output:
```
submitted tx: 3fipLcz6eukuWoF8j5YK7SvDGjsKt3YK1ygrgMEW65UbmNfMAy7dL8n3BgtqdMchNxuqiohy8hnhi9WkKpuNRGRm
Explorer: https://explorer.solana.com/tx/3fipLcz6eukuWoF8j5YK7SvDGjsKt3YK1ygrgMEW65UbmNfMAy7dL8n3BgtqdMchNxuqiohy8hnhi9WkKpuNRGRm?cluster=devnet
```

## 3. Post-Transaction Balances

### User
```bash
spl-token accounts --owner 7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5 --url https://api.devnet.solana.com

Token                                         Balance
-----------------------------------------------------
Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr  998.5
```
User dropped from 1000 → 998.5 (paid 1.50 USDC total).

### Merchant
```bash
spl-token accounts --owner GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd --url https://api.devnet.solana.com

Token                                         Balance 
------------------------------------------------------
Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr  3001.485
```
Merchant went from 3000 → 3001.485 (received 1.485 USDC).

### Fee Collector
```bash
spl-token accounts --owner 4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT --url https://api.devnet.solana.com

Token                                         Balance
-----------------------------------------------------
Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr  0.015
```
Fresh ATA was created during this run; balance now 0.015 USDC (1% of 1.50).

## 4. Transaction Proof

Explorer link shows both SPL `TransferChecked` instructions:
- `7rKDTsVB...` → `5CG3XYtp...` (merchant ATA) — **1,485,000** units (1.485 USDC)
- `7rKDTsVB...` → `Ey8cSNaH...` (fee ATA) — **15,000** units (0.015 USDC)

## Conclusion

Switching the mint to devnet USDC works without changes to the core scripts:
- `build_partial_with_fee.js` adapts automatically based on `MINT_ADDRESS`.
- `reaysol.js` signs and broadcasts the user-signed partial, producing a confirmed tx on devnet.
- Balances confirm the 99%/1% split was applied exactly.

