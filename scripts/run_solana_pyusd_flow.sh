#!/bin/bash
# Full Solana PYUSD devnet flow runner
# This script orchestrates the complete flow from initialization to relay

set -e

# 1) Edit these variables if needed before running:
KEYPAIR_PATH="${1:-$HOME/.config/solana/id.json}"   # pass as first arg, or it will use default
PROGRAM_ID="9wnLiHURHXvYF6AuggZBX4FXPUkwjWMtCWFzosDB3ugh"   # change if you deployed to another id
PYUSD_MINT="CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"
OWNER_PUBKEY="9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2"
ESCROW_DEPOSIT_AMOUNT_BASE="10000000"   # 10 PYUSD (6 decimals) -> base units
PERMIT_AMOUNT_BASE="1000000"            # 1 PYUSD
PERMIT_FEE_BASE="10000"                 # 0.01 PYUSD
RELAYER_KEYPATH="${HOME}/.config/solana/id.json"  # relayer key (can be same)
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # scripts directory

# 0. Safety checks: files exist
echo "Checking files & scripts..."
for f in "$SCRIPTS_DIR/solana_init_pyusd.ts" "$SCRIPTS_DIR/solana_transfer_to_escrow.ts" "$SCRIPTS_DIR/solana_permit_pyusd.ts" "$SCRIPTS_DIR/solana_relay_pyusd.ts"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing script: $f"
    exit 1
  fi
done
echo "✓ All scripts present."

# 1. Ensure solana CLI using devnet
echo ""
echo "Setting solana config to devnet..."
solana config set --url devnet >/dev/null
solana config get

# 2. Build & optionally deploy Anchor program
echo ""
read -p "Do you want to run 'anchor build' and 'anchor deploy'? (y/N) " DO_DEPLOY
if [[ "$DO_DEPLOY" =~ ^[Yy]$ ]]; then
  echo "Running anchor build..."
  anchor build || { echo "anchor build failed"; exit 1; }
  echo "Deploying to devnet (anchor deploy --provider.cluster devnet)..."
  anchor deploy --provider.cluster devnet || { echo "anchor deploy failed"; exit 1; }
  echo "After deploy, update PROGRAM_ID if it changed."
fi

# 3. Initialize escrow (runs solana_init_pyusd.ts)
echo ""
echo "=========================================="
echo "Step 3: Initializing escrow"
echo "=========================================="
echo "Running initialization script to derive PDAs and create state..."
npx ts-node "$SCRIPTS_DIR/solana_init_pyusd.ts" "$KEYPAIR_PATH" || { 
  echo "⚠️  Init failed. This might be due to IDL loading issues."
  echo "The script will continue, but you may need to manually create the escrow ATA."
}

# 4. Read generated state (out/solana_pyusd_state.json) for PDA addresses
echo ""
echo "=========================================="
echo "Step 4: Reading state information"
echo "=========================================="
if [ -f out/solana_pyusd_state.json ]; then
  ESCROW_PDA=$(jq -r '.escrowPda // .escrowPDA // .escrow_pda // empty' out/solana_pyusd_state.json)
  ESCROW_ATA=$(jq -r '.escrowAta // .escrow_ata // empty' out/solana_pyusd_state.json)
  STATE_PDA=$(jq -r '.statePda // .state_pda // empty' out/solana_pyusd_state.json)
  echo "Escrow PDA : $ESCROW_PDA"
  echo "Escrow ATA : $ESCROW_ATA"
  echo "State PDA  : $STATE_PDA"
else
  echo "⚠️  Warning: out/solana_pyusd_state.json not found."
  echo "The init script should have written it. Continuing anyway..."
  echo "You may need to manually derive PDAs using:"
  echo "  ts-node -e \"const { PublicKey } = require('@solana/web3.js'); const owner = new PublicKey('$OWNER_PUBKEY'); const mint = new PublicKey('$PYUSD_MINT'); const programId = new PublicKey('$PROGRAM_ID'); const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), owner.toBuffer(), mint.toBuffer()], programId); const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state'), owner.toBuffer(), mint.toBuffer()], programId); console.log('Escrow PDA:', escrowPda.toBase58()); console.log('State PDA:', statePda.toBase58());\""
fi

# 5. Ensure escrow ATA exists; create if missing
echo ""
echo "=========================================="
echo "Step 5: Creating escrow ATA (if needed)"
echo "=========================================="
if [ -z "$ESCROW_ATA" ] || [ "$ESCROW_ATA" == "null" ] || [ "$ESCROW_ATA" == "" ]; then
  echo "Escrow ATA not found in state file. Attempting to derive and create..."
  if [ -z "$ESCROW_PDA" ] || [ "$ESCROW_PDA" == "null" ] || [ "$ESCROW_PDA" == "" ]; then
    echo "⚠️  Escrow PDA unknown. Deriving now..."
    ESCROW_PDA=$(npx ts-node -e "
      const { PublicKey } = require('@solana/web3.js');
      const owner = new PublicKey('$OWNER_PUBKEY');
      const mint = new PublicKey('$PYUSD_MINT');
      const programId = new PublicKey('$PROGRAM_ID');
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), owner.toBuffer(), mint.toBuffer()],
        programId
      );
      console.log(escrowPda.toBase58());
    ")
    echo "Derived Escrow PDA: $ESCROW_PDA"
  fi
  echo "Creating escrow ATA for mint $PYUSD_MINT owned by $ESCROW_PDA..."
  spl-token create-account "$PYUSD_MINT" --owner "$ESCROW_PDA" || { 
    echo "⚠️  Failed to create escrow ATA. It might already exist. Continuing..."
  }
  ESCROW_ATA=$(spl-token accounts "$PYUSD_MINT" --owner "$ESCROW_PDA" --output json 2>/dev/null | jq -r '.[0].address // empty' || echo "")
  if [ -z "$ESCROW_ATA" ]; then
    echo "⚠️  Could not determine escrow ATA address. You may need to create it manually."
  else
    echo "✓ Escrow ATA: $ESCROW_ATA"
  fi
else
  echo "✓ Escrow ATA found: $ESCROW_ATA"
fi

# 6. Transfer PYUSD from owner to escrow ATA
echo ""
echo "=========================================="
echo "Step 6: Transfer PYUSD to escrow"
echo "=========================================="
read -p "Transfer $ESCROW_DEPOSIT_AMOUNT_BASE base units ($(echo "scale=2; $ESCROW_DEPOSIT_AMOUNT_BASE / 1000000" | bc) PYUSD) to escrow? (owner must sign via KEYPAIR_PATH) (y/N) " DO_TRANSFER
if [[ "$DO_TRANSFER" =~ ^[Yy]$ ]]; then
  echo "Sending transfer to escrow..."
  npx ts-node "$SCRIPTS_DIR/solana_transfer_to_escrow.ts" "$KEYPAIR_PATH" "$ESCROW_DEPOSIT_AMOUNT_BASE" || { echo "⚠️  transfer failed"; exit 1; }
  echo "✓ Transfer completed"
else
  echo "Skipping transfer."
fi

# 7. Create permit (owner signs offline)
echo ""
echo "=========================================="
echo "Step 7: Creating permit signature"
echo "=========================================="
DEADLINE=$(( $(date +%s) + 3600 ))  # 1 hour from now
echo "Preparing permit with:"
echo "  Amount: $PERMIT_AMOUNT_BASE base units ($(echo "scale=2; $PERMIT_AMOUNT_BASE / 1000000" | bc) PYUSD)"
echo "  Fee: $PERMIT_FEE_BASE base units ($(echo "scale=2; $PERMIT_FEE_BASE / 1000000" | bc) PYUSD)"
echo "  Deadline: $DEADLINE ($(date -d @$DEADLINE 2>/dev/null || date -r $DEADLINE))"
echo "  Nonce: 1"
npx ts-node "$SCRIPTS_DIR/solana_permit_pyusd.ts" "$KEYPAIR_PATH" "$OWNER_PUBKEY" "$PERMIT_AMOUNT_BASE" "$PERMIT_FEE_BASE" "$DEADLINE" 1 && \
  echo "✓ Permit saved to out/solana_pyusd_permit.json" || { 
    echo "⚠️  permit creation failed"; 
    exit 1; 
  }

# 8. Relay the permit (relayer pays SOL for tx fee)
echo ""
echo "=========================================="
echo "Step 8: Relaying permit transaction"
echo "=========================================="
read -p "Relay permit now (relayer signs with RELAYER_KEYPATH = $RELAYER_KEYPATH)? (y/N) " DO_RELAY
if [[ "$DO_RELAY" =~ ^[Yy]$ ]]; then
  npx ts-node "$SCRIPTS_DIR/solana_relay_pyusd.ts" out/solana_pyusd_permit.json "$RELAYER_KEYPATH" "$OWNER_PUBKEY" || { 
    echo "⚠️  relay failed"; 
    exit 1; 
  }
  echo "✓ Relay completed"
else
  echo "Skipping relay."
fi

# 9. Summary & verification hints
echo ""
echo "=========================================="
echo "✅ Flow Complete!"
echo "=========================================="
echo "Done. Verify the last transaction in the output and open it in the Solana explorer:"
echo "  https://explorer.solana.com/?cluster=devnet"
echo ""
echo "If anything failed, run the failing script manually and check the error messages."
echo "Common issues:"
echo "  - IDL loading: The scripts may need the IDL to be properly formatted"
echo "  - Missing accounts: Ensure escrow ATA exists before transferring"
echo "  - Insufficient balance: Check owner has PYUSD and relayer has SOL for fees"

