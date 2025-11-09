# pyUSD Gasless Transaction Results

## Transaction Summary

Successfully executed a gasless transaction using pyUSD on Sepolia testnet.

### Details

- **Token**: pyUSD (PayPal USD)
- **Token Address**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
- **Owner Address**: `0x329b06f125daff5bd16ccb7b3906227e50c18bb2`
- **Gasless Contract**: `0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E`
- **Receiver**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
- **Amount**: 10.0 PYUSD
- **Fee**: 0.1 PYUSD
- **Transaction Hash**: `0x7a137e1afdc76c5f6fe1f657602547c42a9e15b13eba71f603eb49367e39db0a`
- **Block Number**: 9592977

### Results

✅ **Receiver received**: +10.0 PYUSD  
✅ **Relayer received**: +0.1 PYUSD (fee)  
✅ **Transaction confirmed** on Sepolia

### Etherscan Link

https://sepolia.etherscan.io/tx/0x7a137e1afdc76c5f6fe1f657602547c42a9e15b13eba71f603eb49367e39db0a

---

## Contract Architecture & Purpose

### 1. pyUSD Token Contract (`0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`)

**Purpose**: The ERC-20 token contract that holds user balances and implements EIP-2612 permit functionality.

**Key Functions Used**:
- `name()` → Returns "PayPal USD"
- `symbol()` → Returns "PYUSD"
- `decimals()` → Returns `6`
- `balanceOf(address)` → Returns token balance for an address
- `nonces(address)` → Returns the current nonce for permit replay protection
- `DOMAIN_SEPARATOR()` → Returns the EIP-712 domain separator for signature verification
- `permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)` → Sets allowance via signature (EIP-261dracosahil1792)
- `transferFrom(address from, address to, uint256 value)` → Transfers tokens from one address to another

**Role in Gasless Flow**:
- Stores user token balances
- Validates EIP-712 signatures and sets allowances via `permit()`
- Executes token transfers via `transferFrom()`

---

### 2. GaslessTokenTransfer Contract (`0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E`)

**Purpose**: The relayer gateway contract that orchestrates the gasless transfer by calling `permit()` and then executing transfers.

**Key Function**:
```solidity
function send(
    IERC20PermitLike token,      // Token contract address
    address sender,              // Token owner who signed the permit
    address receiver,            // Recipient of the transfer
    uint256 amount,              // Amount to send to receiver
    uint256 fee,                 // Fee paid to relayer
    uint256 deadline,            // Permit expiration timestamp
    uint8 v,                     // ECDSA signature component
    bytes32 r,                   // ECDSA signature component
    bytes32 s                    // ECDSA signature component
) external
```

**Role in Gasless Flow**:
- Receives the signed permit from the relayer
- Calls `token.permit()` to set allowance atomically
- Executes two `transferFrom()` calls: one to receiver, one to relayer (fee)
- Ensures atomic execution (all-or-nothing)

**Why This Contract Exists**:
- Without this contract, the relayer would need to:
  1. Call `token.permit()` (sets allowance)
  2. Call `token.transferFrom()` for receiver
  3. Call `token.transferFrom()` for fee
- This requires 3 separate transactions. The gateway contract combines them into 1 atomic transaction.

---

## Detailed Function Call Flow

### Step-by-Step Execution

#### **Phase 1: Off-Chain Permit Signing** (No Gas Required)

1. **Read Token Metadata**
   ```
   Call: pyUSD.name()
   Result: "PayPal USD"
   
   Call: pyUSD.decimals()
   Result: 6
   
   Call: pyUSD.nonces(0x329b06f125daff5bd16ccb7b3906227e50c18bb2)
   Result: 0
   ```

2. **Build EIP-712 Typed Data**
   ```javascript
   Domain: {
     name: "PayPal USD",
     version: "1",
     chainId: 11155111,  // Sepolia
     verifyingContract: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
   }
   
   Types: {
     Permit: [
       { name: "owner", type: "address" },
       { name: "spender", type: "address" },
       { name: "value", type: "uint256" },
       { name: "nonce", type: "uint256" },
       { name: "deadline", type: "uint256" }
     ]
   }
   
   Message: {
     owner: "0x329b06f125daff5bd16ccb7b3906227e50c18bb2",
     spender: "0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E",  // Gasless contract
     value: "10100000",  // 10.1 PYUSD (10.0 + 0.1 fee) in smallest units
     nonce: "0",
     deadline: 1762696683  // Unix timestamp (1 hour from now)
   }
   ```

3. **Sign Typed Data**
   ```
   Method: wallet._signTypedData(domain, types, message)
   Result: Signature string
   
   Split signature into v, r, s:
   v = 28
   r = 0x84036487090639ada53714bfff2f065f50f9bafb936b1f7f7d76bbe10bd520ab
   s = 0x3c81f29bdc9fbe34c0ed77e33b252fd4726cb9c0949d29abcf90789afa9c430f
   ```

4. **Save Permit Data**
   - Written to `out/pyusd_permit.json`
   - Contains all permit parameters for relayer to use

---

#### **Phase 2: On-Chain Execution** (Relayer Pays Gas)

**Transaction**: `0x7a137e1afdc76c5f6fe1f657602547c42a9e15b13eba71f603eb49367e39db0a`

**Caller**: Relayer address `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` (has ETH for gas)

**Function Called**: `GaslessTokenTransfer.send()`

**Parameters Passed**:
```solidity
token: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9  // pyUSD
sender: 0x329b06f125daff5bd16ccb7b3906227e50c18bb2  // Owner
receiver: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
amount: 10000000  // 10.0 PYUSD (6 decimals)
fee: 100000       // 0.1 PYUSD (6 decimals)
deadline: 1762696683
v: 28
r: 0x84036487090639ada53714bfff2f065f50f9bafb936b1f7f7d76bbe10bd520ab
s: 0x3c81f29bdc9fbe34c0ed77e33b252fd4726cb9c0949d29abcf90789afa9c430f
```

**Internal Execution** (inside `GaslessTokenTransfer.send()`):

1. **Call `pyUSD.permit()`**
   ```solidity
   pyUSD.permit(
     owner: 0x329b06f125daff5bd16ccb7b3906227e50c18bb2,
     spender: 0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E,  // Gasless contract itself
     value: 10100000,  // 10.1 PYUSD total
     deadline: 1762696683,
     v: 28,
     r: 0x84036487090639ada53714bfff2f065f50f9bafb936b1f7f7d76bbe10bd520ab,
     s: 0x3c81f29bdc9fbe34c0ed77e33b252fd4726cb9c0949d29abcf90789afa9c430f
   )
   ```
   
   **What happens inside `pyUSD.permit()`**:
   - ✅ Checks `block.timestamp <= deadline` (deadline validation)
   - ✅ Recomputes EIP-712 domain separator
   - ✅ Builds signature digest: `keccak256("\x19\x01" || DOMAIN_SEPARATOR || PermitHash)`
   - ✅ Recovers signer address using `ecrecover(digest, v, r, s)`
   - ✅ Verifies recovered address matches `owner`
   - ✅ Increments `nonces[owner]` from 0 to 1 (replay protection)
   - ✅ Sets `allowance[owner][spender] = 10100000`
   - ✅ Emits `Approval(owner, spender, 10100000)`

2. **Call `pyUSD.transferFrom()` for Receiver**
   ```solidity
   pyUSD.transferFrom(
     from: 0x329b06f125daff5bd16ccb7b3906227e50c18bb2,  // Owner
     to: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,    // Receiver
     value: 10000000  // 10.0 PYUSD
   )
   ```
   
   **What happens**:
   - ✅ Checks `allowance[owner][gaslessContract] >= 10000000` (✅ 10100000 >= 10000000)
   - ✅ Decrements allowance: `10100000 - 10000000 = 100000` (remaining for fee)
   - ✅ Decrements owner balance: `balanceOf[owner] -= 10000000`
   - ✅ Increments receiver balance: `balanceOf[receiver] += 10000000`
   - ✅ Emits `Transfer(owner, receiver, 10000000)`

3. **Call `pyUSD.transferFrom()` for Relayer Fee**
   ```solidity
   pyUSD.transferFrom(
     from: 0x329b06f125daff5bd16ccb7b3906227e50c18bb2,  // Owner
     to: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2,    // Relayer (msg.sender)
     value: 100000  // 0.1 PYUSD
   )
   ```
   
   **What happens**:
   - ✅ Checks `allowance[owner][gaslessContract] >= 100000` (✅ 100000 >= 100000)
   - ✅ Decrements allowance: `100000 - 100000 = 0` (fully consumed)
   - ✅ Decrements owner balance: `balanceOf[owner] -= 100000`
   - ✅ Increments relayer balance: `balanceOf[relayer] += 100000`
   - ✅ Emits `Transfer(owner, relayer, 100000)`

---

## State Changes Summary

### Before Transaction

| Address | Balance | Allowance |
|---------|---------|-----------|
| Owner (`0x329b...bb2`) | 100.0 PYUSD | 0 PYUSD |
| Receiver (`0x3C44...3BC`) | 125.0 PYUSD | - |
| Relayer (`0x329b...bb2`) | 80.0 PYUSD | - |
| Gasless Contract (`0xA6Ed...14E`) | 0 PYUSD | - |

### After Transaction

| Address | Balance | Allowance | Change |
|---------|---------|-----------|--------|
| Owner (`0x329b...bb2`) | 89.9 PYUSD | 0 PYUSD | -10.1 PYUSD |
| Receiver (`0x3C44...3BC`) | 135.0 PYUSD | - | +10.0 PYUSD ✅ |
| Relayer (`0x329b...bb2`) | 90.0 PYUSD | - | +0.1 PYUSD ✅ |
| Gasless Contract (`0xA6Ed...14E`) | 0 PYUSD | - | - |

**Note**: The allowance was set to 10.1 PYUSD and fully consumed (10.0 to receiver + 0.1 to relayer).

---

## Token Information

- **Name**: PayPal USD
- **Symbol**: PYUSD
- **Decimals**: 6
- **EIP-2612 Permit Support**: ✅ Yes
- **Owner Balance**: 100.0 PYUSD (before transaction) → 89.9 PYUSD (after)

---

## Permit Details

The permit was signed with:
- **Domain**: PayPal USD, version 1, chainId 11155111
- **Nonce**: 0 (incremented to 1 after use)
- **Deadline**: Unix timestamp 1762696683 (valid for 1 hour)
- **Value**: 10,100,000 (10.0 + 0.1 PYUSD in smallest units)
- **Spender**: GaslessTokenTransfer contract address

---

## Script Used

The transaction was executed using:
```bash
npx hardhat run scripts/gaslessPyUSD.js --network sepolia
```

With environment variables:
- `SEPOLIA_RPC`: Sepolia RPC endpoint
- `PRIVATE_KEY`: Owner's private key (for signing permit)
- `GASLESS_ADDRESS`: Deployed GaslessTokenTransfer contract

---

## Why This Architecture?

### Problem Solved
Users want to send tokens without holding ETH for gas fees. Traditional ERC-20 transfers require:
1. User approves spender (costs gas)
2. Spender calls transferFrom (costs gas)

### Solution
1. **User signs off-chain permit** (no gas, no ETH needed)
2. **Relayer submits single transaction** that:
   - Executes permit (sets allowance)
   - Transfers to receiver
   - Transfers fee to relayer
3. **All in one atomic transaction** (all-or-nothing)

### Benefits
- ✅ User doesn't need ETH
- ✅ User doesn't pay gas fees
- ✅ Atomic execution (no partial states)
- ✅ Relayer compensated via token fee
- ✅ Works with any EIP-2612 compatible token (USDC, DAI, pyUSD, etc.)

---

## Security Features

1. **Replay Protection**: Nonce increments on each permit use
2. **Deadline Protection**: Permits expire after deadline timestamp
3. **Signature Verification**: EIP-712 typed data ensures signature can't be reused for different purposes
4. **Atomic Execution**: All operations succeed or fail together
5. **Allowance Management**: Permit sets exact amount needed, consumed immediately

---

## Files Generated

- `out/pyusd_permit.json` - Contains the signed permit data (v, r, s, amounts, etc.)

---

## Contract Addresses Reference

| Contract | Address | Purpose |
|----------|---------|---------|
| pyUSD Token | `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9` | ERC-20 token with EIP-2612 permit |
| GaslessTokenTransfer | `0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E` | Relayer gateway contract |
| Owner | `0x329b06f125daff5bd16ccb7b3906227e50c18bb2` | Token holder who signs permit |
| Receiver | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Recipient of tokens |
| Relayer | `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` | Pays gas, receives fee |

