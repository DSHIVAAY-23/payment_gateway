# Quick start — deploy & test GaslessTokenTransferWithFee on Sepolia

## 1) Install deps

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers dotenv
```

## 2) Compile

```bash
npx hardhat compile
```

## 3) Deploy to Sepolia

```bash
export SEPOLIA_RPC="https://chain.instanodes.io/eth-testnet/?apikey=YOUR_KEY"
export PRIVATE_KEY="0x..."            # deployer/owner (will be contract owner)
export FEE_COLLECTOR="0xYourFeeCollectorAddress"
export FEE_BPS="100"                 # 100 = 1%

npx hardhat run scripts/deployGaslessWithFee.js --network sepolia
```

Note printed gateway address → set `GASLESS_ADDRESS` env var if needed

## 4) Produce permit (owner signs)

```bash
export GASLESS_ADDRESS="0x..."      # gateway deployed address
export PRIVATE_KEY="0x..."          # owner's private key (owner of pyUSD who will sign)
export SEPOLIA_RPC="https://..."
export AMOUNT="10"                  # human amount
export RECEIVER="0x..."
export FEE_BPS="100"

node scripts/signPermit_pyusd_for_fee.js
```

This writes `out/pyusd_permit_fee.json`

## 5) Relayer sends tx

### Option A: use Hardhat account as relayer (no extra env)

```bash
npx hardhat run scripts/relayer_send_with_fee.js --network sepolia
```

### Option B: use a dedicated relayer private key

```bash
export RELAYER_PRIVATE_KEY="0x..."  # relayer EOA (must have ETH on Sepolia)
npx hardhat run scripts/relayer_send_with_fee.js --network sepolia
```

## 6) Verify balances on Sepolia Etherscan

Check that:
- Receiver received `amount - fee`
- Fee collector received `fee`
- Owner balance decreased by `amount`

## Differences from GaslessTokenTransfer

- **Fee model**: Percentage-based fee (bps) deducted from amount
- **Permit value**: User signs for `amount` only (not amount+fee)
- **Fee collector**: Separate address receives the fee
- **Owner control**: Owner can update fee collector and fee BPS

