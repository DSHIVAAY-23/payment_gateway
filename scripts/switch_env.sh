#!/bin/bash
# Helper script to switch between different .env configurations
# Usage: source scripts/switch_env.sh [pyusd|usdt|solana]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_TYPE="${1:-}"

if [[ -z "$ENV_TYPE" ]]; then
    echo "Usage: source scripts/switch_env.sh [pyusd|usdt|solana]"
    echo ""
    echo "Available configurations:"
    echo "  pyusd  - pyUSD EIP-2612 gasless flow"
    echo "  usdt   - USDT Permit2 gasless flow"
    echo "  solana - Solana gasless flow"
    return 1 2>/dev/null || exit 1
fi

ENV_FILE="$PROJECT_ROOT/.env.$ENV_TYPE"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "Run: bash scripts/create_env_files.sh to create the files"
    return 1 2>/dev/null || exit 1
fi

# Backup current .env if it exists
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    BACKUP_FILE="$PROJECT_ROOT/.env.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$PROJECT_ROOT/.env" "$BACKUP_FILE"
    echo "📦 Backed up current .env to $BACKUP_FILE"
fi

# Copy the selected env file to .env
cp "$ENV_FILE" "$PROJECT_ROOT/.env"

# Load the environment variables
set -a
source "$PROJECT_ROOT/.env"
set +a

echo "✅ Switched to .env.$ENV_TYPE configuration"
echo "📋 Loaded environment variables from .env.$ENV_TYPE"
echo ""
echo "Current configuration:"
case "$ENV_TYPE" in
    pyusd)
        echo "  Token: pyUSD (EIP-2612)"
        echo "  Gateway: ${GASLESS_ADDRESS:-not set}"
        echo "  Token Address: ${TOKEN_ADDRESS:-not set}"
        ;;
    usdt)
        echo "  Token: USDT (Permit2)"
        echo "  Gateway: ${GASLESS_ADDRESS:-not set}"
        echo "  Token Address: ${TOKEN_ADDRESS:-not set}"
        echo "  Permit2: ${PERMIT2_ADDRESS:-not set}"
        ;;
    solana)
        echo "  Network: Solana Devnet"
        echo "  Mint: ${MINT_ADDRESS:-not set}"
        echo "  User: ${USER_PUBKEY:-not set}"
        echo "  Fee Collector: ${FEE_COLLECTOR_PUBKEY:-not set}"
        ;;
esac

