#!/usr/bin/env bash
set -euo pipefail

# Sepolia deployment: requires .env.sepolia with SEPOLIA_RPC/TESTNET_RPC, PRIVATE_KEY, RELAYER_PRIVATE_KEY

if [[ ! -f .env.sepolia ]]; then
  cat > .env.sepolia << 'EOF'
SEPOLIA_RPC=https://sepolia.infura.io/v3/<YOUR_KEY>
PRIVATE_KEY=0x<DEPLOYER_PRIVATE_KEY>
RELAYER_PRIVATE_KEY=0x<RELAYER_PRIVATE_KEY>
RELAYER_API_KEY=test-secret
NEXT_PUBLIC_TOKEN_ADDRESS=0x<fill_after_deploy>
NEXT_PUBLIC_GASLESS_ADDRESS=0x<fill_after_deploy>
EOF
  echo "Created .env.sepolia. Fill keys before proceeding."
  exit 1
fi

export $(grep -v '^#' .env.sepolia | xargs -d '\n' -r)

echo "[1/4] Install deps"
npm ci

echo "[2/4] Compile"
npx hardhat compile

echo "[3/4] Deploy to Sepolia"
npx hardhat run scripts/deploy.js --network sepolia | tee deploy-sepolia.log
TOKEN=$(grep -Eo 'ERC20Permit deployed at: 0x[0-9a-fA-F]+' deploy-sepolia.log | awk '{print $4}' || true)
GASLESS=$(grep -Eo 'GaslessTokenTransfer deployed at: 0x[0-9a-fA-F]+' deploy-sepolia.log | awk '{print $4}' || true)
if [[ -n "${TOKEN}" ]]; then sed -i "s|NEXT_PUBLIC_TOKEN_ADDRESS=.*|NEXT_PUBLIC_TOKEN_ADDRESS=${TOKEN}|" .env.sepolia; fi
if [[ -n "${GASLESS}" ]]; then sed -i "s|NEXT_PUBLIC_GASLESS_ADDRESS=.*|NEXT_PUBLIC_GASLESS_ADDRESS=${GASLESS}|" .env.sepolia; fi
echo "TOKEN=${TOKEN}"
echo "GASLESS=${GASLESS}"

echo "[4/4] Start Next.js with Sepolia config"
export $(grep -v '^#' .env.sepolia | xargs -d '\n' -r)
npm run build
npm run start



