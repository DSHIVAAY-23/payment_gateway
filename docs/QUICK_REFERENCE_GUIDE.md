# Quick Reference Guide - All Payment Flows

This guide provides a quick reference for all three payment flows: **pyUSD (EIP-2612)**, **USDT (Permit2)**, and **Solana**. Each section lists the required scripts, commands, and files.

---

## 🔄 Switching Between Flows

```bash
# Switch to pyUSD flow
source scripts/switch_env.sh pyusd

# Switch to USDT flow
source scripts/switch_env.sh usdt

# Switch to Solana flow
source scripts/switch_env.sh solana
```

---

## 💰 Flow 1: pyUSD (EIP-2612)

### **Environment File**
- `.env.pyusd` - Configuration file for pyUSD flow

### **Key Scripts**
1. **`scripts/signPermit_dual_fee.js`** - Signs EIP-2612 permit for pyUSD
2. **`scripts/relayer_send_dual_fee.js`** - Relayer executes the transaction

### **Commands**

#### Step 1: Switch to pyUSD Configuration
```bash
source scripts/switch_env.sh pyusd
```

#### Step 2: Sign Permit
```bash
node scripts/signPermit_dual_fee.js
```
**Output**: Creates `out/pyusd_permit_dual_fee.json`

#### Step 3: Execute Transaction (Relayer)
```bash
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

### **Key Files**
- **Contract**: `contracts/GaslessTokenGatewayDualFee.sol`
- **Permit Output**: `out/pyusd_permit_dual_fee.json`
- **Environment**: `.env.pyusd`

### **Environment Variables Used**
- `GASLESS_ADDRESS` - Gateway contract address
- `TOKEN_ADDRESS` - pyUSD token address (`0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`)
- `PRIVATE_KEY` - Owner's private key (signs permit)
- `RELAYER_PRIVATE_KEY` - Relayer's private key (pays gas)
- `RECEIVER` - Merchant address
- `CUT_COLLECTOR` - Cut fee collector address
- `CUT_BPS` - Cut fee in basis points (100 = 1%)
- `AMOUNT` - Payment amount
- `SEPOLIA_RPC` - Sepolia RPC endpoint

### **Deployment Script** (if needed)
```bash
npx hardhat run scripts/deployGaslessDualFee.js --network sepolia
```

---

## 💵 Flow 2: USDT (Permit2)

### **Environment File**
- `.env.usdt` - Configuration file for USDT Permit2 flow

### **Key Scripts**
1. **`scripts/sign_permit2_example.js`** - Signs Permit2 signature for USDT (⚠️ needs ES module conversion)
2. **`scripts/relayer_send_permit2_dual.js`** - Relayer executes the transaction
3. **`scripts/deploy_permit2_gateway.js`** - Deploys Permit2 gateway contract

### **Commands**

#### Step 1: Switch to USDT Configuration
```bash
source scripts/switch_env.sh usdt
```

#### Step 2: Deploy Gateway (if not deployed)
```bash
npx hardhat run scripts/deploy_permit2_gateway.js --network sepolia
```
**Note**: Update `GASLESS_ADDRESS` in `.env.usdt` with the deployed address.

#### Step 3: Sign Permit2
```bash
node scripts/sign_permit2_example.js
```
**Output**: Creates `out/permit2_usdt.json`

#### Step 4: Execute Transaction (Relayer)
```bash
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```

### **Key Files**
- **Contract**: `contracts/GaslessPermit2GatewayDualFee.sol`
- **Permit Output**: `out/permit2_usdt.json`
- **Environment**: `.env.usdt`

### **Environment Variables Used**
- `GASLESS_ADDRESS` - Permit2 gateway contract address
- `PERMIT2_ADDRESS` - Permit2 contract address (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)
- `TOKEN_ADDRESS` - USDT token address (`0xCd56D421E5E623eB12d74712b463E9A336B6f287`)
- `PRIVATE_KEY` - Owner's private key (signs permit)
- `RELAYER_PRIVATE_KEY` - Relayer's private key (pays gas)
- `RECEIVER` - Merchant address
- `CUT_COLLECTOR` - Cut fee collector address
- `CUT_BPS` - Cut fee in basis points (100 = 1%)
- `AMOUNT` - Payment amount
- `SEPOLIA_RPC` - Sepolia RPC endpoint

---

## ⚡ Flow 3: Solana

### **Environment File**
- `.env.solana` - Configuration file for Solana flow

### **Key Scripts**
1. **`scripts/build_partial_with_fee.js`** - Builds partial transaction (user signs)
2. **`scripts/relayer_validate_and_submit.js`** - Relayer validates and submits (with simulation)
3. **`scripts/reaysol.js`** - Simple relayer script (submits without validation)

### **Commands**

#### Step 1: Switch to Solana Configuration
```bash
source scripts/switch_env.sh solana
```

#### Step 2: Build Partial Transaction
```bash
node scripts/build_partial_with_fee.js <merchant_pubkey> <amount> <reference>
```
**Example**:
```bash
node scripts/build_partial_with_fee.js GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd 1.23 demo-order-001
```
**Output**: Creates `partial_tx.base64`

#### Step 3: Submit Transaction (Option A - With Validation)
```bash
node scripts/relayer_validate_and_submit.js <merchant_pubkey>
```

#### Step 3: Submit Transaction (Option B - Simple)
```bash
node scripts/reaysol.js
```

### **Key Files**
- **Partial Transaction**: `partial_tx.base64` - Base64 encoded partial transaction
- **Environment**: `.env.solana`
- **Keypairs**: 
  - `user_dev_keypair.json` - User keypair
  - `~/.config/solana/id.json` - Relayer keypair (default)
  - `fee_collector_keypair.json` - Fee collector keypair

### **Environment Variables Used**
- `SOLANA_URL` - Solana RPC endpoint (`https://api.devnet.solana.com`)
- `MINT_ADDRESS` - Token mint address
- `TOKEN_PROGRAM_ID` - Token program ID (legacy or Token-2022)
- `ASSOCIATED_TOKEN_PROGRAM_ID` - ATA program ID
- `USER_KEYPATH` - Path to user keypair
- `RELAYER_KEYPATH` - Path to relayer keypair
- `FEE_KEYPATH` - Path to fee collector keypair
- `USER_PUBKEY` - User's public key
- `FEE_COLLECTOR_PUBKEY` - Fee collector's public key
- `MERCHANT_PUBKEY` - Merchant's public key (can be passed as argument)

---

## 📋 Common Helper Scripts

### **Environment Management**
- **`scripts/create_env_files.sh`** - Creates all `.env.*` files
- **`scripts/switch_env.sh`** - Switches between environment configurations
- **`scripts/load_env.sh`** - Generic environment loader

### **Deployment Scripts**
- **`scripts/deployGaslessDualFee.js`** - Deploy pyUSD gateway
- **`scripts/deploy_permit2_gateway.js`** - Deploy USDT Permit2 gateway
- **`scripts/deploy_mock_usdt.js`** - Deploy mock USDT token (for testing)

### **Utility Scripts**
- **`scripts/update_cut_fee.js`** - Update cut fee on deployed gateway
- **`scripts/checkBalances.js`** - Check token balances
- **`scripts/verify_tx.js`** - Verify transaction on blockchain

---

## 🔑 Key Addresses Reference

### **pyUSD Flow**
- **Gateway**: `0xE43E22639a7acD0b08168Ef320ee3F46c534d783`
- **Token**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9` (pyUSD on Sepolia)

### **USDT Flow**
- **Gateway**: `0x8529e860693a813FbEF133465c79BcD64516ca47` (Permit2 Gateway)
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **Token**: `0xCd56D421E5E623eB12d74712b463E9A336B6f287` (MockUSDT on Sepolia)

### **Solana Flow**
- **Mint**: `8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr` (mockUSDT on devnet)
- **User**: `7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5`
- **Fee Collector**: `4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT`

---

## 📁 Output Files Location

All output files are stored in the `out/` directory:

- **pyUSD Permit**: `out/pyusd_permit_dual_fee.json`
- **USDT Permit2**: `out/permit2_usdt.json`
- **Solana Partial TX**: `partial_tx.base64` (in project root)

---

## 🚀 Quick Start Examples

### **Complete pyUSD Flow**
```bash
source scripts/switch_env.sh pyusd
node scripts/signPermit_dual_fee.js
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

### **Complete Solana Flow**
```bash
source scripts/switch_env.sh solana
node scripts/build_partial_with_fee.js GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd 1.23 test-001
node scripts/reaysol.js
```

### **Complete USDT Flow** (after deploying gateway)
```bash
source scripts/switch_env.sh usdt
node scripts/sign_permit2_example.js
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```

---

## 📚 Related Documentation

- **`docs/ENV_CONFIGURATION.md`** - Detailed environment configuration guide
- **`docs/PYUSD_FLOW_NEW_OWNER.md`** - Complete pyUSD flow example
- **`docs/SOLANA_DEVNET_MOCK_USDT.md`** - Solana setup guide
- **`docs/REFACTOR_SINGLE_CUT.md`** - Contract refactoring details
- **`docs/SEPOLIA_PERMIT2_RUNBOOK.md`** - Permit2 deployment and usage

---

## ⚠️ Important Notes

1. **Always switch environment** before running scripts: `source scripts/switch_env.sh <flow>`
2. **Private keys** are in `.env.*` files - never commit these files
3. **RPC endpoints** may need to be updated with your own API keys
4. **Solana blockhashes** expire quickly - rebuild partial transactions if they fail
5. **USDT Permit2 script** may need ES module conversion for newer Node.js versions

---

**Last Updated**: 2025-01-30

