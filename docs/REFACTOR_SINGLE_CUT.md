# Refactoring Dual Fee Gateways to Single Cut Collection

## Overview

This document details the refactoring process to remove the `feeBps` and `feeCollector` variables from both the `GaslessTokenGatewayDualFee` (EIP-2612) and `GaslessPermit2GatewayDualFee` (Permit2) contracts, keeping only the `cutBps` and `cutCollector` for fee collection.

**Date**: December 2024  
**Contracts**: 
- `GaslessTokenGatewayDualFee.sol` (EIP-2612 Permit)
- `GaslessPermit2GatewayDualFee.sol` (Uniswap Permit2)
**Network**: Sepolia Testnet

---

## Changes Summary

### Contract Changes

#### GaslessTokenGatewayDualFee (EIP-2612)
- ✅ Removed `feeBps` variable
- ✅ Removed `feeCollector` variable
- ✅ Kept `cutBps` and `cutCollector` only
- ✅ Updated constructor signature
- ✅ Updated `setParams()` function
- ✅ Updated `sendWithDualCollection()` logic
- ✅ Updated events to remove fee references

#### GaslessPermit2GatewayDualFee (Permit2)
- ✅ Removed `feeBps` variable
- ✅ Removed `feeCollector` variable
- ✅ Kept `cutBps` and `cutCollector` only
- ✅ Updated constructor signature
- ✅ Updated `setParams()` function
- ✅ Updated `sendWithPermit2DualCollection()` logic
- ✅ Updated events to remove fee references

### Script Changes
- ✅ Updated `deployGaslessDualFee.js` - removed fee parameters
- ✅ Updated `deploy_permit2_gateway.js` - removed fee parameters
- ✅ Updated `relayer_send_dual_fee.js` - removed fee references
- ✅ Updated `signPermit_dual_fee.js` - removed fee calculations

---

## Contract Refactoring Details

### Before (Dual Fee System)

```solidity
contract GaslessTokenGatewayDualFee {
    address public owner;
    address public feeCollector;    // first collector (example: platform fee)
    address public cutCollector;    // second collector (example: gateway cut)
    uint16 public feeBps;           // basis points for fee (e.g. 50 = 0.5%)
    uint16 public cutBps;           // basis points for cut (e.g. 100 = 1%)

    constructor(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps) {
        // ...
    }

    function sendWithDualCollection(...) external {
        uint256 fee = (amount * uint256(feeBps)) / 10000;
        uint256 cut = (amount * uint256(cutBps)) / 10000;
        uint256 net = amount - fee - cut;
        // ...
    }
}
```

### After (Single Cut System)

```solidity
contract GaslessTokenGatewayDualFee {
    address public owner;
    address public cutCollector;    // collector for gateway cut
    uint16 public cutBps;           // basis points for cut (e.g. 100 = 1%)

    constructor(address _cutCollector, uint16 _cutBps) {
        require(_cutCollector != address(0), "INVALID_COLLECTOR");
        require(_cutBps <= 2000, "BPS_TOO_HIGH"); // safety cap 20%
        owner = msg.sender;
        cutCollector = _cutCollector;
        cutBps = _cutBps;
        emit ParamsUpdated(owner, cutCollector, cutBps);
    }

    function sendWithDualCollection(...) external {
        uint256 cut = (amount * uint256(cutBps)) / 10000;
        uint256 net = amount - cut;
        // ...
    }
}
```

### Key Changes in Contract

1. **Removed Variables**:
   - `address public feeCollector`
   - `uint16 public feeBps`

2. **Updated Constructor**:
   - Before: `constructor(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps)`
   - After: `constructor(address _cutCollector, uint16 _cutBps)`

3. **Updated `setParams()` Function**:
   - Before: `setParams(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps)`
   - After: `setParams(address _cutCollector, uint16 _cutBps)`

4. **Updated `sendWithDualCollection()` Logic**:
   - Removed fee calculation: `uint256 fee = (amount * uint256(feeBps)) / 10000;`
   - Removed fee transfer: `require(token.transfer(feeCollector, fee), "SEND_FEE_FAILED");`
   - Updated net calculation: `uint256 net = amount - cut;` (was `amount - fee - cut`)
   - Updated validation: `require(amount >= cut + 1, "AMOUNT_TOO_SMALL");` (was `amount >= fee + cut + 1`)

5. **Updated Events**:
   - `ParamsUpdated`: Removed `feeCollector` and `feeBps` parameters
   - `PulledAndSplit`: Removed `fee` parameter

---

## Script Updates

### 1. Deployment Script (`scripts/deployGaslessDualFee.js`)

**Before**:
```javascript
const FEE_COLLECTOR = process.env.FEE_COLLECTOR || '0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7';
const CUT_COLLECTOR = process.env.CUT_COLLECTOR || '0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2';
const FEE_BPS = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 50;
const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS) : 100;

const gateway = await Factory.deploy(FEE_COLLECTOR, CUT_COLLECTOR, FEE_BPS, CUT_BPS);
```

**After**:
```javascript
const CUT_COLLECTOR = process.env.CUT_COLLECTOR || '0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2';
const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS) : 100;

const gateway = await Factory.deploy(CUT_COLLECTOR, CUT_BPS);
```

### 2. Relayer Script (`scripts/relayer_send_dual_fee.js`)

**Removed**:
- `feeBps` retrieval and display
- `feeCollector` retrieval and display
- Fee-related console logs

**Updated Event Parsing**:
- Removed `event.args.fee` from `PulledAndSplit` event display

### 3. Permit Signing Script (`scripts/signPermit_dual_fee.js`)

**Removed**:
- `FEE_BPS` environment variable
- Fee calculation: `const fee = (amount.mul(FEE_BPS)).div(10000);`
- Fee display in amount breakdown
- `feeBps` from output JSON

**Updated**:
- Net calculation: `const net = amount.sub(cut);` (was `amount.sub(fee).sub(cut)`)
- Console output to show only cut and net

---

## Deployment Process

### Step 1: Compile Contract

```bash
cd /data/payment_gateway
npx hardhat compile
```

**Result**:
```
Compiled 1 Solidity file successfully (evm target: paris).
```

### Step 2: Deploy to Sepolia

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

### Amount Breakdown

- **Total Amount**: 5.0 PYUSD (5,000,000 with 6 decimals)
- **Cut (1%)**: 0.05 PYUSD (50,000) → Cut Collector (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`)
- **Net to Merchant**: 4.95 PYUSD (4,950,000) → Receiver (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`)

### Verification

✅ **Transaction Successful**: All transfers executed correctly  
✅ **Cut Calculation**: 1% of 5 PYUSD = 0.05 PYUSD  
✅ **Net Calculation**: 5 PYUSD - 0.05 PYUSD = 4.95 PYUSD  
✅ **Event Emitted**: `PulledAndSplit` event with correct parameters

---

## Comparison: Before vs After

### Fee Structure

| Aspect | Before (Dual Fee) | After (Single Cut) |
|--------|-------------------|-------------------|
| **Fee Collection** | Fee (0.5%) + Cut (1%) | Cut (1%) only |
| **Collectors** | 2 collectors | 1 collector |
| **Total Deduction** | 1.5% | 1% |
| **Net to Merchant** | 98.5% | 99% |

### Example: 5 PYUSD Payment

**Before**:
- Fee (0.5%): 0.025 PYUSD → Fee Collector
- Cut (1%): 0.05 PYUSD → Cut Collector
- Net: 4.925 PYUSD → Merchant

**After**:
- Cut (1%): 0.05 PYUSD → Cut Collector
- Net: 4.95 PYUSD → Merchant

---

## Updated Contract Interface

### Constructor

```solidity
constructor(address _cutCollector, uint16 _cutBps)
```

**Parameters**:
- `_cutCollector`: Address that will receive the cut
- `_cutBps`: Basis points for cut (e.g., 100 = 1%, max 2000 = 20%)

### setParams()

```solidity
function setParams(address _cutCollector, uint16 _cutBps) external onlyOwner
```

**Parameters**:
- `_cutCollector`: New cut collector address
- `_cutBps`: New cut basis points (max 2000)

### sendWithDualCollection()

```solidity
function sendWithDualCollection(
    IERC20 token,
    IERC20PermitLike permitToken,
    address sender,
    address receiver,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external
```

**Flow**:
1. Execute permit to authorize contract to spend `amount`
2. Pull full `amount` from sender to contract
3. Calculate `cut = (amount * cutBps) / 10000`
4. Calculate `net = amount - cut`
5. Transfer `net` to receiver (merchant)
6. Transfer `cut` to cutCollector
7. Emit `PulledAndSplit` event

---

## Events

### ParamsUpdated

```solidity
event ParamsUpdated(address indexed owner, address cutCollector, uint16 cutBps);
```

### PulledAndSplit

```solidity
event PulledAndSplit(
    address indexed token,
    address indexed sender,
    address indexed receiver,
    uint256 amount,
    uint256 cut,
    address relayer
);
```

**Note**: The `fee` parameter has been removed from this event.

---

## Usage Instructions

### 1. Deploy Contract

```bash
export CUT_COLLECTOR="0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2"
export CUT_BPS="100"  # 1%
npx hardhat run scripts/deployGaslessDualFee.js --network sepolia
```

### 2. Sign Permit

```bash
export GASLESS_ADDRESS="<deployed_contract_address>"
export TOKEN_ADDRESS="0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"  # pyUSD
export CUT_BPS="100"
export AMOUNT="5"
export RECEIVER="<merchant_address>"
node scripts/signPermit_dual_fee.js
```

### 3. Execute Transaction

```bash
export GASLESS_ADDRESS="<deployed_contract_address>"
export RELAYER_PRIVATE_KEY="<relayer_private_key>"
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

---

## Files Modified

### EIP-2612 Gateway (GaslessTokenGatewayDualFee)
1. ✅ `contracts/GaslessTokenGatewayDualFee.sol` - Contract refactored
2. ✅ `scripts/deployGaslessDualFee.js` - Deployment script updated
3. ✅ `scripts/relayer_send_dual_fee.js` - Relayer script updated
4. ✅ `scripts/signPermit_dual_fee.js` - Permit signing script updated

### Permit2 Gateway (GaslessPermit2GatewayDualFee)
5. ✅ `contracts/GaslessPermit2GatewayDualFee.sol` - Contract refactored
6. ✅ `scripts/deploy_permit2_gateway.js` - Deployment script updated
7. ✅ `scripts/relayer_send_permit2_dual.js` - No changes needed (already compatible)

---

## Security Considerations

- ✅ Cut BPS is capped at 2000 (20%) to prevent excessive fees
- ✅ Cut collector cannot be zero address
- ✅ Amount validation ensures at least 1 unit goes to receiver
- ✅ All transfers are atomic (all-or-nothing)
- ✅ Contract balance should be zero after each transaction

---

---

## Permit2 Gateway Refactoring

### GaslessPermit2GatewayDualFee Contract Changes

Similar refactoring was applied to the Permit2-based gateway contract.

#### Before (Dual Fee System)

```solidity
contract GaslessPermit2GatewayDualFee {
    address public feeCollector;
    address public cutCollector;
    uint16 public feeBps; // e.g. 50 = 0.5%
    uint16 public cutBps; // e.g. 100 = 1%

    constructor(
        address permit2Address,
        address _feeCollector,
        address _cutCollector,
        uint16 _feeBps,
        uint16 _cutBps
    ) {
        // ...
    }

    function sendWithPermit2DualCollection(...) external {
        uint256 fee = (amount * uint256(feeBps)) / 10000;
        uint256 cut = (amount * uint256(cutBps)) / 10000;
        uint256 net = amount - fee - cut;
        // ...
    }
}
```

#### After (Single Cut System)

```solidity
contract GaslessPermit2GatewayDualFee {
    address public cutCollector;
    uint16 public cutBps; // e.g. 100 = 1%

    constructor(
        address permit2Address,
        address _cutCollector,
        uint16 _cutBps
    ) {
        // ...
    }

    function sendWithPermit2DualCollection(...) external {
        uint256 cut = (amount * uint256(cutBps)) / 10000;
        uint256 net = amount - cut;
        // ...
    }
}
```

### Permit2 Deployment

**Deployment Command**:
```bash
export PERMIT2_ADDRESS="0x000000000022D473030F116dDEE9F6B43aC78BA3"
export CUT_COLLECTOR="0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2"
export CUT_BPS="100"
npx hardhat run scripts/deploy_permit2_gateway.js --network sepolia
```

**Deployment Output**:
```
Deploying GaslessPermit2GatewayDualFee with:
  PERMIT2_ADDRESS: 0x000000000022D473030F116dDEE9F6B43aC78BA3
  CUT_COLLECTOR  : 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
  CUT_BPS        : 100

✅ Deployed GaslessPermit2GatewayDualFee at: 0xe24d78E218E89Af237Df8CB4c36444D654d79678
Owner: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Cut Collector: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Cut BPS: 100
Etherscan: https://sepolia.etherscan.io/address/0xe24d78E218E89Af237Df8CB4c36444D654d79678
```

**Deployed Contract Address**: `0xe24d78E218E89Af237Df8CB4c36444D654d79678`  
**Etherscan**: https://sepolia.etherscan.io/address/0xe24d78E218E89Af237Df8CB4c36444D654d79678

### Permit2 Script Updates

**Updated Files**:
- ✅ `scripts/deploy_permit2_gateway.js` - Removed `FEE_COLLECTOR` and `FEE_BPS` parameters
- ✅ `scripts/relayer_send_permit2_dual.js` - No changes needed (doesn't reference fee variables)

---

## Summary

The refactoring successfully removed the dual fee system from both gateway contracts and simplified them to collect only a single cut. Both contracts have been:

### EIP-2612 Gateway (GaslessTokenGatewayDualFee)
- ✅ Compiled successfully
- ✅ Deployed to Sepolia testnet
- ✅ Tested with pyUSD token
- ✅ Verified transaction on Etherscan

**Contract Address**: `0xE43E22639a7acD0b08168Ef320ee3F46c534d783`  
**Test Transaction**: `0x2a8e8a178974a7ee6491a26c95043ebe41b11ac2b3fc57d06a5ef2548c37c616`

### Permit2 Gateway (GaslessPermit2GatewayDualFee)
- ✅ Compiled successfully
- ✅ Deployed to Sepolia testnet
- ✅ Tested with mockUSDT token
- ✅ Verified transaction on Etherscan

**Contract Address**: `0xe24d78E218E89Af237Df8CB4c36444D654d79678`  
**Test Transaction**: `0x5292fd08c559984fbd6fba6daed402bd8b37db1e846c0e874d0d31d9e1df334d`

#### Permit2 Testing Process

**Step 1: Approve Permit2**
```bash
export USDT_ADDRESS="0xCd56D421E5E623eB12d74712b463E9A336B6f287"
npx hardhat run scripts/approve_permit2.js --network sepolia
```

**Result**:
```
Sending approve(token=0xCd56D421E5E623eB12d74712b463E9A336B6f287 spender=0x000000000022D473030F116dDEE9F6B43aC78BA3 amount=MaxUint256) from 0x483089BfAdF65a08F1be109b42A9aae8535B75ee ...
tx hash: 0xa9a4e28accb316fbd7e2b644902d56ceff3b7a978eb8ce723d4a073d14146e6f
mined in block 9703968
allowance set: 115792089237316195423570985008687907853269984665640564039457584007913129639935
```

**Step 2: Sign Permit2 Permit**
```bash
export GASLESS_ADDRESS="0xe24d78E218E89Af237Df8CB4c36444D654d79678"
export USDT_ADDRESS="0xCd56D421E5E623eB12d74712b463E9A336B6f287"
export PERMIT2_ADDRESS="0x000000000022D473030F116dDEE9F6B43aC78BA3"
export AMOUNT="5"
export RECEIVER="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
node scripts/sign_permit2_example.js
```

**Step 3: Execute Transaction via Relayer**
```bash
export GASLESS_ADDRESS="0xe24d78E218E89Af237Df8CB4c36444D654d79678"
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```

**Transaction Results**:
- **Transaction Hash**: `0x5292fd08c559984fbd6fba6daed402bd8b37db1e846c0e874d0d31d9e1df334d`
- **Block Number**: 9703977
- **Token**: mockUSDT (`0xCd56D421E5E623eB12d74712b463E9A336B6f287`)
- **Amount**: 5.0 mUSDT (5,000,000 with 6 decimals)
- **Cut (1%)**: 0.05 mUSDT (50,000) → Cut Collector
- **Net to Merchant**: 4.95 mUSDT (4,950,000) → Receiver
- **Etherscan**: https://sepolia.etherscan.io/tx/0x5292fd08c559984fbd6fba6daed402bd8b37db1e846c0e874d0d31d9e1df334d

**Event Details**:
```
PulledAndSplit Event:
Token: 0xCd56D421E5E623eB12d74712b463E9A336B6f287
Owner: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Receiver: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Amount: 5000000
Cut: 50000
Relayer: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
```

Both contracts now operate with a simpler fee structure, collecting only the gateway cut (1% by default) and forwarding the remaining amount to the merchant.

