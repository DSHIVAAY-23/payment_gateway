# Permit2 Dual-Fee Gateway – Quick Start (Sepolia)

This guide shows how to deploy and use the Permit2-based pull-and-split gateway that pulls tokens from a user via Permit2 and splits to merchant (net), feeCollector (fee), and cutCollector (cut).

## Prerequisites

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers dotenv @openzeppelin/contracts
```

Environment variables (example):

```bash
export SEPOLIA_RPC="https://chain.instanodes.io/eth-testnet/?apikey=4e4e85545c34453a0d8f298629f51b8c"
export PRIVATE_KEY="0x<your_deployer_key>"
export RELAYER_PRIVATE_KEY="0x<your_relayer_key>"
export PERMIT2_ADDRESS="0x000000000022D473030F116dDEE9F6B43AC78BA3"
export USDT_ADDRESS="0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"
export FEE_COLLECTOR="0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7"
export CUT_COLLECTOR="0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2"
export FEE_BPS="50"
export CUT_BPS="100"
export GAS_LIMIT="900000"
```

## 1) Compile
```bash
npx hardhat compile
```

## 2) Deploy Gateway
```bash
npx hardhat run scripts/deploy_permit2_gateway.js --network sepolia
```
The script prints the deployed address – export it as `GASLESS_ADDRESS`.

## 3) Produce Permit JSON (frontend or example script)

Preferred: Use the Uniswap Permit2 SDK in your frontend to build a `PermitBatchTransferFrom`:
- `permitted = [{ token: USDT_ADDRESS, amount }]`
- `nonce`, `deadline`
- `transferDetails = [{ to: GATEWAY_ADDRESS, requestedAmount: amount }]`
- Sign typed-data and save:
```json
{
  "gateway": "<GATEWAY_ADDRESS>",
  "permit": { "permitted": [{ "token": "<USDT>", "amount": "<amount>" }], "nonce": "...", "deadline": <unix> },
  "transferDetails": [{ "to": "<GATEWAY_ADDRESS>", "requestedAmount": "<amount>" }],
  "owner": "<ownerAddress>",
  "signature": "0x...",
  "receiver": "<merchantAddress>"
}
```

Example (testing only):
```bash
node scripts/sign_permit2_example.js
```
This writes `out/permit2_usdt.json`.

## 4) Relay (Relayer pays gas)
```bash
node scripts/relayer_send_permit2_dual.js
# Or:
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```
The script prints tx hash and block number.

## 5) Verify on Etherscan
Use the tx hash; look for:
- Transfer(owner → gateway, amount)
- Transfer(gateway → receiver, net)
- Transfer(gateway → feeCollector, fee)
- Transfer(gateway → cutCollector, cut)
- `PulledAndSplit` event from the gateway

## Notes on Permit2 Signing
- In production, use `@uniswap/permit2` SDK to build the typed-data properly.
- Ensure the user sees both deductions (fee and cut) and consents.
- Validate `nonce`, `deadline`, and chain/network in your frontend and relayer.

## Utilities
- `scripts/verify_tx.js` – parse Transfer and PulledAndSplit events for a tx hash
- `scripts/relayer_monitor.js` – monitor relayer ETH balance
- `scripts/keeper_swap.js` – skeleton for aggregating fees and swapping (placeholders)




