#!/bin/bash
# Script to create three separate .env files for different flows

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Creating environment configuration files..."

# Create .env.pyusd
cat > "$PROJECT_ROOT/.env.pyusd" << 'ENVEOF'
# ============================================
# pyUSD Gasless Flow Configuration (EIP-2612)
# ============================================
# Usage: cp .env.pyusd .env
#        source .env.pyusd (or use load_env.sh)

# Network Configuration
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
# Alternative: TESTNET_RPC=https://rpc.sepolia.org

# Gateway Contract
GASLESS_ADDRESS=0xE43E22639a7acD0b08168Ef320ee3F46c534d783

# Token Configuration (pyUSD)
TOKEN_ADDRESS=0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9

# Owner Account (Token Sender)
PRIVATE_KEY=0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0
# Owner Address: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2

# Relayer Account (Pays Gas)
RELAYER_PRIVATE_KEY=0xb8c0b5cd1d3ced824a97b67650fb285d4ba182b7bf9eb43e4fbf129b1bdcc6a9
# Relayer Address: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee

# Merchant/Receiver
RECEIVER=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

# Fee Configuration
CUT_COLLECTOR=0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
CUT_BPS=100
# 100 bps = 1%

# Transaction Parameters
AMOUNT=5
# PERMIT_JSON_PATH=out/pyusd_permit_dual_fee.json

# Hardhat Network Account (for deployment)
# PRIVATE_KEY is used for both owner and deployer if not specified separately
ENVEOF

# Create .env.usdt
cat > "$PROJECT_ROOT/.env.usdt" << 'ENVEOF'
# ============================================
# USDT Gasless Flow Configuration (Permit2)
# ============================================
# Usage: cp .env.usdt .env
#        source .env.usdt (or use load_env.sh)

# Network Configuration
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
# Alternative: TESTNET_RPC=https://rpc.sepolia.org

# Gateway Contract (Permit2 Gateway)
GASLESS_ADDRESS=0xYOUR_PERMIT2_GATEWAY_ADDRESS
# Deploy with: npx hardhat run scripts/deploy_permit2_gateway.js --network sepolia

# Permit2 Contract
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3

# Token Configuration (USDT)
TOKEN_ADDRESS=0xCd56D421E5E623eB12d74712b463E9A336B6f287
# Alternative USDT: USDT_ADDRESS=0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0

# Owner Account (Token Sender)
PRIVATE_KEY=0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0
# Owner Address: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2

# Relayer Account (Pays Gas)
RELAYER_PRIVATE_KEY=0xb8c0b5cd1d3ced824a97b67650fb285d4ba182b7bf9eb43e4fbf129b1bdcc6a9
# Relayer Address: 0x483089BfAdF65a08F1be109b42A9aae8535B75ee

# Merchant/Receiver
RECEIVER=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

# Fee Configuration
CUT_COLLECTOR=0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
CUT_BPS=100
# 100 bps = 1%

# Transaction Parameters
AMOUNT=5
# PERMIT_JSON_PATH=out/permit2_usdt.json

# Hardhat Network Account (for deployment)
# PRIVATE_KEY is used for both owner and deployer if not specified separately
ENVEOF

# Create .env.solana
cat > "$PROJECT_ROOT/.env.solana" << 'ENVEOF'
# ============================================
# Solana Gasless Flow Configuration
# ============================================
# Usage: cp .env.solana .env
#        source .env.solana (or use load_env.sh)

# Network Configuration
SOLANA_URL=https://api.devnet.solana.com
# Alternative: SOLANA_URL=https://api.mainnet-beta.solana.com

# Token Configuration
MINT_ADDRESS=8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr
# This is the mockUSDT mint address on devnet
# For USDC: MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (mainnet)
# For pyUSD on Solana: MINT_ADDRESS=CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM (devnet)

# Token Program IDs
# For legacy SPL tokens (most tokens)
TOKEN_PROGRAM_ID=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
# For Token-2022 (newer standard, e.g., pyUSD)
# TOKEN_PROGRAM_ID=TokenzQdB7wq3yq4qMZkYrXygcqpCsYvyd5jcSzyigRum

# Associated Token Program
ASSOCIATED_TOKEN_PROGRAM_ID=ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL

# Keypair Paths
USER_KEYPATH=user_dev_keypair.json
RELAYER_KEYPATH=~/.config/solana/id.json
# Alternative: RELAYER_KEYPATH=relayer_dev_keypair.json
FEE_KEYPATH=fee_collector_keypair.json

# Public Keys (derived from keypairs, but can be set explicitly)
USER_PUBKEY=7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5
FEE_COLLECTOR_PUBKEY=4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT
# MERCHANT_PUBKEY can be set or passed as argument

# Fee Configuration
# Fee is calculated as 1% (100 bps) in build_partial_with_fee.js
# This is hardcoded in the script, but can be made configurable

# Transaction Parameters
# AMOUNT_HUMAN is typically passed as command-line argument
# Example: node scripts/build_partial_with_fee.js <merchant> 1.23 <reference>
ENVEOF

echo "✅ Created .env.pyusd"
echo "✅ Created .env.usdt"
echo "✅ Created .env.solana"
echo ""
echo "To use a specific configuration:"
echo "  cp .env.pyusd .env    # For pyUSD flow"
echo "  cp .env.usdt .env     # For USDT flow"
echo "  cp .env.solana .env   # For Solana flow"
echo ""
echo "Or use the switch script:"
echo "  source scripts/switch_env.sh pyusd"
echo "  source scripts/switch_env.sh usdt"
echo "  source scripts/switch_env.sh solana"

