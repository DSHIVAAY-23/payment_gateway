# Solana Gasless-like Escrow Transfer (Anchor) - Local Dev

## Prereqs
- Rust, Solana CLI, Anchor CLI (v0.28+)
- Node.js 18+

## Quick start

```bash
# Install JS deps (root repo)
npm install

# Run tests (compiles program, spins up local validator, runs TS tests)
npm run test:solana
```

## Manual flow
```bash
anchor build
solana-test-validator --reset
anchor deploy
```

Then run client scripts once you set keypairs and addresses.

## Message format
See `programs/gasless_sol/README.md` for the exact message bytes and ordering (little-endian).

## Notes
- The first instruction in the transaction must be the ed25519 verify instruction.
- Nonce must strictly increase per owner.
- Deadline is checked against on-chain clock.
- For production, audit and implement strict ed25519 instruction parsing.


