# Solana Deployment Results (Devnet)

## Summary
- Program deployed to devnet
- Program ID: `EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e`
- Deploy signature: `39UUC6Gjhbsomx67bozqazWy2drnF1PSv61krLubdZR5famZzypXGsmwK5PAFTd3oKwzw4zQabPtchtuTa5S1dxs`

## Commands Executed
```bash
# Ensure devnet
solana config set --url devnet

# Create program keypair
mkdir -p target/deploy
solana-keygen new --outfile target/deploy/gasless_sol-keypair.json --force --no-bip39-passphrase

# Build
anchor build

# Copy compiled shared object to deploy dir
cp ./programs/gasless_sol/target/deploy/gasless_sol.so ./target/deploy/

# Deploy
solana program deploy target/deploy/gasless_sol.so \
  --program-id target/deploy/gasless_sol-keypair.json

# Verify
solana program show EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e
```

## Verification Output (abridged)
```
Program Id: EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: 54Jbeo2BtFJwBSxBVpqW7iSHQ9QaWFRH4cQarKLGxvWE
Authority: GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd
Last Deployed In Slot: 419650631
Data Length: 281128 (0x44a28) bytes
Balance: 1.95785496 SOL
```

## Notes
- `declare_id!` and `Anchor.toml` were updated to the above Program ID prior to deployment.
- If you re-generate a new program keypair, update both before building/deploying again.
- Use the client scripts and tests to interact with the program on devnet.


