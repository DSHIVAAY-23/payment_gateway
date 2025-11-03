## Gasless Token Transfer PoC (Hardhat + ethers v5)

Gasless token transfer demonstration using EIP-2612 `permit` and a relayer contract. The user signs an approval for `amount + fee`; the relayer executes `transferFrom` to send tokens to the receiver and collect the fee.

### Features
- Minimal ERC20 with EIP-2612 permit (Solidity ^0.8.26)
- Gasless relayer contract calling `permit` and two `transferFrom` operations
- End-to-end scripts to deploy, sign, and relay
- Mocha/Chai test for the full flow

### Prerequisites
- Node.js 18+
- npm

### Install
```bash
npm install
```

### Frontend (Next.js) dev server
```bash
npm run dev
```

### Run a local node
```bash
npm run node
```

### Deploy contracts locally
In a new terminal:
```bash
npm run deploy:local
```
This prints deployed addresses and example env exports.

### Sign a permit (user)
In a new terminal, export variables from the deploy output, then:
```bash
TOKEN_ADDRESS=0x... \
GASLESS_ADDRESS=0x... \
npm run sign
```
This creates `out/permit.json` with `v,r,s,deadline,amount,fee` and logs inputs used.

### Relay the gasless transfer
```bash
npm run relay
```
This reads `out/permit.json`, calls `GaslessTokenTransfer.send`, and prints balances.

### Check balances (optional)
```bash
TOKEN_ADDRESS=0x... npm run balances
```

### Run tests
```bash
npm test
```

### Troubleshooting
- **ChainId mismatch**: Ensure the node and the signer use the same chainId. Restart `hardhat node`.
- **Nonce issues**: Each permit uses `nonces[owner]`. If you reuse a signature, the nonce will be consumed and the tx will revert.
- **Deadline expired**: The permit includes a `deadline`. Regenerate signatures if expired.
- **Token must implement permit**: This PoC assumes EIP-2612. Non-permit tokens require alternative flows.

### Notes on production
- Token compatibility: Some tokens (e.g., Circle USDC) have different `permit` domains or implementations.
- EIP-4337/Paymaster: Consider account abstraction and paymasters to abstract gas without token-fee coupling.
- Price oracles: To size `fee` properly, integrate gas price feeds and token/USD oracles.
- Security: Audit contracts, validate domain separator and replay protections, and handle approvals carefully.

### Environment
Copy `env.frontend.example` to `.env.local` and fill in values as needed:
```bash
cp env.frontend.example .env.local
```

`.env.local` keys (examples):
```
LOCAL_RPC=http://127.0.0.1:8545
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_GASLESS_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x... # use a Hardhat account for local
# RELAYER_API_KEY=dev-secret   # optional
# TESTNET_RPC=https://sepolia.infura.io/v3/YOUR_KEY
```

### How it works (brief)
- `permit` uses an EIP-712 signature over `(owner, spender, value, nonce, deadline)` and a domain separator bound to `(name, version, chainId, verifyingContract)`. The `nonce` prevents replay and `deadline` limits validity.
- We approve `amount + fee` in one signature so the relayer can transfer to the receiver and then pay itself the fee.

### File overview
- `contracts/ERC20Permit.sol`: Minimal ERC20 + EIP-2612 with `nonces` and `DOMAIN_SEPARATOR`.
- `contracts/GaslessTokenTransfer.sol`: Relayer `send` that calls `permit` and two `transferFrom`s.
- `scripts/deploy.js`: Deploys token, mints to user, deploys relayer, prints env exports.
- `scripts/signPermit.js`: Signs EIP-712 permit using `_signTypedData`, writes `out/permit.json`.
- `scripts/relayerSend.js`: Performs the relay tx, prints resulting balances.
- `test/gasless.test.js`: Programmatic end-to-end test of the flow.
- Next frontend:
  - `pages/index.js`: UI with Connect, Checkout, nonce fetch, permit sign, send to relayer
  - `pages/api/relay.js`: Relayer API; uses `RELAYER_PRIVATE_KEY` and RPC to submit tx
  - `components/ConnectButton.js`, `components/Checkout.js`: UI components
  - `lib/ethers.js`: ABIs and helpers



