## Sepolia Permit2 Dual-Fee Runbook

This document captures the exact commands, env vars, and reference outputs used to deploy the Permit2 dual-fee gateway, sign a permit, and relay it successfully on Sepolia. Follow the steps in order; each section notes how to repeat the action later.

---

### 1. Prerequisites
- Node.js 18+ and npm dependencies installed (`npm install`).
- Hardhat config has access to Sepolia (`SEPOLIA_RPC` endpoint).
- Two funded wallets: **owner** (signs the permit & approves Permit2) and **relayer** (submits the tx).
- Export env vars; adjust values to your own wallets/endpoints:

```bash
export SEPOLIA_RPC="https://chain.instanodes.io/eth-testnet/?apikey=4e4e85545c34453a0d8f298629f51b8c"
export PRIVATE_KEY="0xb8c0b5cd1d3ced824a97b67650fb285d4ba182b7bf9eb43e4fbf129b1bdcc6a9"   # owner key (never share publicly)
export RELAYER_PRIVATE_KEY="0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2"                   # relayer key (example)
export PERMIT2_ADDRESS=0x000000000022d473030f116ddee9f6b43ac78ba3
export USDT_ADDRESS=0xCd56D421E5E623eB12d74712b463E9A336B6f287     # deployed MockUSDT
```

> **Re-run tip:** Source the same env file (or re-export) whenever you open a new shell.

---

### 2. Deploy Mock USDT (once)
```bash
npx hardhat run scripts/deploy_mock_usdt.js --network sepolia
```
Sample output:
```
✅ Deployed MockUSDT at: 0xCd56D421E5E623eB12d74712b463E9A336B6f287
export USDT_ADDRESS=0xCd56D421E5E623eB12d74712b463E9A336B6f287
```

> **Re-run tip:** Skip if you already have a token. Set `USDT_ADDRESS` to the desired ERC20.

---

### 3. Deploy Gasless Permit2 Gateway
```bash
export FEE_COLLECTOR=0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7
export CUT_COLLECTOR=0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
npx hardhat run scripts/deploy_permit2_gateway.js --network sepolia
```
Sample output:
```
✅ Deployed GaslessPermit2GatewayDualFee at: 0x8529e860693a813FbEF133465c79BcD64516ca47
export GASLESS_ADDRESS=0x8529e860693a813FbEF133465c79BcD64516ca47
```

> **Re-run tip:** Only redeploy if you need different fee params. Otherwise keep `GASLESS_ADDRESS`.

---

### 4. Give Permit2 Allowance (owner wallet)
```bash
npx hardhat run scripts/approve_permit2.js --network sepolia
```
Sample output:
```
Sending approve(token=0xCd56D421E5E623eB12d74712b463E9A336B6f287 spender=0x000000000022d473030f116ddee9f6b43ac78ba3 amount=MaxUint256) from 0x483089BfAdF65a08F1be109b42A9aae8535B75ee ...
tx hash: 0x04870c72cf7aedebe7af89e44c73d4034bb67c834014da5a28e1cea2142a00b1
mined in block 9696114
allowance set: 1157920...
```

> **Re-run tip:** Repeat only if you revoke allowance or change tokens. Max allowance avoids future approvals.

---

### 5. Sign Permit2 Payload (owner)
```bash
export RECEIVER=0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2   # merchant payout
export AMOUNT=10                                             # human units (6 decimals)
node scripts/sign_permit2_example.js
```
Sample output:
```
Owner:    0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Gateway:  0x8529e860693a813FbEF133465c79BcD64516ca47
Amount:   10 (wei 10000000)
Wrote /data/payment_gateway/out/permit2_usdt.json
```

> **Re-run tip:** Run this whenever amount/receiver changes or the prior permit expires (deadline = now + 1 hr).

---

### 6. Relay the Permit (relayer wallet)
```bash
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```
Successful run:
```
Using RELAYER_PRIVATE_KEY as relayer: 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
--- Calling sendWithPermit2DualCollection ---
Gateway   : 0x8529e860693a813FbEF133465c79BcD64516ca47
Owner     : 0x483089BfAdF65a08F1be109b42A9aae8535B75ee
Receiver  : 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2
Token     : 0xCd56D421E5E623eB12d74712b463E9A336B6f287
Amount    : 10000000
Tx hash   : 0xd4b6e1ab41388529c6c16e47e288a2344250c7926172153fb79502a82c8fd57f
Mined in block: 9696160
Etherscan : https://sepolia.etherscan.io/tx/0xd4b6e1ab41388529c6c16e47e288a2344250c7926172153fb79502a82c8fd57f
```

> **Re-run tip:** You can relay any saved permit JSON by setting `PERMIT_JSON_PATH` to the file you want.

---

### 7. Contract Flow (what happens on-chain)
Reference transaction: https://sepolia.etherscan.io/tx/0xd4b6e1ab41388529c6c16e47e288a2344250c7926172153fb79502a82c8fd57f

1. **Relayer calls `GaslessPermit2GatewayDualFee.sendWithPermit2DualCollection`** with the permit payload, owner address, signature, transfer details, and receiver.
2. **Gateway forwards the permit to Permit2:** `GaslessPermit2GatewayDualFee` invokes `Permit2.permitTransferFrom`, passing the exact permit + transfer details. Permit2 injects `msg.sender` (the gateway) as the spender, verifies the EIP-712 signature, ensures `requestedAmount <= permitted.amount`, and transfers 10 USDT from `0x483089BfAdF65a08F1be109b42A9aae8535B75ee` to the gateway.
3. **Gateway splits funds:** After the pull succeeds, `GaslessPermit2GatewayDualFee` computes fee and cut using `feeBps`/`cutBps`, then calls `SafeERC20.safeTransfer` three times: net amount to `receiver (= 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2)`, fee to `feeCollector (= 0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7)`, and cut to `cutCollector (= 0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2)`.
4. **Event emission:** The contract emits `PulledAndSplit(token, owner, receiver, amount, fee, cut, relayer)` so monitoring services can confirm the distribution.

Internally, Permit2 consumes the nonce once the signature is used; replaying the same JSON will fail with `InvalidNonce`.

---

### 8. Verifying Results
- On Etherscan, confirm:
  - `Transfer` from owner → gateway for 10 USDT (10000000 units).
  - `Transfer` from gateway → receiver (net), fee collector, and cut collector.
  - `PulledAndSplit` event emitted by `GaslessPermit2GatewayDualFee`.
- Use `scripts/verify_tx.js <txHash>` for local parsing if needed.

---

### Quick Re-run Checklist
1. Load env vars (`SEPOLIA_RPC`, `PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `USDT_ADDRESS`, `GASLESS_ADDRESS`, etc.).
2. Ensure Permit2 allowance still exists (skip unless revoked).
3. Run `node scripts/sign_permit2_example.js` to create/refresh `out/permit2_usdt.json`.
4. Relay with `npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia`.

Following those steps reproduced the successful transaction above. When automating, swap the sample signer script with the official @uniswap/permit2 SDK to build typed data safely and manage nonces.


