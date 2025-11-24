#!/bin/bash
# Simple script to initialize escrow using Solana CLI
# This is a workaround until IDL loading issues are resolved

set -e

OWNER_KEYPAIR="${1:-$HOME/.config/solana/id.json}"
PYUSD_MINT="CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"
PROGRAM_ID="EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e"

echo "Owner keypair: $OWNER_KEYPAIR"
OWNER=$(solana address -k "$OWNER_KEYPAIR")
echo "Owner address: $OWNER"

# Derive PDAs (this would need to be done in a script, but for now we'll calculate manually)
echo ""
echo "To initialize escrow, you need to:"
echo "1. Derive the escrow PDA and state PDA"
echo "2. Create the escrow ATA (if it doesn't exist)"
echo "3. Call initialize_escrow instruction"
echo ""
echo "For now, please use the TypeScript script once IDL issues are resolved,"
echo "or use Anchor's test framework which handles IDL automatically."
echo ""
echo "To derive PDAs, you can use:"
echo "  ts-node -e \"const { PublicKey } = require('@solana/web3.js'); const owner = new PublicKey('$OWNER'); const mint = new PublicKey('$PYUSD_MINT'); const programId = new PublicKey('$PROGRAM_ID'); const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), owner.toBuffer(), mint.toBuffer()], programId); const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state'), owner.toBuffer(), mint.toBuffer()], programId); console.log('Escrow PDA:', escrowPda.toBase58()); console.log('State PDA:', statePda.toBase58());\""

