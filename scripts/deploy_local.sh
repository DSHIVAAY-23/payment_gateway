#!/usr/bin/env bash
set -euo pipefail

# Localhost deployment: Hardhat node, deploy contracts, start Next.js (API + frontend)

if [[ ! -f .env.local ]]; then
  cat > .env.local << 'EOF'
LOCAL_RPC=http://127.0.0.1:8545
RELAYER_PRIVATE_KEY=0x<fill_from_hardhat_output>
NEXT_PUBLIC_TOKEN_ADDRESS=0x<fill_after_deploy>
NEXT_PUBLIC_GASLESS_ADDRESS=0x<fill_after_deploy>
EOF
  echo "Created .env.local. Fill RELAYER_PRIVATE_KEY after starting hardhat node."
fi

echo "[1/5] Install deps"
npm ci

echo "[2/5] Start hardhat node (background)"
nohup npx hardhat node > hardhat-node.log 2>&1 &
HARDHAT_PID=$!
sleep 3
echo "Hardhat node PID: $HARDHAT_PID (logs: hardhat-node.log)"

echo "[3/5] Compile and deploy to localhost"
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost | tee deploy-local.log

echo "[4/5] Update env with deployed addresses"
TOKEN=$(grep -Eo 'ERC20Permit deployed at: 0x[0-9a-fA-F]+' deploy-local.log | awk '{print $4}' || true)
GASLESS=$(grep -Eo 'GaslessTokenTransfer deployed at: 0x[0-9a-fA-F]+' deploy-local.log | awk '{print $4}' || true)
if [[ -n "${TOKEN}" ]]; then sed -i "s|NEXT_PUBLIC_TOKEN_ADDRESS=.*|NEXT_PUBLIC_TOKEN_ADDRESS=${TOKEN}|" .env.local; fi
if [[ -n "${GASLESS}" ]]; then sed -i "s|NEXT_PUBLIC_GASLESS_ADDRESS=.*|NEXT_PUBLIC_GASLESS_ADDRESS=${GASLESS}|" .env.local; fi
echo "TOKEN=${TOKEN}"
echo "GASLESS=${GASLESS}"

echo "[5/5] Start Next.js (API + frontend)"
export $(grep -v '^#' .env.local | xargs -d '\n' -r)
npm run dev



