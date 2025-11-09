# GaslessTokenTransferWithFee Deployment - Sepolia

## Contract Deployment

Successfully deployed `GaslessTokenTransferWithFee.sol` to Sepolia testnet.

### Deployment Details

- **Contract**: `GaslessTokenTransferWithFee.sol`
- **Network**: Sepolia Testnet
- **Chain ID**: 11155111
- **Contract Address**: `0xa1bC72c8D67DD27795ffcF823930A97327b12414`
- **Owner**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Fee Collector**: `0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7` (Account 2)
- **Fee BPS**: 100 (1%)
- **Deployment Transaction**: https://sepolia.etherscan.io/address/0xa1bC72c8D67DD27795ffcF823930A97327b12414

### Test Transaction

- **Transaction Hash**: `0x6a43ff3fdc6cc357b35a7eb5a2b8601ae83bf6763633621a4f36acff0266b875`
- **Block**: 9593793
- **Etherscan**: https://sepolia.etherscan.io/tx/0x6a43ff3fdc6cc357b35a7eb5a2b8601ae83bf6763633621a4f36acff0266b875
- **Fee Collector**: `0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7` (receives 1% fee)

### Key Differences from GaslessTokenTransfer

| Feature | GaslessTokenTransfer | GaslessTokenTransferWithFee |
|---------|---------------------|----------------------------|
| **Fee Model** | Fixed fee amount | Percentage-based (BPS) |
| **Permit Value** | `amount + fee` | `amount` only |
| **Fee Recipient** | Relayer (`msg.sender`) | Configurable `feeCollector` |
| **Owner Control** | None | Can update fee params |
| **Use Case** | Simple relayer fee | Merchant payments with platform fee |

### Contract Functions

1. **`sendWithFee()`** - Main function for gasless transfers with fee deduction
   - User signs permit for `amount`
   - Contract calculates fee: `fee = (amount * feeBps) / 10000`
   - Transfers `net = amount - fee` to receiver
   - Transfers `fee` to fee collector

2. **`setFeeParams()`** - Owner-only function to update fee collector and BPS
   - Maximum fee: 10% (1000 BPS)

### Usage Example

```bash
# 1. Deploy
export FEE_COLLECTOR="0x..."
export FEE_BPS="100"  # 1%
npx hardhat run scripts/deployGaslessWithFee.js --network sepolia

# 2. Sign permit
export GASLESS_ADDRESS="0xa1bC72c8D67DD27795ffcF823930A97327b12414"
export AMOUNT="10"
export RECEIVER="0x..."
node scripts/signPermit_pyusd_for_fee.js

# 3. Relayer sends
export RELAYER_PRIVATE_KEY="0x..."
npx hardhat run scripts/relayer_send_with_fee.js --network sepolia
```

### Fee Calculation Example

For `amount = 100 PYUSD` and `feeBps = 100` (1%):
- Fee = `(100 * 100) / 10000 = 1 PYUSD`
- Net to receiver = `100 - 1 = 99 PYUSD`
- Fee to collector = `1 PYUSD`

### Files Created

- `contracts/GaslessTokenTransferWithFee.sol` - Contract source
- `scripts/deployGaslessWithFee.js` - Deployment script
- `scripts/signPermit_pyusd_for_fee.js` - Permit signing script
- `scripts/relayer_send_with_fee.js` - Relayer execution script
- `docs/README_DEPLOY_FEE.md` - Quick start guide

### Security Notes

- Owner can update fee parameters (up to 10% max)
- Fee collector cannot be zero address
- Amount must be greater than fee (net > 0)
- All transfers are atomic (all-or-nothing)

