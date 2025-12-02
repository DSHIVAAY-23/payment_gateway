
### Step 1: Deploy to Sepolia

```bash
export CUT_COLLECTOR="0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2"
export CUT_BPS="100"
npx hardhat run scripts/deployGaslessDualFee.js --network sepolia
```

**Deployment Output**:
```
Deploying GaslessTokenGatewayDualFee with:
  Cut Collector: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
  Cut BPS: 100 (1%)

✅ Deployed gateway: 0xE43E22639a7acD0b08168Ef320ee3F46c534d783

--- Deployment Summary ---
Contract: GaslessTokenGatewayDualFee
Address: 0xE43E22639a7acD0b08168Ef320ee3F46c534d783
Owner: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Cut Collector: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Cut BPS: 100

--- Next Steps ---
export GASLESS_ADDRESS=0xE43E22639a7acD0b08168Ef320ee3F46c534d783
Etherscan: https://sepolia.etherscan.io/address/0xE43E22639a7acD0b08168Ef320ee3F46c534d783
```

**Deployed Contract Address**: `0xE43E22639a7acD0b08168Ef320ee3F46c534d783`  
**Etherscan**: https://sepolia.etherscan.io/address/0xE43E22639a7acD0b08168Ef320ee3F46c534d783

---

## Testing Process

### Step 1: Sign Permit for pyUSD

```bash
export GASLESS_ADDRESS="0xE43E22639a7acD0b08168Ef320ee3F46c534d783"
export TOKEN_ADDRESS="0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
export CUT_BPS="100"
export AMOUNT="5"
node scripts/signPermit_dual_fee.js
```

**Permit Signing Output**:
```
=== Permit Signing for Gateway ===
Token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9 (PayPal USD)
Gateway: 0xE43E22639a7acD0b08168Ef320ee3F46c534d783
Owner: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Receiver (Merchant): 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2

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
  owner: '0x483089BfAdF65a08F1be109b42A9aae8535B75ee',
  spender: '0xE43E22639a7acD0b08168Ef320ee3F46c534d783',
  value: '5000000',
  nonce: '1',
  deadline: 1764079069
}

✅ Wrote permit to /data/payment_gateway/out/pyusd_permit_dual_fee.json
Signature v, r, s: 28 0xae70a233cb5509e271319332a8ff5b86b7ff3c9824732ffaff35a58a32b63a90 0x4480409de390d078d755076c0df1d27a23524b41ceb68d2cd15087a4a548bb06
```

**Permit File**: `/data/payment_gateway/out/pyusd_permit_dual_fee.json`

### Step 2: Execute Transaction via Relayer

```bash
export GASLESS_ADDRESS="0xE43E22639a7acD0b08168Ef320ee3F46c534d783"
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

**Transaction Output**:
```
Using separate relayer account from RELAYER_PRIVATE_KEY
Relayer address: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Relayer ETH balance: 0.745104445254498547 ETH

--- Transaction Details ---
Token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
Sender: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Receiver (Merchant): 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Amount: 5000000
Cut BPS: 100
Cut Collector: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Deadline: 1764079069

Calling gateway.sendWithDualCollection...
Transaction sent: 0x2a8e8a178974a7ee6491a26c95043ebe41b11ac2b3fc57d06a5ef2548c37c616
Waiting for confirmation...
✅ Mined in block 9703897
Etherscan: https://sepolia.etherscan.io/tx/0x2a8e8a178974a7ee6491a26c95043ebe41b11ac2b3fc57d06a5ef2548c37c616

--- PulledAndSplit Event ---
Token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
Sender: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Receiver: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Amount: 5000000
Cut: 50000
Relayer: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
```

---

## Transaction Results

### Test Transaction Details

- **Transaction Hash**: `0x2a8e8a178974a7ee6491a26c95043ebe41b11ac2b3fc57d06a5ef2548c37c616`
- **Block Number**: 9703897
- **Network**: Sepolia Testnet
- **Token**: pyUSD (`0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`)
- **Etherscan**: https://sepolia.etherscan.io/tx/0x2a8e8a178974a7ee6491a26c95043ebe41b11ac2b3fc57d06a5ef2548c37c616