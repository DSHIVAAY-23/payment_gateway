# Sepolia Flow Automation – Execution Notes

This document summarizes the commands required to run the full Sepolia flow using the provided repository scripts, along with the current automation status.

> **Execution status:** Network-bound steps were not executed in this environment (no Sepolia access). Commands below are ready to run locally; capture their output for addresses and transaction hashes.

## 1. Environment setup

```bash
export SEPOLIA_RPC="https://chain.instanodes.io/eth-testnet/?apikey=4e4e85545c34453a0d8f298629f51b8c"
export PRIVATE_KEY="0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0"
export RELAYER_PRIVATE_KEY="0xe323c8254a07f97f6dbf2b3d7fd641a233a62a511eeb6287a19bb681a640a6f0"   # replace if using a different relayer key
export RELAYER_API_KEY="test-secret"
export RELAYER_URL="https://your-relayer-host/api/relay"  # or http://localhost:3000/api/relay when running locally
```

Load additional values (token/receiver/etc.) once deployment outputs are known:

```bash
export TOKEN_ADDRESS="0x..."      # fill after deploy
export GASLESS_ADDRESS="0x..."    # fill after deploy
export RECEIVER="0x..."           # recipient of tokens
export AMOUNT="10"                # token amount (human readable)
export FEE="0.1"                  # relayer fee
```

## 2. Commands to execute

1. Install dependencies

   ```bash
   npm ci
   ```

2. Compile contracts

   ```bash
   npx hardhat compile
   ```

3. Deploy to Sepolia

   ```bash
   npx hardhat run scripts/deploy.js --network sepolia | tee logs/deploy-sepolia.log
   ```

   - Parse `logs/deploy-sepolia.log` for:
     - `ERC20Permit deployed at: 0x...` → export as `TOKEN_ADDRESS`
     - `GaslessTokenTransfer deployed at: 0x...` → export as `GASLESS_ADDRESS`

4. Start relayer API (Next.js)

   ```bash
   export LOCAL_RPC="${SEPOLIA_RPC}"   # Next.js API checks LOCAL_RPC or TESTNET_RPC
   npm run dev
   ```

   Ensure `RELAYER_PRIVATE_KEY` and `RELAYER_API_KEY` remain exported when starting the server.

5. Sign permit and POST automatically

   ```bash
   node scripts/create_permit_and_send_auto.js | tee logs/permit-relay.log
   ```

   - On success the script prints the relayer response including `{ ok: true, txHash: ... }`.

6. (Optional) Verify balances via Hardhat script

   ```bash
   npx hardhat run scripts/checkBalances.js --network sepolia
   ```

## 3. Expected outputs

- **Deployed addresses** – appear in `deploy-sepolia.log` (fill into the env exports above).
- **Permit execution transaction hash** – printed by `create_permit_and_send_auto.js` response; confirm on Etherscan:

  ```text
  https://sepolia.etherscan.io/tx/<txHash>
  ```

- **Gasless transfer logs** – Next.js API server logs the `send(...)` transaction; capture block number and hash.

## 4. Troubleshooting / manual intervention

- If `npx hardhat run ... --network sepolia` fails with nonce or RPC errors, confirm the `PRIVATE_KEY` account has Sepolia ETH.
- If the relayer returns 401, ensure `RELAYER_API_KEY` matches the header sent by the signing script.
- If the relayer reports missing fields, review `pages/api/relay.js` for required JSON keys (`token, gasless, owner, receiver, amountWei, feeWei, deadline, v, r, s`).
- In case of `invalid signature`, refresh the permit by rerunning `node scripts/create_permit_and_send_auto.js` so it fetches latest nonce and deadline.
- If using a hosted relayer, update `RELAYER_URL` accordingly.

## 5. Pending actions

- Run the commands above on a Sepolia-connected machine.
- Record the actual addresses and transaction hashes back into this document or a deployment log once available.
- Rotate any real keys after testing.

## 6. Security reminder

- Unset exported private keys after use (`unset PRIVATE_KEY RELAYER_PRIVATE_KEY`).
- Store secrets securely; do not commit them to version control.
- Consider using different keys for deployment and relaying.



