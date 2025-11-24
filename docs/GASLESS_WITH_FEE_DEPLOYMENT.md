# Gasless Token Transfer Contracts - Sepolia Deployment

## Overview

This repository contains two gasless transfer contract implementations:

1. **GaslessTokenTransferWithFee** - Direct transfer model (sender → receiver/feeCollector)
2. **GaslessTokenGatewayDualFee** - Pull-then-split model (sender → contract → receiver/feeCollector/cutCollector)

---

## Contract 1: GaslessTokenTransferWithFee

### Deployment Details

Successfully deployed `GaslessTokenTransferWithFee.sol` to Sepolia testnet.

### Deployment Details

- **Contract**: `GaslessTokenTransferWithFee.sol`
- **Network**: Sepolia Testnet
- **Chain ID**: 11155111
- **Contract Address**: `0xa1bC72c8D67DD27795ffcF823930A97327b12414`
- **Owner**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Fee Collector**: `0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7` (Account 2)
- **Fee BPS**: 100 (1%)
- **Deployment Transaction**: https://sepolia.etherscan.io/address/0xa1bC72c8D67DD27795ffcF823930A97327b12414

### Test Transaction

- **Transaction Hash**: `0x6a43ff3fdc6cc357b35a7eb5a2b8601ae83bf6763633621a4f36acff0266b875`
- **Block**: 9593793
- **Etherscan**: https://sepolia.etherscan.io/tx/0x6a43ff3fdc6cc357b35a7eb5a2b8601ae83bf6763633621a4f36acff0266b875
- **Fee Collector**: `0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7` (receives 1% fee)

### Key Differences from GaslessTokenTransfer

| Feature | GaslessTokenTransfer | GaslessTokenTransferWithFee |
|---------|---------------------|----------------------------|
| **Fee Model** | Fixed fee amount | Percentage-based (BPS) |
| **Permit Value** | `amount + fee` | `amount` only |
| **Fee Recipient** | Relayer (`msg.sender`) | Configurable `feeCollector` |
| **Owner Control** | None | Can update fee params |
| **Use Case** | Simple relayer fee | Merchant payments with platform fee |

### Contract Functions

1. **`sendWithFee()`** - Main function for gasless transfers with fee deduction
   - User signs permit for `amount`
   - Contract calculates fee: `fee = (amount * feeBps) / 10000`
   - Transfers `net = amount - fee` to receiver
   - Transfers `fee` to fee collector

2. **`setFeeParams()`** - Owner-only function to update fee collector and BPS
   - Maximum fee: 10% (1000 BPS)

### Usage Example

```bash
# 1. Deploy
export FEE_COLLECTOR="0x..."
export FEE_BPS="100"  # 1%
npx hardhat run scripts/deployGaslessWithFee.js --network sepolia

# 2. Sign permit
export GASLESS_ADDRESS="0xa1bC72c8D67DD27795ffcF823930A97327b12414"
export AMOUNT="10"
export RECEIVER="0x..."
node scripts/signPermit_pyusd_for_fee.js

# 3. Relayer sends
export RELAYER_PRIVATE_KEY="0x..."
npx hardhat run scripts/relayer_send_with_fee.js --network sepolia
```

### Fee Calculation Example

For `amount = 100 PYUSD` and `feeBps = 100` (1%):
- Fee = `(100 * 100) / 10000 = 1 PYUSD`
- Net to receiver = `100 - 1 = 99 PYUSD`
- Fee to collector = `1 PYUSD`

### Files Created

- `contracts/GaslessTokenTransferWithFee.sol` - Contract source
- `scripts/deployGaslessWithFee.js` - Deployment script
- `scripts/signPermit_pyusd_for_fee.js` - Permit signing script
- `scripts/relayer_send_with_fee.js` - Relayer execution script
- `docs/README_DEPLOY_FEE.md` - Quick start guide

### Security Notes

- Owner can update fee parameters (up to 10% max)
- Fee collector cannot be zero address
- Amount must be greater than fee (net > 0)
- All transfers are atomic (all-or-nothing)

---

## Contract 2: GaslessTokenGatewayDualFee (Pull-Then-Split)

### Deployment Details

Successfully deployed `GaslessTokenGatewayDualFee.sol` to Sepolia testnet.

- **Contract**: `GaslessTokenGatewayDualFee.sol`
- **Network**: Sepolia Testnet
- **Chain ID**: 11155111
- **Contract Address**: `0xC2E1C8C560a85d8C21C51f37086E3656b69562a0`
- **Owner**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Fee Collector**: `0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7` (Account 2)
- **Cut Collector**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` (Account 1)
- **Fee BPS**: 50 (0.5%)
- **Cut BPS**: 100 (1%)
- **Deployment Transaction**: https://sepolia.etherscan.io/address/0xC2E1C8C560a85d8C21C51f37086E3656b69562a0

### Test Transactions

#### Transaction 1: Demo Token (Initial Test)
- **Transaction Hash**: `0x271b5c22960e02dca8d24e6102bd2454dc5547036e2c756fcb5f43c03d389333`
- **Block**: 9594248
- **Token**: DemoToken
- **Etherscan**: https://sepolia.etherscan.io/tx/0x271b5c22960e02dca8d24e6102bd2454dc5547036e2c756fcb5f43c03d389333

#### Transaction 2: pyUSD (Production Token)
- **Transaction Hash**: `0xb1b39ed210a39ba42b8194018b80428e5d374336f060bc66a6a2a6c0101e0d63`
- **Block**: 9594315
- **Token**: pyUSD (`0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`)
- **Amount**: 5.0 PYUSD
- **Fee**: 0.025 PYUSD (0.5%) → Fee Collector (`0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7`)
- **Cut**: 0.05 PYUSD (1%) → Cut Collector (`0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`)
- **Net to Merchant**: 4.925 PYUSD → Receiver (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`)
- **Etherscan**: https://sepolia.etherscan.io/tx/0xb1b39ed210a39ba42b8194018b80428e5d374336f060bc66a6a2a6c0101e0d63

### Pull-Then-Split Flow (Detailed)

#### **Phase 1: Off-Chain Permit Signing** (No Gas Required)

1. **User Reviews Payment Breakdown**
   ```
   Total Amount: 10 PYUSD
   Fee (0.5%): 0.05 PYUSD → Fee Collector
   Cut (1%): 0.1 PYUSD → Cut Collector
   Net to Merchant: 9.85 PYUSD
   ```

2. **Build EIP-712 Typed Data**
   ```javascript
   Domain: {
     name: "PayPal USD",
     version: "1",
     chainId: 11155111,
     verifyingContract: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"  // pyUSD token
   }
   
   Message: {
     owner: "0x329b06f125daff5bd16ccb7b3906227e50c18bb2",
     spender: "0xC2E1C8C560a85d8C21C51f37086E3656b69562a0",  // Gateway contract
     value: "5000000",  // 5 PYUSD in smallest units (6 decimals)
     nonce: "2",
     deadline: 1762713892
   }
   ```

3. **Sign Typed Data**
   - User signs with wallet (`_signTypedData`)
   - Signature split into `v, r, s`
   - Saved to `out/pyusd_permit_dual_fee.json`

#### **Phase 2: On-Chain Execution** (Relayer Pays Gas)

**Transaction**: `0x271b5c22960e02dca8d24e6102bd2454dc5547036e2c756fcb5f43c03d389333`

**Caller**: Relayer `0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7`

**Function Called**: `GaslessTokenGatewayDualFee.sendWithDualCollection()`

**Parameters** (pyUSD transaction):
```solidity
token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9  // pyUSD on Sepolia
permitToken: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9  // same (EIP-2612)
sender: 0x329b06f125daff5bd16ccb7b3906227e50c18bb2
receiver: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  // Merchant
amount: 5000000  // 5 PYUSD (6 decimals)
deadline: 1762713892
v: 27, r: 0xea87..., s: 0x2dae...
```

**Step-by-Step Execution** (inside `sendWithDualCollection()`):

1. **Execute Permit**
   ```solidity
   permitToken.permit(sender, address(this), amount, deadline, v, r, s)
   ```
   - Sets `allowance[sender][contract] = 5000000` (5 PYUSD)
   - Increments `nonces[sender]` from 2 to 3
   - Emits `Approval` event

2. **Pull Full Amount to Contract**
   ```solidity
   token.transferFrom(sender, address(this), amount)
   ```
   - **Transfer Event**: `Transfer(sender, contract, 5000000)`
   - Contract balance: `+5 PYUSD`
   - Sender balance: `-5 PYUSD`

3. **Calculate Fee and Cut**
   ```solidity
   fee = (5000000 * 50) / 10000 = 25000  // 0.025 PYUSD
   cut = (5000000 * 100) / 10000 = 50000  // 0.05 PYUSD
   net = 5000000 - 25000 - 50000 = 4925000  // 4.925 PYUSD
   ```

4. **Split to Merchant**
   ```solidity
   token.transfer(receiver, net)
   ```
   - **Transfer Event**: `Transfer(contract, merchant, 4925000)`
   - Merchant balance: `+4.925 PYUSD`
   - Contract balance: `-4.925 PYUSD` (remaining: 0.075 PYUSD)

5. **Send Fee to Fee Collector**
   ```solidity
   token.transfer(feeCollector, fee)
   ```
   - **Transfer Event**: `Transfer(contract, feeCollector, 25000)`
   - Fee Collector balance: `+0.025 PYUSD`
   - Contract balance: `-0.025 PYUSD` (remaining: 0.05 PYUSD)

6. **Send Cut to Cut Collector**
   ```solidity
   token.transfer(cutCollector, cut)
   ```
   - **Transfer Event**: `Transfer(contract, cutCollector, 50000)`
   - Cut Collector balance: `+0.05 PYUSD`
   - Contract balance: `-0.05 PYUSD` (remaining: 0)

7. **Emit PulledAndSplit Event**
   ```solidity
   emit PulledAndSplit(token, sender, receiver, amount, fee, cut, relayer)
   ```
   - Contains all amounts for easy tracking

### Transfer Event Sequence (pyUSD Example)

On Etherscan, you'll see these Transfer events in order for the pyUSD transaction:

1. `Transfer(sender → contract, 5000000)` - Pull 5 PYUSD
2. `Transfer(contract → merchant, 4925000)` - Net 4.925 PYUSD to merchant
3. `Transfer(contract → feeCollector, 25000)` - Fee 0.025 PYUSD
4. `Transfer(contract → cutCollector, 50000)` - Cut 0.05 PYUSD

**Transaction**: https://sepolia.etherscan.io/tx/0xb1b39ed210a39ba42b8194018b80428e5d374336f060bc66a6a2a6c0101e0d63

### Comparison: Direct Transfer vs Pull-Then-Split

| Aspect | Direct Transfer (GaslessTokenTransferWithFee) | Pull-Then-Split (GaslessTokenGatewayDualFee) |
|--------|----------------------------------------------|-----------------------------------------------|
| **Flow** | `sender → receiver`<br>`sender → feeCollector` | `sender → contract → receiver`<br>`sender → contract → feeCollector`<br>`sender → contract → cutCollector` |
| **Contract Balance** | Never holds tokens | Temporarily holds full amount |
| **Transfer Events** | 2 events (direct) | 4 events (via contract) |
| **Auditability** | Harder to track (direct transfers) | All flows through contract (visible in events) |
| **Extensibility** | Limited (no contract logic) | Can add logic before splitting (e.g., escrow, validation) |
| **Fees** | Single fee | Dual: fee + cut |
| **Gas Cost** | Lower (2 transfers) | Slightly higher (4 transfers) |
| **Use Case** | Simple fee collection | Merchant payments with platform fee + gateway cut |

### Why Pull-Then-Split is Better

1. **Auditability**: All funds flow through the contract, making it easy to track on Etherscan
2. **Extensibility**: Can add logic before splitting (e.g., escrow, validation, multi-sig)
3. **Transparency**: Clear separation of pull and split phases
4. **Future-Proof**: Easy to add new features (e.g., additional collectors, conditional splits)
5. **Event Tracking**: `PulledAndSplit` event contains all amounts in one place

### Contract Functions

1. **`sendWithDualCollection()`** - Main function for pull-then-split transfers
   - User signs permit for `amount`
   - Contract pulls full `amount` to itself
   - Calculates `fee = (amount * feeBps) / 10000` and `cut = (amount * cutBps) / 10000`
   - Transfers `net = amount - fee - cut` to merchant
   - Transfers `fee` to feeCollector and `cut` to cutCollector
   - Emits `PulledAndSplit` event

2. **`setParams()`** - Owner-only function to update collectors and BPS
   - Maximum total: 20% (2000 BPS each, 4000 BPS combined)

### Usage Example

```bash
# 1. Deploy
export FEE_COLLECTOR="0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7"
export CUT_COLLECTOR="0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2"
export FEE_BPS="50"  # 0.5%
export CUT_BPS="100"  # 1%
npx hardhat run scripts/deployGaslessDualFee.js --network sepolia

# 2. Sign permit
export GASLESS_ADDRESS="0xC2E1C8C560a85d8C21C51f37086E3656b69562a0"
export AMOUNT="10"
export RECEIVER="0x962BCade250166993e547DA3922E1B08B1309196"
export SENDER="0x483089BfAdF65a08F1be109b42A9aae8535B75ee"
node scripts/signPermit_dual_fee.js

# 3. Relayer sends
export RELAYER_PRIVATE_KEY="0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0"
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

### Fee Calculation Examples

**Example 1**: `amount = 5 PYUSD`, `feeBps = 50` (0.5%), `cutBps = 100` (1%)
- Fee = `(5 * 50) / 10000 = 0.025 PYUSD` → Fee Collector
- Cut = `(5 * 100) / 10000 = 0.05 PYUSD` → Cut Collector
- Net to merchant = `5 - 0.025 - 0.05 = 4.925 PYUSD`

**Example 2**: `amount = 100 PYUSD`, `feeBps = 50` (0.5%), `cutBps = 100` (1%)
- Fee = `(100 * 50) / 10000 = 0.5 PYUSD` → Fee Collector
- Cut = `(100 * 100) / 10000 = 1 PYUSD` → Cut Collector
- Net to merchant = `100 - 0.5 - 1 = 98.5 PYUSD`

### Token Information

- **Token**: pyUSD (PayPal USD)
- **Token Address**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9` (Sepolia)
- **Decimals**: 6
- **EIP-2612 Permit Support**: ✅ Yes
- **Token Explorer**: https://sepolia.etherscan.io/token/0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9

### Files Created

- `contracts/GaslessTokenGatewayDualFee.sol` - Contract source
- `scripts/deployGaslessDualFee.js` - Deployment script
- `scripts/signPermit_dual_fee.js` - Permit signing script (uses pyUSD by default)
- `scripts/relayer_send_dual_fee.js` - Relayer execution script

### Security Notes

- Owner can update fee parameters (up to 20% each, 40% combined max)
- Fee and cut collectors cannot be zero address
- Amount must be greater than fee + cut (net > 0)
- All transfers are atomic (all-or-nothing)
- Contract temporarily holds tokens (should be zero after each transaction)

