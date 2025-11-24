# Solana PYUSD Devnet Runbook

Complete guide to run the gasless Solana program with PYUSD on devnet.

## Prerequisites

- Solana CLI installed (`solana --version`)
- Anchor CLI installed (`anchor --version`)
- Node.js 18+ with TypeScript (`ts-node` available)
- Devnet SOL in your wallet for transaction fees
- PYUSD tokens in your owner account: `9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2`

## Configuration

**PYUSD Token Address:** `CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM`  
**Program ID:** `EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e`  
**Owner Account (holds PYUSD):** `9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2`

Set your Solana config to devnet:
```bash
solana config set --url devnet
solana config get
```

## Step 1: Build and Deploy Program (if not already deployed)

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e
```

## Step 2: Initialize Escrow

This sets up the escrow PDA and state account for your owner wallet and PYUSD.

```bash
ts-node scripts/solana_init_pyusd.ts ~/.config/solana/id.json
```

**Expected output:**
```
Owner: 9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
PYUSD Mint: CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM
Program ID: EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e

Derived PDAs:
Escrow PDA: <escrow_pda_address>
State PDA: <state_pda_address>
PDA Bump: <bump>

✓ Initialization successful!
Transaction: <tx_hash>
Saved state to: out/solana_pyusd_state.json
```

**Note:** If escrow ATA doesn't exist, create it first:
```bash
# Get escrow PDA (from output above)
ESCROW_PDA=<escrow_pda_address>
spl-token create-account CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM --owner $ESCROW_PDA
```

## Step 3: Transfer PYUSD to Escrow

Move PYUSD from your owner account to the escrow ATA (the program will pull from here).

```bash
# Transfer 10 PYUSD (6 decimals = 10000000 base units)
ts-node scripts/solana_transfer_to_escrow.ts ~/.config/solana/id.json 10000000
```

**Expected output:**
```
Owner: 9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
Amount: 10000000 base units
Owner ATA: <owner_ata>
Escrow ATA: <escrow_ata>

Sending transfer transaction...
Transaction: <tx_hash>
✓ Transfer confirmed!

New balances:
Owner: <remaining_balance>
Escrow: <escrow_balance>
```

## Step 4: Create Permit Signature

Sign a permit message authorizing a transfer. The owner signs this off-chain.

```bash
# Calculate deadline (1 hour from now)
DEADLINE=$(($(date +%s) + 3600))

# Create permit (amount: 1000000 = 1 PYUSD, fee: 10000 = 0.01 PYUSD, nonce: 1)
ts-node scripts/solana_permit_pyusd.ts \
  ~/.config/solana/id.json \
  9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2 \
  1000000 \
  10000 \
  $DEADLINE \
  1
```

**Expected output:**
```
✓ Permit saved to: out/solana_pyusd_permit.json
Owner: 9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
Amount: 1000000
Fee: 10000
Deadline: 2024-12-31T12:00:00.000Z
Nonce: 1
```

**Important:** 
- Nonce must be strictly increasing (1, 2, 3, ...)
- Deadline must be in the future
- Amount + fee must not exceed escrow balance

## Step 5: Relay the Permit

The relayer submits the transaction (pays SOL for gas) and executes the transfer.

```bash
# Relay with receiver (defaults to relayer if not specified)
ts-node scripts/solana_relay_pyusd.ts \
  out/solana_pyusd_permit.json \
  ~/.config/solana/id.json \
  9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
```

**Expected output:**
```
Relayer: <relayer_address>
Owner: 9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
Receiver: 9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
Amount: 1000000
Fee: 10000

Accounts:
Escrow PDA: <escrow_pda>
Escrow ATA: <escrow_ata>
Receiver ATA: <receiver_ata>
Relayer ATA: <relayer_ata>
State PDA: <state_pda>

Sending transaction...
Transaction: <tx_hash>
View on Solana Explorer: https://explorer.solana.com/tx/<tx_hash>?cluster=devnet
✓ Transaction confirmed!
```

## Verify on Solana Explorer

1. Open the transaction link from the output
2. Verify:
   - Ed25519 verify instruction (instruction 0)
   - `relayed_transfer` instruction (instruction 1)
   - Token transfers: escrow → receiver (amount), escrow → relayer (fee)
   - `GaslessPayment` event emitted

## Contract Flow

1. **Ed25519 Verify (Instruction 0):**
   - Verifies the owner's signature over the permit message
   - Message format: `"GASLESS_PERMIT" + owner(32) + programId(32) + amount(8) + fee(8) + deadline(8) + nonce(8)`

2. **relayed_transfer (Instruction 1):**
   - Validates deadline (must be in future)
   - Validates nonce (must be > last_nonce)
   - Verifies signature matches expected message
   - Transfers `amount` from escrow ATA to receiver ATA
   - Transfers `fee` from escrow ATA to relayer ATA
   - Updates state PDA with new nonce
   - Emits `GaslessPayment` event

## Troubleshooting

### "Escrow ATA does not exist"
Create it manually:
```bash
ESCROW_PDA=$(grep escrowPda out/solana_pyusd_state.json | cut -d'"' -f4)
spl-token create-account CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM --owner $ESCROW_PDA
```

### "Invalid or replayed nonce"
Use a nonce higher than the last used one. Check state:
```bash
# Get state PDA from out/solana_pyusd_state.json
solana account <state_pda> --output json | jq
```

### "Deadline expired"
Create a new permit with a future deadline:
```bash
DEADLINE=$(($(date +%s) + 3600))  # +1 hour
```

### "Insufficient balance"
Ensure escrow has enough PYUSD:
```bash
ESCROW_ATA=$(grep escrowAta out/solana_pyusd_state.json | cut -d'"' -f4)
spl-token balance CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM --address $ESCROW_ATA
```

### "Signature message mismatch"
Ensure the permit was signed with the correct owner keypair and message format matches exactly.

## Quick Re-run Checklist

1. ✅ Program deployed on devnet
2. ✅ Escrow initialized (run Step 2 once)
3. ✅ PYUSD in escrow (run Step 3 as needed)
4. ✅ Create new permit (Step 4) with:
   - New nonce (increment from last)
   - Future deadline
   - Amount + fee <= escrow balance
5. ✅ Relay permit (Step 5)

## Example Full Flow

```bash
# 1. Initialize (one-time)
ts-node scripts/solana_init_pyusd.ts ~/.config/solana/id.json

# 2. Fund escrow (10 PYUSD)
ts-node scripts/solana_transfer_to_escrow.ts ~/.config/solana/id.json 10000000

# 3. Create permit (1 PYUSD, 0.01 PYUSD fee, nonce 1)
DEADLINE=$(($(date +%s) + 3600))
ts-node scripts/solana_permit_pyusd.ts \
  ~/.config/solana/id.json \
  9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2 \
  1000000 10000 $DEADLINE 1

# 4. Relay
ts-node scripts/solana_relay_pyusd.ts \
  out/solana_pyusd_permit.json \
  ~/.config/solana/id.json \
  9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2

# 5. For next transfer, increment nonce and repeat steps 3-4
DEADLINE=$(($(date +%s) + 3600))
ts-node scripts/solana_permit_pyusd.ts \
  ~/.config/solana/id.json \
  9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2 \
  2000000 20000 $DEADLINE 2

ts-node scripts/solana_relay_pyusd.ts \
  out/solana_pyusd_permit.json \
  ~/.config/solana/id.json \
  9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2
```

## Notes

- PYUSD has **6 decimals** (1 PYUSD = 1,000,000 base units)
- Nonce must **strictly increase** (no gaps, no reuse)
- Deadline is Unix timestamp in **seconds**
- Relayer pays SOL for transaction fees
- Owner never needs SOL (gasless for token transfers)

