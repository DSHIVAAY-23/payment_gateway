## Deployment Guide – Localhost, Sepolia, and Solana Devnet

This document provides copy/paste-ready steps to deploy and verify the gasless transaction demo across three environments:
- Localhost (Hardhat/Anvil + local relayer)
- Sepolia testnet
- Solana Devnet

Where possible, commands leverage existing scripts in this repo.

---

## A) Prerequisites (all environments)

- Node.js 18.x (recommended) and npm 9+
  - Verify: `node -v && npm -v`
- Git, curl
- Wallet setup
  - EVM: MetaMask with a local account (for localhost) and a funded Sepolia account (for testnet)
  - Solana: `solana-keygen new -o ~/.config/solana/id.json` and a devnet airdrop
- Providers (recommended)
  - EVM: Alchemy or Infura project key for Sepolia
  - Solana: Public devnet RPC is fine; consider a provider if rate-limited
- CLIs and toolchains
  - Hardhat: installed via devDependencies; invoked with `npx hardhat`
  - Solana CLI: `solana --version`
  - Anchor CLI: `anchor --version`

Private key management
- EVM: Use a dedicated private key for the relayer on testnets. Store in `.env` only for development; never commit.
- Solana: Default Anchor wallet path is `~/.config/solana/id.json`. Use a separate keypair when deploying to devnet.

---

## B) Environment-specific configuration

Create environment files at the repo root for server/relayer and frontend:

### Localhost (.env.local)

```bash
cat > .env.local << 'EOF'
LOCAL_RPC=http://127.0.0.1:8545
# Private key for the relayer (use a Hardhat local account key)
RELAYER_PRIVATE_KEY=0x...
# Optional API key enforced by relayer route
# RELAYER_API_KEY=dev-secret

# Frontend config (Next.js)
NEXT_PUBLIC_TOKEN_ADDRESS=0x...    # filled after deploy
NEXT_PUBLIC_GASLESS_ADDRESS=0x...  # filled after deploy
EOF
```

### Sepolia (.env.sepolia)

```bash
cat > .env.sepolia << 'EOF'
# EVM RPC (choose one)
SEPOLIA_RPC=https://sepolia.infura.io/v3/<YOUR_KEY>
# or
# TESTNET_RPC=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>

# Deployer key for Hardhat (deployment) – NOT the relayer key
PRIVATE_KEY=0x<DEPLOYER_PRIVATE_KEY>

# Relayer server config
RELAYER_PRIVATE_KEY=0x<RELAYER_PRIVATE_KEY>
RELAYER_API_KEY=test-secret

# Frontend config (Next.js)
NEXT_PUBLIC_TOKEN_ADDRESS=0x...    # filled after deploy
NEXT_PUBLIC_GASLESS_ADDRESS=0x...  # filled after deploy
EOF
```

### Solana Devnet (Anchor.toml already points to devnet)

- Ensure Anchor provider section in `Anchor.toml`:

```toml
[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

No extra `.env` required for Solana steps below.

---

## C) Commands to run

### 1) Install dependencies (all)

```bash
npm ci
```

### 2) Compile

- EVM (Hardhat):

```bash
npx hardhat compile
```

- Solana (Anchor):

```bash
anchor build
```

### 3) Deploy

#### Localhost (Hardhat node + deploy + frontend)

Terminal A – start a local chain:

```bash
npx hardhat node
```

Terminal B – export a local relayer key and deploy contracts:

```bash
# Use one of the printed Hardhat private keys from Terminal A
export RELAYER_PRIVATE_KEY=0x<one_of_hardhat_accounts>

# Deploy demo ERC20Permit and GaslessTokenTransfer to localhost
npx hardhat run scripts/deploy.js --network localhost
```

The deploy script will print contract addresses. Set them in `.env.local`:

```bash
export TOKEN=0x...
export GASLESS=0x...
sed -i "s|NEXT_PUBLIC_TOKEN_ADDRESS=.*|NEXT_PUBLIC_TOKEN_ADDRESS=$TOKEN|" .env.local
sed -i "s|NEXT_PUBLIC_GASLESS_ADDRESS=.*|NEXT_PUBLIC_GASLESS_ADDRESS=$GASLESS|" .env.local
```

#### Sepolia (Testnet)

```bash
set -a; source ./.env.sepolia; set +a

# Deploy using the deployer key configured in PRIVATE_KEY
npx hardhat run scripts/deploy.js --network sepolia

# After deploy, export addresses and update .env.sepolia for frontend
export TOKEN=0x...
export GASLESS=0x...
sed -i "s|NEXT_PUBLIC_TOKEN_ADDRESS=.*|NEXT_PUBLIC_TOKEN_ADDRESS=$TOKEN|" .env.sepolia
sed -i "s|NEXT_PUBLIC_GASLESS_ADDRESS=.*|NEXT_PUBLIC_GASLESS_ADDRESS=$GASLESS|" .env.sepolia
```

#### Solana Devnet (Anchor)

```bash
# Ensure devnet
solana config set --url devnet

# Fund your wallet
solana airdrop 2

# Build and deploy program
anchor build
anchor deploy

# Optionally copy artifact for client scripts (if needed by your environment)
cp ./programs/gasless_sol/target/deploy/gasless_sol.so ./target/deploy/
```

### 4) Run the relayer server

Localhost or Sepolia – start Next.js API (includes `/api/relay`):

```bash
# For localhost
set -a; source ./.env.local; set +a
npm run dev

# For sepolia (in a separate terminal)
# set -a; source ./.env.sepolia; set +a
# npm run start  # after build, or use: npm run dev
```

### 5) Start frontend

```bash
# Development mode (includes hot-reload and API route)
npm run dev

# or build & serve
npm run build
npm run start
```

Ensure the `.env.*` file used sets `NEXT_PUBLIC_TOKEN_ADDRESS` and `NEXT_PUBLIC_GASLESS_ADDRESS`.

---

## D) Verification commands

### EVM – Localhost/Sepolia

1) Read-only checks (addresses and state):

```bash
# Show configured env
echo $NEXT_PUBLIC_TOKEN_ADDRESS; echo $NEXT_PUBLIC_GASLESS_ADDRESS

# Verify the token has permit and nonces (via Hardhat console)
npx hardhat console --network localhost <<'EOF'
const token = await ethers.getContractAt('ERC20Permit', process.env.NEXT_PUBLIC_TOKEN_ADDRESS);
(await token.name()).toString();
(await token.nonces("0x0000000000000000000000000000000000000001")).toString();
EOF
```

2) Sign a permit locally (script writes `out/permit.json`):

```bash
# Use the second Hardhat account as the token owner (adjust as needed)
export TOKEN_ADDRESS=$NEXT_PUBLIC_TOKEN_ADDRESS
export GASLESS_ADDRESS=$NEXT_PUBLIC_GASLESS_ADDRESS
export SENDER=0x<owner_address>
export RECEIVER=0x<receiver_address>
export AMOUNT=10
export FEE=0.1

npx hardhat run scripts/signPermit.js --network localhost
cat out/permit.json
```

3) Relay the transaction via API:

```bash
# Prepare payload (reads v/r/s/etc. from out/permit.json)
node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync("out/permit.json","utf8"));
const body=JSON.stringify({
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
  gasless: process.env.NEXT_PUBLIC_GASLESS_ADDRESS,
  owner: p.owner,
  receiver: p.receiver,
  amountWei: p.amountWei,
  feeWei: p.feeWei,
  deadline: p.deadline,
  v: p.v, r: p.r, s: p.s
});
console.log(body);
' > /tmp/relay.json

# Call relayer (localhost Next.js dev server)
curl -sS -X POST http://localhost:3000/api/relay \
  -H 'Content-Type: application/json' \
  ${RELAYER_API_KEY:+-H "x-relayer-key: $RELAYER_API_KEY"} \
  --data @/tmp/relay.json | jq .
```

4) Relay via Hardhat script (alternative):

```bash
npx hardhat run scripts/relayerSend.js --network localhost
```

Expected result: receiver balance increases by `AMOUNT`, relayer receives `FEE`, and API logs show the submitted tx hash.

### Solana – Devnet

1) Initialize escrow and prepare accounts (high-level; add your own token/mint/escrow setup as needed). If missing scripts, add TODOs to `client/solana/`:

```bash
# TODO: Add script to initialize escrow state and associated token accounts
#       File to create: client/solana/init_escrow.ts
```

2) Create a permit (ed25519 signed message) and save to `out/solana_permit.json`:

```bash
# Owner keypair JSON path and values
OWNER_KP=~/.config/solana/id.json
PROGRAM_ID=$(grep gasless_sol Anchor.toml | awk '{print $3}' | tr -d '"')
OWNER_PUBKEY=$(solana address)
AMOUNT=1000
FEE=10
DEADLINE=$(($(date +%s)+1800))
NONCE=1

npx ts-node client/solana/permit_example.ts \
  $OWNER_KP $PROGRAM_ID $OWNER_PUBKEY $AMOUNT $FEE $DEADLINE $NONCE

cat out/solana_permit.json
```

3) Relay transaction (ed25519 verify + program instruction):

```bash
npx ts-node client/solana/relayer_send.ts out/solana_permit.json
```

Expected result: Transaction signature printed; tokens moved from escrow ATA to receiver and relayer fee ATA.

---

## E) Troubleshooting

- Insufficient funds (relayer):
  - EVM: Fund `RELAYER_PRIVATE_KEY` with ETH on the target network.
  - Solana: `solana airdrop 1` on devnet; ensure fee payer has SOL.
- CORS / API not reachable:
  - Use the Next.js API locally (`npm run dev`) or deploy behind a proper domain; verify `http://localhost:3000/api/relay` is reachable.
- Wrong network or addresses:
  - Ensure `chainId` in the signed EIP-712 domain matches the network used by relayer.
  - Verify `NEXT_PUBLIC_TOKEN_ADDRESS` and `NEXT_PUBLIC_GASLESS_ADDRESS` are set to deployed addresses.
- Bad nonce / invalid signature (EVM):
  - Fetch fresh `token.nonces(owner)` before signing; regenerate `out/permit.json`.
  - Check `deadline` is in the future.
- Anchor wallet mismatch / program ID:
  - `anchor keys list` to verify program ID alignment; ensure `declare_id!()` in `programs/gasless_sol/src/lib.rs` matches `Anchor.toml`.
  - Ensure the PDA seeds and ATAs are initialized consistently with the program’s expectations.
- RPC issues / 429:
  - Use a dedicated provider key (Alchemy/Infura) for Sepolia; backoff and retry on rate limits.

---

## Scripts

For convenience, scripts are provided:
- `scripts/deploy_local.sh`
- `scripts/deploy_sepolia.sh`
- `scripts/deploy_solana_devnet.sh`

Open and edit these scripts to fill in addresses after deployment where indicated.



