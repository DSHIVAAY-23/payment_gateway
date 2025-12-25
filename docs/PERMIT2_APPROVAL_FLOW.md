# Permit2 Approval Flow - User Guide

## Understanding Permit2 Approval

### Do You Need Approval Every Time?

**Short Answer: No!** Approval is typically a **one-time operation** per token.

### How Approval Works

1. **One-Time Approval**: When you approve Permit2 with `MaxUint256`, it grants unlimited allowance that lasts indefinitely (unless revoked).

2. **Why Approval is Needed**: Permit2 needs permission to transfer tokens on your behalf. This is similar to regular ERC20 `approve()`, but you're approving Permit2 instead of the gateway directly.

3. **Approval vs Permit**: 
   - **Approval** = One-time, grants Permit2 permission to spend tokens
   - **Permit** = Per-transaction, authorizes a specific transfer amount

### Approval Flow Diagram

```
User Wallet
    │
    ├─ Step 1: Approve Permit2 (ONE-TIME)
    │   └─ token.approve(PERMIT2, MaxUint256)
    │   └─ Result: Permit2 can now transfer tokens
    │
    ├─ Step 2: Sign Permit (EACH TRANSACTION)
    │   └─ User signs EIP-712 permit off-chain
    │   └─ No gas cost for user
    │
    └─ Step 3: Relayer Submits (EACH TRANSACTION)
        └─ Relayer pays gas, submits permit
        └─ Permit2 transfers tokens using existing approval
```

## Checking Allowance

### Before Signing a Permit

Always check if Permit2 has sufficient allowance before signing:

```bash
# Check current allowance
node scripts/check_permit2_allowance.js

# Or with specific amount requirement
AMOUNT=1 node scripts/check_permit2_allowance.js
```

**Output Example:**
```
=== Permit2 Allowance Check ===
Token: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
Owner: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3
Balance: 5.0 tokens
Allowance: 115792089237316195423570985008687907853269984665640564039457584007913129639935 tokens

Required Amount: 1 tokens
Required (wei): 1000000
✅ Allowance is sufficient!
```

### Automatic Check in Sign Script

The `sign_permit2_example.js` script now automatically checks allowance before signing:

```bash
node scripts/sign_permit2_example.js
```

If allowance is insufficient, it will:
- Show current vs required allowance
- Provide instructions to fix
- Exit with error (prevents signing invalid permits)

## User Flow Implementation

### Frontend Integration Pattern

In a production frontend, handle approval like this:

```javascript
// 1. Check allowance before signing
async function checkAndApproveIfNeeded(tokenAddress, ownerAddress, amount) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  
  const decimals = await token.decimals();
  const amountBN = ethers.utils.parseUnits(amount, decimals);
  const allowance = await token.allowance(ownerAddress, permit2Address);
  
  if (allowance.lt(amountBN)) {
    // Show approval prompt to user
    const approveTx = await token.connect(signer).approve(
      permit2Address,
      ethers.constants.MaxUint256 // Approve unlimited (one-time)
    );
    await approveTx.wait();
    console.log("✅ Permit2 approved!");
  }
  
  // Now proceed with permit signing
  return signPermit(tokenAddress, amount, receiver);
}
```

### Step-by-Step User Experience

1. **First Time User**:
   ```
   User clicks "Pay with USDC"
   → Frontend checks allowance
   → Insufficient → Show "Approve Permit2" button
   → User approves (one-time, pays gas)
   → Proceed to permit signing (gasless)
   ```

2. **Returning User**:
   ```
   User clicks "Pay with USDC"
   → Frontend checks allowance
   → Sufficient → Directly sign permit (gasless)
   → Relayer submits transaction
   ```

## Commands Reference

### Check Allowance
```bash
# Basic check
node scripts/check_permit2_allowance.js

# With specific amount
AMOUNT=1 TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
  node scripts/check_permit2_allowance.js
```

### Approve Permit2
```bash
# Approve for current token in .env
npx hardhat run scripts/approve_permit2.js --network sepolia

# Approve for specific token
TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
  npx hardhat run scripts/approve_permit2.js --network sepolia
```

### Sign Permit (with auto-check)
```bash
# Automatically checks allowance before signing
node scripts/sign_permit2_example.js
```

## Common Scenarios

### Scenario 1: New Token
**Problem**: User wants to pay with a token they haven't used before.

**Solution**: 
1. Check allowance → Insufficient
2. Prompt user to approve Permit2
3. After approval, proceed with permit signing

### Scenario 2: Approval Revoked
**Problem**: User previously revoked Permit2 approval.

**Solution**: 
1. Check allowance → Zero
2. Re-approve Permit2 (one-time again)
3. Proceed with permit signing

### Scenario 3: Large Amount
**Problem**: User approved a small amount, now wants to pay more.

**Solution**: 
1. Check allowance → Insufficient for new amount
2. Approve again with larger amount (or MaxUint256)
3. Proceed with permit signing

**Note**: If you approved `MaxUint256`, this scenario won't occur.

## Best Practices

1. **Always Check First**: Check allowance before attempting to sign permits
2. **Approve MaxUint256**: Use unlimited approval to avoid repeated approvals
3. **User Education**: Explain to users that approval is one-time
4. **Error Handling**: Show clear error messages if allowance is insufficient
5. **Gas Optimization**: Approval costs gas once, permits are gasless

## Troubleshooting

### Error: "Insufficient Permit2 allowance"

**Cause**: Permit2 doesn't have permission to transfer the required amount.

**Fix**:
```bash
npx hardhat run scripts/approve_permit2.js --network sepolia
```

### Error: "Owner has not approved Permit2"

**Cause**: Same as above, detected by relayer script.

**Fix**: Run approval script from the owner's wallet.

### Check Current Status
```bash
# See current allowance
node scripts/check_permit2_allowance.js
```

## Summary

- ✅ **Approval is one-time** (with MaxUint256)
- ✅ **Check allowance** before signing permits
- ✅ **Sign script auto-checks** allowance
- ✅ **Frontend should check** and prompt for approval if needed
- ✅ **After approval**, user can sign unlimited permits (gasless)

The approval step is the only gas cost for the user. After that, all permit signing and transactions are gasless!

