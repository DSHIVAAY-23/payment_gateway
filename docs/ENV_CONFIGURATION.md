# Environment Configuration Guide

This repository uses separate environment configuration files for different payment flows to simplify switching between pyUSD, USDT, and Solana operations.

## Overview

Three separate `.env` files are provided:

1. **`.env.pyusd`** - Configuration for pyUSD gasless flow using EIP-2612 permits
2. **`.env.usdt`** - Configuration for USDT gasless flow using Permit2
3. **`.env.solana`** - Configuration for Solana gasless flow

## Quick Start

### Option 1: Use the Switch Script (Recommended)

```bash
# Switch to pyUSD configuration
source scripts/switch_env.sh pyusd

# Switch to USDT configuration
source scripts/switch_env.sh usdt

# Switch to Solana configuration
source scripts/switch_env.sh solana
```

The switch script will:
- Backup your current `.env` file
- Copy the selected configuration to `.env`
- Load all environment variables into your current shell

### Option 2: Manual Copy

```bash
# For pyUSD flow
cp .env.pyusd .env

# For USDT flow
cp .env.usdt .env

# For Solana flow
cp .env.solana .env
```

Then source the file:
```bash
source .env
# or
export $(cat .env | xargs)
```

### Option 3: Use load_env.sh

```bash
source scripts/load_env.sh .env.pyusd
source scripts/load_env.sh .env.usdt
source scripts/load_env.sh .env.solana
```

## Creating the Environment Files

If the `.env.*` files don't exist, create them:

```bash
bash scripts/create_env_files.sh
```

This will generate all three configuration files with default values.

## Configuration Details

### .env.pyusd (EIP-2612 Flow)

**Purpose**: Gasless payments using pyUSD with EIP-2612 permit signatures

**Key Variables**:
- `GASLESS_ADDRESS`: Deployed `GaslessTokenGatewayDualFee` contract address
- `TOKEN_ADDRESS`: pyUSD token address on Sepolia (`0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`)
- `PRIVATE_KEY`: Owner's private key (signs the permit)
- `RELAYER_PRIVATE_KEY`: Relayer's private key (pays gas)
- `RECEIVER`: Merchant address receiving payment
- `CUT_COLLECTOR`: Address receiving the cut fee
- `CUT_BPS`: Cut fee in basis points (100 = 1%)
- `AMOUNT`: Payment amount in human-readable format

**Usage Example**:
```bash
source scripts/switch_env.sh pyusd

# Sign permit
node scripts/signPermit_dual_fee.js

# Execute transaction
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

### .env.usdt (Permit2 Flow)

**Purpose**: Gasless payments using USDT with Permit2 signatures

**Key Variables**:
- `GASLESS_ADDRESS`: Deployed `GaslessPermit2GatewayDualFee` contract address
- `PERMIT2_ADDRESS`: Permit2 contract address (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)
- `TOKEN_ADDRESS`: USDT token address on Sepolia (`0xCd56D421E5E623eB12d74712b463E9A336B6f287`)
- `PRIVATE_KEY`: Owner's private key (signs the permit)
- `RELAYER_PRIVATE_KEY`: Relayer's private key (pays gas)
- `RECEIVER`: Merchant address receiving payment
- `CUT_COLLECTOR`: Address receiving the cut fee
- `CUT_BPS`: Cut fee in basis points (100 = 1%)
- `AMOUNT`: Payment amount in human-readable format

**Usage Example**:
```bash
source scripts/switch_env.sh usdt

# Sign permit (requires Permit2 SDK)
node scripts/sign_permit2_example.js

# Execute transaction
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```

### .env.solana (Solana Flow)

**Purpose**: Gasless payments on Solana using partial transaction signing

**Key Variables**:
- `SOLANA_URL`: Solana RPC endpoint (default: `https://api.devnet.solana.com`)
- `MINT_ADDRESS`: Token mint address (e.g., mockUSDT, USDC, pyUSD)
- `TOKEN_PROGRAM_ID`: Token program ID (legacy or Token-2022)
- `ASSOCIATED_TOKEN_PROGRAM_ID`: ATA program ID
- `USER_KEYPATH`: Path to user keypair JSON file
- `RELAYER_KEYPATH`: Path to relayer keypair JSON file
- `FEE_KEYPATH`: Path to fee collector keypair JSON file
- `USER_PUBKEY`: User's public key (optional, derived from keypair)
- `FEE_COLLECTOR_PUBKEY`: Fee collector's public key
- `MERCHANT_PUBKEY`: Merchant's public key (can be passed as argument)

**Usage Example**:
```bash
source scripts/switch_env.sh solana

# Build partial transaction
node scripts/build_partial_with_fee.js <merchant_pubkey> 1.23 demo-order-001

# Validate and submit
node scripts/relayer_validate_and_submit.js <merchant_pubkey>
```

## Environment Variables Reference

### Common Variables (All Flows)

| Variable | Description | Example |
|----------|-------------|---------|
| `SEPOLIA_RPC` | Sepolia RPC endpoint | `https://sepolia.infura.io/v3/YOUR_KEY` |
| `PRIVATE_KEY` | Owner's private key | `0x...` |
| `RELAYER_PRIVATE_KEY` | Relayer's private key | `0x...` |
| `RECEIVER` | Merchant/receiver address | `0x...` |
| `AMOUNT` | Payment amount | `5` |

### pyUSD Specific

| Variable | Description | Example |
|----------|-------------|---------|
| `GASLESS_ADDRESS` | Gateway contract address | `0xE43E22639a7acD0b08168Ef320ee3F46c534d783` |
| `TOKEN_ADDRESS` | pyUSD token address | `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9` |
| `CUT_COLLECTOR` | Cut fee collector address | `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` |
| `CUT_BPS` | Cut fee in basis points | `100` (1%) |

### USDT Specific

| Variable | Description | Example |
|----------|-------------|---------|
| `GASLESS_ADDRESS` | Permit2 gateway contract address | `0x...` |
| `PERMIT2_ADDRESS` | Permit2 contract address | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `TOKEN_ADDRESS` | USDT token address | `0xCd56D421E5E623eB12d74712b463E9A336B6f287` |
| `CUT_COLLECTOR` | Cut fee collector address | `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2` |
| `CUT_BPS` | Cut fee in basis points | `100` (1%) |

### Solana Specific

| Variable | Description | Example |
|----------|-------------|---------|
| `SOLANA_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `MINT_ADDRESS` | Token mint address | `8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr` |
| `TOKEN_PROGRAM_ID` | Token program ID | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| `ASSOCIATED_TOKEN_PROGRAM_ID` | ATA program ID | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |
| `USER_KEYPATH` | User keypair path | `user_dev_keypair.json` |
| `RELAYER_KEYPATH` | Relayer keypair path | `~/.config/solana/id.json` |
| `FEE_KEYPATH` | Fee collector keypair path | `fee_collector_keypair.json` |
| `USER_PUBKEY` | User public key | `7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5` |
| `FEE_COLLECTOR_PUBKEY` | Fee collector public key | `4sP5gTv67xUYGvDrBJJSgnZsyTNq4ewurPyF7ozGYpvT` |

## Workflow Examples

### Complete pyUSD Flow

```bash
# 1. Switch to pyUSD configuration
source scripts/switch_env.sh pyusd

# 2. Sign permit
node scripts/signPermit_dual_fee.js

# 3. Execute transaction via relayer
npx hardhat run scripts/relayer_send_dual_fee.js --network sepolia
```

### Complete USDT Flow

```bash
# 1. Switch to USDT configuration
source scripts/switch_env.sh usdt

# 2. Deploy Permit2 gateway (if not already deployed)
npx hardhat run scripts/deploy_permit2_gateway.js --network sepolia
# Update GASLESS_ADDRESS in .env.usdt with the deployed address

# 3. Sign permit
node scripts/sign_permit2_example.js

# 4. Execute transaction via relayer
npx hardhat run scripts/relayer_send_permit2_dual.js --network sepolia
```

### Complete Solana Flow

```bash
# 1. Switch to Solana configuration
source scripts/switch_env.sh solana

# 2. Build partial transaction
node scripts/build_partial_with_fee.js GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd 1.23 demo-order-001

# 3. Validate and submit
node scripts/relayer_validate_and_submit.js GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd
```

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit `.env` files**: These files contain private keys and should be in `.gitignore`
2. **Backup existing `.env`**: The switch script automatically backs up your current `.env` before switching
3. **Use separate keys for production**: The provided keys are for testing only
4. **Protect private keys**: Use proper file permissions (`chmod 600 .env*`)
5. **Rotate keys regularly**: Change private keys if they're exposed

## Troubleshooting

### Issue: "Environment file not found"

**Solution**: Run the creation script:
```bash
bash scripts/create_env_files.sh
```

### Issue: "Variables not loading"

**Solution**: Make sure to source the file:
```bash
source scripts/switch_env.sh pyusd
# or
source .env
```

### Issue: "Wrong network or contract address"

**Solution**: Update the relevant variables in the `.env.*` file:
```bash
# Edit the file
nano .env.pyusd

# Then switch again
source scripts/switch_env.sh pyusd
```

### Issue: "Script can't find keypair"

**Solution**: Check that keypair paths are correct and files exist:
```bash
# For Solana
ls -la user_dev_keypair.json
ls -la ~/.config/solana/id.json
```

## Best Practices

1. **Use the switch script**: It handles backups and loading automatically
2. **Verify configuration**: After switching, verify key variables are set:
   ```bash
   echo $GASLESS_ADDRESS
   echo $TOKEN_ADDRESS
   ```
3. **Keep backups**: The switch script creates timestamped backups
4. **Document custom values**: If you modify the `.env.*` files, document why
5. **Test after switching**: Run a test transaction to verify the configuration

## File Structure

```
/data/payment_gateway/
├── .env                    # Active configuration (symlink or copy)
├── .env.pyusd              # pyUSD configuration
├── .env.usdt               # USDT configuration
├── .env.solana             # Solana configuration
├── .env.backup.*           # Automatic backups
└── scripts/
    ├── create_env_files.sh # Creates .env.* files
    ├── switch_env.sh       # Switches between configurations
    └── load_env.sh         # Generic env loader
```

## Additional Resources

- [Environment Variables Reference](./ENV_VARS.md) - Detailed variable documentation
- [pyUSD Flow Documentation](./PYUSD_FLOW_NEW_OWNER.md) - Complete pyUSD flow example
- [Solana Devnet Guide](./SOLANA_DEVNET_MOCK_USDT.md) - Solana setup guide

---

**Last Updated**: 2025-01-30

