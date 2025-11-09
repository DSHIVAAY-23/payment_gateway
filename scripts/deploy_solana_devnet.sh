#!/usr/bin/env bash
set -euo pipefail

# Solana Devnet deployment using Anchor

echo "[1/5] Ensure Solana devnet and fund wallet"
solana config set --url devnet
solana airdrop 2 || true

echo "[2/5] Install deps"
npm ci

echo "[3/5] Build program"
anchor build

echo "[4/5] Deploy program"
anchor deploy | tee deploy-solana.log

echo "[5/5] (Optional) Copy artifact for clients"
mkdir -p target/deploy
cp -f programs/gasless_sol/target/deploy/gasless_sol.so target/deploy/ || true

PROGRAM_ID=$(grep gasless_sol Anchor.toml | head -n1 | awk '{print $3}' | tr -d '"')
echo "Program ID: ${PROGRAM_ID}"

echo "Done. Use ts-node client scripts to sign and relay:"
echo "  npx ts-node client/solana/permit_example.ts ~/.config/solana/id.json ${PROGRAM_ID} \\\n+        \\"$(solana address)\\" 1000 10 $(($(date +%s)+1800)) 1"
echo "  npx ts-node client/solana/relayer_send.ts out/solana_permit.json"



