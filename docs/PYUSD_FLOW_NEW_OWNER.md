# pyUSD Gasless Flow Test with New Owner

## Overview

This document details the complete gasless payment flow using pyUSD (PayPal USD) on Sepolia testnet with a different owner account. The transaction was executed using the `GaslessTokenGatewayDualFee` contract with a 1% cut fee.

---

## Account Details

### New Owner (Token Sender)
- **Address**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Private Key**: `0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0`
- **Role**: User who signs the permit and pays for the transaction (gasless)

### Contract Owner (Relayer)
- **Address**: `0x483089BfAdF65a08F1be109b42A9aae8535B75ee`
- **Private Key**: `0xb8c0b5cd1d3ced824a97b67650fb285d4ba182b7bf9eb43e4fbf129b1bdcc6a9`
- **Role**: Relayer who pays gas fees and executes the transaction

### Merchant (Receiver)
- **Address**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
- **Role**: Receives the net payment after cut deduction

### Gateway Contract
- **Address**: `0xE43E22639a7acD0b08168Ef320ee3F46c534d783`
- **Cut Collector**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Cut BPS**: 100 (1%)

### Token Details
- **Token**: pyUSD (PayPal USD)
- **Address**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
- **Decimals**: 6
- **Network**: Sepolia Testnet

---

## Step 1: Sign Permit for pyUSD

### Command
```bash
export GASLESS_ADDRESS="0xE43E22639a7acD0b08168Ef320ee3F46c534d783"
export TOKEN_ADDRESS="0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
export CUT_BPS="100"
export AMOUNT="5"
export PRIVATE_KEY="0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0"
export RECEIVER="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
node scripts/signPermit_dual_fee.js
```

### Output
```
=== Permit Signing for Gateway ===
Token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9 (PayPal USD)
Gateway: 0xE43E22639a7acD0b08168Ef320ee3F46c534d783
Owner: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Receiver (Merchant): 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

--- Amount Breakdown ---
Total Amount: 5 PayPal USD
Cut (100 bps): 0.05 PayPal USD
Net to Merchant: 4.95 PayPal USD

--- Signing Permit ---
Domain: {
  name: 'PayPal USD',
  version: '1',
  chainId: 11155111,
  verifyingContract: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'
}
Message: {
  owner: '0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2',
  spender: '0xE43E22639a7acD0b08168Ef320ee3F46c534d783',
  value: '5000000',
  nonce: '11',
  deadline: 1764530356
}

✅ Wrote permit to /data/payment_gateway/out/pyusd_permit_dual_fee.json
Signature v, r, s: 27 0xc6c2f2f46897369ff04a3f56f5e6d6efef9463f37f23e08d84312c2010531006 0x45c99fb0a349ee2c86a7976889f6eca9453b1d8ec1e97836ffef2c2867fb2deb
```

### Permit Details
- **Permit File**: `/data/payment_gateway/out/pyusd_permit_dual_fee.json`
- **Owner**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` (New owner)
- **Amount**: 5 pyUSD (5,000,000 in smallest units)
- **Nonce**: 11
- **Deadline**: 1764530356 (Unix timestamp)

---

## Step 2: Execute Transaction via Relayer

### Command
```bash
export GASLESS_ADDRESS="0xE43E22639a7acD0b08168Ef320ee3F46c534d783"
export RELAYER_PRIVATE_KEY="0xb8c0b5cd1d3ced824a97b67650fb285d4ba182b7bf9eb43e4fbf129b1bdcc6a9"
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

### Output
```
Using separate relayer account from RELAYER_PRIVATE_KEY
Relayer address: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Relayer ETH balance: 0.744506262943963268 ETH

--- Transaction Details ---
Token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
Sender: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Receiver (Merchant): 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Amount: 5000000
Cut BPS: 100
Cut Collector: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Deadline: 1764530356

Calling gateway.sendWithDualCollection...
Transaction sent: 0xb120b8ecdec1fa06b9bcaa5e13cae3622a8fc4be007c08d394449f2cf89f6da7
Waiting for confirmation...
✅ Mined in block 9740307
Etherscan: https://sepolia.etherscan.io/tx/0xb120b8ecdec1fa06b9bcaa5e13cae3622a8fc4be007c08d394449f2cf89f6da7

--- PulledAndSplit Event ---
Token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
Sender: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Receiver: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Amount: 5000000
Cut: 50000
Relayer: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
```

---

## Transaction Results

### Transaction Details
- **Transaction Hash**: `0xb120b8ecdec1fa06b9bcaa5e13cae3622a8fc4be007c08d394449f2cf89f6da7`
- **Block Number**: 9740307
- **Network**: Sepolia Testnet
- **Etherscan**: https://sepolia.etherscan.io/tx/0xb120b8ecdec1fa06b9bcaa5e13cae3622a8fc4be007c08d394449f2cf89f6da7

### Amount Breakdown
- **Total Amount**: 5 pyUSD (5,000,000 smallest units)
- **Cut (1%)**: 0.05 pyUSD (50,000 smallest units)
- **Net to Merchant**: 4.95 pyUSD (4,950,000 smallest units)

### Event Details
- **Event**: `PulledAndSplit`
- **Token**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9` (pyUSD)
- **Sender**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` (New owner)
- **Receiver**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (Merchant)
- **Amount**: 5,000,000 (5 pyUSD)
- **Cut**: 50,000 (0.05 pyUSD)
- **Relayer**: `0x483089BfAdF65a08F1be109b42A9aae8535B75ee` (Contract owner)

---

## Summary

✅ **Successfully completed gasless payment flow with new owner**

1. **Permit Signed**: New owner (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`) signed EIP-2612 permit for 5 pyUSD
2. **Transaction Executed**: Relayer (`0x483089BfAdF65a08F1be109b42A9aae8535B75ee`) paid gas and executed the transaction
3. **Funds Distributed**:
   - Merchant received: 4.95 pyUSD
   - Cut collector received: 0.05 pyUSD (1% fee)
4. **Transaction Confirmed**: Mined in block 9740307 on Sepolia testnet

### Key Differences from Previous Test
- **Owner Changed**: Previous owner was `0x483089BfAdF65a08F1be109b42A9aae8535B75ee`, new owner is `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Nonce**: New owner's nonce was 11 (indicating this was their 11th permit)
- **Cut Collector**: Same as new owner address (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`)

---

## Technical Notes

### Script Modifications
- Updated `signPermit_dual_fee.js` to use ES modules (import instead of require)
- Updated `relayer_send_dual_fee.js` to use ES modules
- Converted `hardhat.config.js` to `hardhat.config.cjs` for CommonJS compatibility

### Environment Variables Used
- `GASLESS_ADDRESS`: Gateway contract address
- `TOKEN_ADDRESS`: pyUSD token address
- `CUT_BPS`: Cut basis points (100 = 1%)
- `AMOUNT`: Payment amount in human-readable format
- `PRIVATE_KEY`: Owner's private key for permit signing
- `RELAYER_PRIVATE_KEY`: Relayer's private key for transaction execution
- `RECEIVER`: Merchant address receiving the payment

---

## Verification

To verify the transaction:
1. Visit Etherscan: https://sepolia.etherscan.io/tx/0xb120b8ecdec1fa06b9bcaa5e13cae3622a8fc4be007c08d394449f2cf89f6da7
2. Check token balances:
   - Merchant (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`) should have received 4.95 pyUSD
   - Cut collector (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`) should have received 0.05 pyUSD
   - Owner (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`) should have 5 pyUSD less in their balance

---

**Document Created**: 2025-01-30
**Test Network**: Sepolia Testnet
**Status**: ✅ Success

