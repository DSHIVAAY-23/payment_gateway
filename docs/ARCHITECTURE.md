## Payment Gateway – Gasless Transactions Architecture

### Executive summary

This repository implements a multi-chain gasless transfer proof-of-concept for EVM and Solana:

- EVM: Users sign an off-chain EIP-2612 permit (EIP-712 typed data) authorizing a relayer contract to spend tokens on their behalf. A relayer (server-side or CLI) pays the gas to submit an on-chain transaction that first calls `permit` and then executes token transfers: to the receiver and a fee to the relayer. The user never broadcasts a transaction or needs ETH for gas.
- Solana: Users sign an Ed25519 message over a deterministic payload. A relayer submits a transaction with an ed25519 verification instruction followed by a program instruction that releases escrowed SPL tokens to the receiver and a fee to the relayer, enforcing nonce and deadline checks.

The codebase includes: Solidity contracts, an Anchor Solana program, a Next.js frontend to create and sign permits, a Next.js API route acting as a relayer, and scripts/tests for local E2E.

### Top-level files and directories

Key paths at the repository root:

- `contracts/` – Solidity contracts (`ERC20Permit.sol`, `GaslessTokenTransfer.sol`)
- `programs/gasless_sol/` – Anchor Solana program and build artifacts
- `pages/` – Next.js app (UI and API relayer)
- `components/` – React components (`ConnectButton`, `Checkout`)
- `lib/` – Ethers ABIs/helpers
- `scripts/` – Hardhat scripts for deploy/sign/relay
- `tests/` and `test/` – Anchor/EVM tests
- `hardhat.config.js`, `Anchor.toml`, `next.config.js` – configuration
- `docs/` – deployment notes and this architecture doc
- `out/` and `artifacts/` – build outputs

Full listing snapshot is available in the analysis and can be reproduced via `ls -la`.

### Packages and dependencies

Runtime dependencies (excerpted from `package.json`):

- Frontend/React: `next`, `react`, `react-dom`
- Solana SDKs: `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`, `bn.js`, `tweetnacl`

Dev dependencies:

- EVM toolchain: `hardhat`, `@nomiclabs/hardhat-ethers`, `ethers@5`
- Tooling: `typescript`, `ts-node`, `dotenv`, `mocha`, `chai`

These confirm the presence of both EVM and Solana paths, with Hardhat/Ethers for EVM and Anchor/Web3.js for Solana.

Files not parsed: `package-lock.json` (too large to inline). No `yarn.lock` present.

### Components

- Front-end (Next.js):
  - `pages/index.js`, `components/ConnectButton.js`, `components/Checkout.js`
  - Builds and signs EIP-712 `Permit` off-chain using wallet (`_signTypedData`). Calls Relayer API.
- Relayer (Next.js API):
  - `pages/api/relay.js` – Receives signed payload, creates wallet from `RELAYER_PRIVATE_KEY`, and submits on-chain `send(...)` call. Relayer pays the gas.
- EVM Contracts:
  - `contracts/ERC20Permit.sol` – Minimal ERC-20 with EIP-2612 permit and nonces/DOMAIN_SEPARATOR.
  - `contracts/GaslessTokenTransfer.sol` – Relayer contract that calls `permit` then executes two `transferFrom`s (receiver, relayer fee).
- Solana Program:
  - `programs/gasless_sol/src/lib.rs` – Anchor program with `initialize_escrow` and `relayed_transfer` using ed25519 verify instruction validation and nonce/deadline checks.
- Datastore:
  - Ephemeral build files and JSON outputs under `out/` (e.g., signed permit payload). No persistent DB included.
- CI/Deployment:
  - Not configured in repo; scripts provided for local/devnet flows.

### How gasless is implemented (EVM)

User signs EIP-712 typed data for EIP-2612 `Permit`. The relayer then calls `GaslessTokenTransfer.send(...)` which performs `permit` and token transfers.

Key server/relayer flow:

```1:49:pages/api/relay.js
import { ethers } from 'ethers';
import { GASLESS_ABI } from '../../lib/ethers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const apiKeyRequired = process.env.RELAYER_API_KEY;
    if (apiKeyRequired) {
      const provided = req.headers['x-relayer-key'];
      if (!provided || provided !== apiKeyRequired) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: bad relayer key' });
      }
    }

    const RPC = process.env.LOCAL_RPC || process.env.TESTNET_RPC;
    const PK = process.env.RELAYER_PRIVATE_KEY;
    if (!RPC) return res.status(500).json({ ok: false, error: 'Missing RPC (LOCAL_RPC or TESTNET_RPC)' });
    if (!PK) return res.status(500).json({ ok: false, error: 'Missing RELAYER_PRIVATE_KEY' });

    const { token, gasless, owner, receiver, amountWei, feeWei, deadline, v, r, s } = req.body || {};
    const missing = ['token','gasless','owner','receiver','amountWei','feeWei','deadline','v','r','s'].filter(k => req.body?.[k] === undefined);
    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing fields: ${missing.join(', ')}` });
    }

    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);

    const gaslessContract = new ethers.Contract(gasless, GASLESS_ABI, wallet);

    const gasLimit = 300000; // conservative cap for demo
    const tx = await gaslessContract.send(
      token,
      owner,
      receiver,
      ethers.BigNumber.from(amountWei),
      ethers.BigNumber.from(feeWei),
      Number(deadline),
      Number(v),
      r,
      s,
      { gasLimit }
    );
    const receipt = await tx.wait();
    return res.status(200).json({ ok: true, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber, receipt });
  } catch (err) {
    const msg = err?.error?.message || err?.message || String(err);
```

Contract that executes permit and transfers:

```21:51:contracts/GaslessTokenTransfer.sol
contract GaslessTokenTransfer {
    /// @notice Execute a gasless token transfer using an EIP-2612 permit.
    function send(
        IERC20PermitLike token,
        address sender,
        address receiver,
        uint256 amount,
        uint256 fee,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Approve this relayer contract to spend user's tokens for amount + fee.
        token.permit(sender, address(this), amount + fee, deadline, v, r, s);

        // Transfer tokens to the receiver and the relayer (msg.sender) for fee.
        require(token.transferFrom(sender, receiver, amount), "TRANSFER_FAILED");
        require(token.transferFrom(sender, msg.sender, fee), "FEE_TRANSFER_FAILED");
    }
}
```

Frontend signs EIP-712 Permit via `_signTypedData` and posts to relayer:

```42:90:components/Checkout.js
  const signPermit = useCallback(async () => {
    try {
      if (!signer || !address) throw new Error('Connect wallet first');
      // ... validation ...
      const tokenC = new ethers.Contract(token, ERC20_ABI, signer);
      const name = await tokenC.name();
      const currentNonce = await tokenC.nonces(address);
      const decimals = 18; // demo token
      const amountWei = toWei(amount, decimals);
      const feeWei = toWei(fee, decimals);
      const value = amountWei.add(feeWei);
      const deadline = Math.floor(Date.now() / 1000) + Number(deadlineMin) * 60;

      const domain = { name, version: '1', chainId: Number(chainId), verifyingContract: token };
      const types = { Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]};
      const message = { owner: address, spender: gasless, value: value.toString(), nonce: currentNonce.toString(), deadline };

      const signature = await signer._signTypedData(domain, types, message);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      const payload = { token, gasless, owner: address /* ... amountWei, feeWei, deadline, v, r, s ... */ };
```

E2E scripts mirror the same flow via Hardhat:

```21:66:scripts/relayerSend.js
  const [relayer] = await ethers.getSigners();
  const gasless = await ethers.getContractAt('GaslessTokenTransfer', cfg.GASLESS_ADDRESS);
  // ...
  const tx = await gasless
    .connect(relayer)
    .send(
      cfg.TOKEN_ADDRESS,
      cfg.SENDER,
      cfg.RECEIVER,
      cfg.AMOUNT,
      cfg.FEE,
      cfg.DEADLINE,
      cfg.V,
      cfg.R,
      cfg.S
    );
  const receipt = await tx.wait();
```

### How gasless is implemented (Solana)

Users sign a deterministic message; relayer submits a transaction with ed25519 verify instruction followed by the program instruction that validates the first instruction, checks nonce/deadline, then transfers from PDA escrow to receiver and relayer fee accounts.

Program overview and core checks:

```1:26:programs/gasless_sol/src/lib.rs
#[program]
pub mod gasless_sol {
    use super::*;
    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, bump: u8) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.owner = ctx.accounts.owner.key();
        state.mint = ctx.accounts.mint.key();
        state.escrow = ctx.accounts.escrow_ata.key();
        state.bump = bump;
        state.last_nonce = 0;
        require_keys_eq!(ctx.accounts.escrow_ata.owner, ctx.accounts.pda.key());
        require_keys_eq!(ctx.accounts.escrow_ata.mint, ctx.accounts.mint.key());
        Ok(())
    }
```

```28:69:programs/gasless_sol/src/lib.rs
    pub fn relayed_transfer(
        ctx: Context<RelayedTransfer>,
        amount: u64,
        fee: u64,
        deadline: i64,
        sig_pubkey: [u8; 32],
        _sig: Vec<u8>,
        nonce: u64,
    ) -> Result<()> {
        // Manual account validations ... PDA and ATA checks ...
        let clock = Clock::get()?;
        require!(deadline >= clock.unix_timestamp, GaslessError::DeadlineExpired);
        // Nonce must be increasing
        require!(nonce > state_data.last_nonce, GaslessError::InvalidNonce);
        // Instruction 0 must be ed25519 verification
        let ed_ix = load_instruction_at_checked
```

Client relayer sends the ed25519 verify + program instructions in order:

```55:74:client/solana/relayer_send.ts
  const program = new anchor.Program(idl!, programId, new anchor.AnchorProvider(conn, new anchor.Wallet(relayer), {}));
  const progIx = await program.methods.relayedTransfer(amount, fee, deadline, owner.toBytes(), signature, nonce).accounts({
    relayer: relayer.publicKey,
    mint,
    pda: (await PublicKey.findProgramAddress([Buffer.from('escrow'), owner.toBuffer(), mint.toBuffer()], programId))[0],
    escrowAta,
    receiverAta,
    relayerAta,
    state,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
  }).instruction();
  const tx = new Transaction().add(edIx, progIx);
  tx.feePayer = relayer.publicKey;
  // ... sendRawTransaction ...
```

### Configuration and networks

- Hardhat networks:

```14:29:hardhat.config.js
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: process.env.LOCAL_RPC || 'http://127.0.0.1:8545' },
    sepolia: { url: process.env.SEPOLIA_RPC || process.env.TESTNET_RPC, accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },
    polygonAmoy: { url: process.env.AMOY_RPC || 'https://amoy-polygon.invalid', accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] }
  }
```

- Anchor provider and program IDs:

```1:16:Anchor.toml
[programs.localnet]
gasless_sol = "EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e"

[programs.devnet]
gasless_sol = "EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

### Architecture diagram (Mermaid)

```mermaid
flowchart LR
  User[User Browser/Wallet]
  API[Relayer API (Next.js)]
  RPC[(EVM RPC / Solana RPC)]
  EVMContract[GaslessTokenTransfer.sol]
  SolProg[gasless_sol (Anchor Program)]

  User -- 1. Fetch nonce/domain --> User
  User -- 2. Sign permit (EIP-712) or ed25519 message --> User
  User -- 3. POST signed payload --> API
  API -- 4. Verify headers/env, build wallet --> API
  API -- 5a. EVM send(token, owner, receiver, amount, fee, deadline, v,r,s) --> RPC
  RPC -- tx --> EVMContract
  EVMContract -- permit + transferFroms --> RPC
  API -- 6. Return tx hash/receipt --> User

  %% Solana path via CLI client
  User -. ed25519 payload .-> API
  API -. or CLI .-> RPC
  RPC -- tx (ed25519 ix + relayed_transfer) --> SolProg
  SolProg -- escrow transfer + fee --> RPC
```

### Sequence diagram (Mermaid)

```mermaid
sequenceDiagram
  participant U as User (Browser)
  participant A as Relayer API
  participant R as EVM RPC
  participant C as GaslessTokenTransfer

  U->>U: Read token.nonces(owner), domain data
  U->>U: signTypedData (EIP-712 Permit)
  U->>A: POST /api/relay { token, gasless, owner, receiver, amountWei, feeWei, deadline, v,r,s }
  A->>R: send(token, owner, receiver, amount, fee, deadline, v,r,s)
  R->>C: Execute transaction
  C->>R: token.permit(...); transferFrom(owner->receiver, amount); transferFrom(owner->relayer, fee)
  R->>A: Receipt
  A->>U: txHash, blockNumber
```

### Security considerations

- Nonce and replay protection (EVM):
  - Uses EIP-2612 `nonces(owner)` from the token for the Permit. Contract itself does not track nonces; relies on token’s permit logic and deadline.
- Deadline enforcement:
  - Signed payload includes `deadline` checked by the token’s `permit`. Relayer should reject payloads past deadline.
- Signature validation:
  - EVM: Wallet signs EIP-712 typed data; `permit` verifies signature and domain separator (token-side). Frontend uses `_signTypedData` to avoid `personal_sign` ambiguity.
  - Solana: Program expects ed25519 verify instruction at index 0; validates message contents, nonce, and deadline.
- Relayer fund management:
  - EVM: Relayer pays ETH gas; receives token `fee` via contract. Ensure sufficient ETH balance and verify `fee` vs gas economics.
  - Solana: Relayer pays SOL for tx fees; receives SPL token fee from escrow.
- Rate limiting and auth:
  - API supports optional `RELAYER_API_KEY` header check. Consider IP rate limiting and payload schema validation.
- Domain separator and token compatibility:
  - Different tokens may diverge in permit implementation. Demo token is included to ensure consistent behavior; production should support token-specific domains.
- Replay across chains or contracts:
  - EIP-712 domain binds `chainId` and `verifyingContract`. Ensure frontend and relayer agree on chain and addresses.

### Suggested improvements

- EIP-2771 / MinimalForwarder: Introduce a trusted forwarder pattern for general meta-transactions, not just token permits, enabling broader method forwarding with relayer verification.
- EIP-4337 Paymaster: Support account abstraction and sponsored gas without coupling to token fees; implement Paymaster policies and/or off-chain fee quotes.
- Robust relayer validation:
  - Verify `token` indeed implements `permit`, or use a registry of supported tokens with their domain rules.
  - Add schema validation, anti-replay cache on relayer, and deadline enforcement before sending.
- Observability and rate limiting:
  - Add structured logging, Prometheus metrics, and per-IP/user rate limits.
- Fee estimation & pricing:
  - Integrate gas price oracles and token/USD price feeds to auto-size the `fee` with margin, or implement an off-chain quoting endpoint.
- Solana ed25519 parsing hardening:
  - Strictly parse and validate ed25519 instruction fields (offsets/lengths) and verify exact message layout.
- Persistence:
  - Optional DB for request/response audit logs, replay caches, and nonce mirrors.

### Appendix: Additional references

Token with permit (EIP-2612) used for demo:

```1:26:contracts/ERC20Permit.sol
contract ERC20Permit {
    // ... metadata & storage ...
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;
    uint256 internal immutable INITIAL_CHAIN_ID;
    bytes32 public DOMAIN_SEPARATOR;
    mapping(address => uint256) public nonces;
    // events ...
}
```

### Files that could not be parsed

- `package-lock.json` (too large to inline here).



