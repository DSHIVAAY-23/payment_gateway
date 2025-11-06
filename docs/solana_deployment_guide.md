# Solana (Anchor) – What We Built and How to Deploy

This document summarizes the Solana “Gasless-like Escrow Transfer” program we added and exact steps to deploy it to devnet.

## What we built
- Anchor program `gasless_sol` that enables a relayer to execute an escrowed SPL token transfer authorized by an off-chain Ed25519 signature from the user.
- Two instructions:
  - `initialize_escrow(ctx, bump)`: stores owner, mint, escrow ATA metadata in a PDA state. The user escrows tokens into a PDA-owned ATA.
  - `relayed_transfer(ctx, amount, fee, deadline, sig_pubkey, sig, nonce)`: verifies an ed25519 verify instruction exists as instruction 0, checks message contents and deadline/nonce, then CPI transfers `amount` to receiver and `fee` to relayer from the escrow ATA.
- Event: `GaslessPayment { owner, receiver, token_mint, amount, fee, relayer, timestamp }`.
- Deterministic message (little-endian):
  - `b"GASLESS_PERMIT" + owner(32) + programId(32) + u64LE(amount) + u64LE(fee) + i64LE(deadline) + u64LE(nonce)`
- Nonce protection: requires `nonce` to strictly increase per owner; stored in state PDA.
- Deadline protection via on-chain clock.

Program sources:
- `programs/gasless_sol/src/lib.rs`
- `programs/gasless_sol/Cargo.toml`
- `Anchor.toml`

Client/testing:
- Tests: `tests/gasless_sol.ts` (Anchor runner)
- Client scripts: `client/solana/permit_example.ts`, `client/solana/relayer_send.ts`

## Prerequisites
- Solana CLI installed and configured
- Anchor CLI installed (we deployed with Anchor CLI 0.31.1; program depends on Anchor crates 0.28.0 which is compatible when `solana-program` is not declared explicitly)
- Node.js 18+

## One-time setup (program key + config)
```bash
# Ensure devnet RPC
solana config set --url devnet

# Generate a program keypair (stored alongside target/deploy)
mkdir -p target/deploy
solana-keygen new --outfile target/deploy/gasless_sol-keypair.json --force --no-bip39-passphrase

# Update program ID references
# - In programs/gasless_sol/src/lib.rs: declare_id("<PROGRAM_PUBKEY>")
# - In Anchor.toml: [programs.localnet] and [programs.devnet] point to <PROGRAM_PUBKEY>
```

## Build
```bash
# From repo root
anchor build
```
Notes:
- We removed explicit `solana-program` from `programs/gasless_sol/Cargo.toml` to avoid version conflicts with `anchor-lang`.
- We added an `[features] idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]` section.

## Deploy to devnet
```bash
# Copy compiled binary to deploy target (Anchor also places one in programs/.../target/deploy)
cp ./programs/gasless_sol/target/deploy/gasless_sol.so ./target/deploy/

# Deploy with the generated program id keypair
solana program deploy target/deploy/gasless_sol.so \
  --program-id target/deploy/gasless_sol-keypair.json

# Verify
solana program show <PROGRAM_PUBKEY>
```

## Run test flow (local validator via Anchor)
```bash
npm run test:solana
```
This compiles the program and runs the end-to-end test that:
- Mints an SPL token and funds user
- Initializes escrow state/ATA
- Signs the permit with `tweetnacl`
- Executes relay transaction with `[ed25519Verify, relayed_transfer]`
- Asserts balances for receiver/relayer

## Manual client example (devnet)
```bash
# Create a permit JSON
ts-node client/solana/permit_example.ts \
  ~/.config/solana/id.json \
  <PROGRAM_PUBKEY> <OWNER_PUBKEY> <AMOUNT> <FEE> <DEADLINE_SEC> <NONCE>

# Submit via relayer
ts-node client/solana/relayer_send.ts \
  out/solana_permit.json \
  ~/.config/solana/id.json \
  <MINT> <ESCROW_ATA> <RECEIVER_ATA> <RELAYER_ATA> <STATE_PDA>
```

## Troubleshooting
- Ensure instruction 0 is an `ed25519` verify instruction (required by program checks).
- Nonce must strictly increase; stale nonce will be rejected.
- Deadline must be in the future relative to on-chain clock.
- Escrow ATA must be PDA-owned and match the mint.
- If Anchor build errors mention `solana-program` conflicts, remove it from `Cargo.toml` deps (Anchor exports it).


