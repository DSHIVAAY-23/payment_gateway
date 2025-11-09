# Permit2 SignatureTransfer Integration

This directory adds a Permit2 SignatureTransfer gateway contract and example scripts to accept off-chain EIP-712 signatures and relay them to the Uniswap Permit2 contract using `permitTransferFrom`.

> This flow is *signature-only* and does not require ERC20 `approve` on tokens like USDT. The relayer pays gas, and the user's signature authorizes Permit2 to transfer the specified tokens atomically.

## Files

- `contracts/Permit2SignatureGateway.sol` — gateway contract that forwards the signature transfer to Permit2.

- `scripts/deployPermit2Gateway.js` — deploy the gateway using Hardhat.

- `scripts/relayerPermit2Send.js` — relayer script that reads a JSON produced by the signer and calls the gateway.

## Prerequisites

- Node.js (16+ recommended)

- Hardhat project (this repo already uses Hardhat in your flow)

Install dependencies:

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
npm install @uniswap/permit2
```

## Deploying the gateway

1. Export env vars and run deploy:

```bash
export PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43AC78BA3  # mainnet Permit2
npx hardhat run scripts/deployPermit2Gateway.js --network <network>
```

Note: for testing on Sepolia or a fork, deploy Permit2 to the local network (or use an existing testnet deployment if available) or run a mainnet-fork.

## Producing a Permit2 Signature (frontend)

**Important:** Use the official Permit2 SDK or Uniswap docs to construct the exact typed-data (EIP-712). The structure must match `ISignatureTransfer.PermitTransferFrom` exactly.

High-level steps the frontend must do:

1. Construct `PermitTransferFrom` object with:

   * `details` (contains `token`, `amount`, `expiration`, etc. — see Permit2 docs)

   * `transfers` (array of `{ to, amount }`)

   * `nonce` and `sigDeadline` (Expiry / replay protection)

2. Ask user to sign the EIP-712 typed-data with their wallet (e.g., `eth_signTypedData_v4`).

3. Save/send the JSON: `{ permit: <PermitTransferFrom object>, signature: "0x..." }` to the relayer.

**Example transfer array** for amount + fee:

```js
const transfers = [
  { to: RECEIVER_ADDRESS, amount: AMOUNT },
  { to: RELAYER_ADDRESS, amount: FEE }
];
```

This allows the user to sign a single permit that moves `AMOUNT + FEE` atomically in one transaction.

## Relayer usage

1. Place the `permit` JSON produced by the frontend into `out/permit2_transfer.json` or another path and set `PERMIT_JSON_PATH`.

2. Export `GATEWAY_ADDRESS` to the deployed gateway, then run the script using the relayer wallet configured in Hardhat:

```bash
export GATEWAY_ADDRESS=0xYourGatewayAddress
export PERMIT_JSON_PATH=./out/permit2_transfer.json
npx hardhat run scripts/relayerPermit2Send.js --network <network>
```

The script will call `acceptSignatureAndTransfer(permit, signature)` and the relayer will pay gas.

## Expected JSON shape (example)

> NOTE: The exact field names/types must match the Permit2 SDK's expected `PermitTransferFrom` struct. This sample shows a conceptual structure; *use the SDK to produce the canonical typed data*.

```json
{
  "permit": {
    "details": {
      "token": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "amount": "10100000", // token smallest units
      "expiration": "<unix>"
    },
    "transfers": [
      { "to": "0xReceiver...", "amount": "10000000" },
      { "to": "0xRelayer...", "amount": "100000" }
    ],
    "nonce": "0x...",
    "sigDeadline": "<unix>"
  },
  "signature": "0x..."
}
```

## Testing tips

* Use a mainnet fork to test with real USDT behavior (Non-standard ERC20 returns). Use Hardhat's `--fork` option.

* Keep `sigDeadline` short (e.g., 5–10 minutes) while testing to avoid accidental long-lived permits.

## Security notes

* Always display full transfer details in the wallet UI so users know recipient(s) and amounts.

* Treat incoming permit JSON as sensitive until it is consumed (it authorizes token movement until expiry/nonce used).

* Add monitoring and rate-limiting to your relayer.

---

If you want, I can also generate a ready-to-run `scripts/signPermit2_example.js` that uses either a local private key (for testing) or the `@uniswap/permit2` helper to build the typed data and sign it using an ethers `Wallet`. Let me know if you want that example added to the repo.

