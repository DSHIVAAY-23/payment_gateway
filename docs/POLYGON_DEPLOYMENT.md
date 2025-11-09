# Polygon Amoy Testnet Deployment

## GaslessTokenTransfer Contract Deployment

Successfully deployed `GaslessTokenTransfer.sol` to Polygon Amoy testnet.

### Deployment Details

- **Contract**: `GaslessTokenTransfer.sol`
- **Network**: Polygon Amoy Testnet
- **Chain ID**: 80002
- **Contract Address**: `0xD26af6D835Bb2553AfaF230671a0De6D38AEF35E`
- **Deployer**: `0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2`
- **Transaction Hash**: `0xcb31e777336a70f2948692aed5e4caa5dbac43e29817f796e84667d46a88a5d3`
- **Deployment Date**: 2025-11-09

### Verification Links

- **Polygonscan Amoy**: https://amoy.polygonscan.com/address/0xD26af6D835Bb2553AfaF230671a0De6D38AEF35E
- **Transaction**: https://amoy.polygonscan.com/tx/0xcb31e777336a70f2948692aed5e4caa5dbac43e29817f796e84667d46a88a5d3

### Contract Verification

This is the same `GaslessTokenTransfer.sol` contract used on Sepolia:
- ✅ Implements EIP-2612 permit-based gasless transfers
- ✅ Single `send()` function that atomically executes permit + transfers
- ✅ Works with any ERC-20 token that supports EIP-2612 permit

### Usage

To use this contract on Polygon Amoy:

```bash
# Set environment variables
export AMOY_RPC="https://rpc-amoy.polygon.technology"
export PRIVATE_KEY="<your-private-key>"
export GASLESS_ADDRESS="0xD26af6D835Bb2553AfaF230671a0De6D38AEF35E"
export RELAYER_PRIVATE_KEY="<relayer-private-key>"  # Optional: separate relayer

# Deploy or use with any EIP-2612 compatible token on Polygon Amoy
npx hardhat run scripts/gaslessPyUSD.js --network polygonAmoy
```

### Network Comparison

| Network | Chain ID | Contract Address | Status |
|---------|----------|------------------|--------|
| Sepolia | 11155111 | `0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E` | ✅ Deployed |
| Polygon Amoy | 80002 | `0xD26af6D835Bb2553AfaF230671a0De6D38AEF35E` | ✅ Deployed |

### Contract Code

The deployed contract is identical to `contracts/GaslessTokenTransfer.sol`:

```solidity
contract GaslessTokenTransfer {
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
        token.permit(sender, address(this), amount + fee, deadline, v, r, s);
        require(token.transferFrom(sender, receiver, amount), "TRANSFER_FAILED");
        require(token.transferFrom(sender, msg.sender, fee), "FEE_TRANSFER_FAILED");
    }
}
```

### Next Steps

1. **Test with a token on Polygon Amoy**: Find or deploy an EIP-2612 compatible token
2. **Update scripts**: Modify `gaslessPyUSD.js` or create a new script for Polygon tokens
3. **Verify contract**: Optionally verify the contract source code on Polygonscan for transparency

### Notes

- Polygon Amoy uses MATIC for gas fees (same as mainnet)
- The contract works identically on all EVM-compatible chains
- Ensure tokens on Polygon Amoy support EIP-2612 permit before using

