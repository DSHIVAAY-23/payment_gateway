// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Use the npm package import for the interface
import "@uniswap/permit2/src/interfaces/ISignatureTransfer.sol";

/// @title Permit2 SignatureTransfer Gateway
/// @notice Forwards a Permit2 `permitTransferFrom` operation to the canonical Permit2 contract.
contract Permit2SignatureGateway {
    ISignatureTransfer public immutable PERMIT2;

    event PermitTransferExecuted(address indexed operator, address indexed token, address indexed to, uint256 amount);
    event PermitTransferBatchExecuted(address indexed operator, address indexed token);

    constructor(address permit2Address) {
        require(permit2Address != address(0), "zero permit2");
        PERMIT2 = ISignatureTransfer(permit2Address);
    }

    /// Accept a Permit2 SignatureTransfer permit and forward it to Permit2.
    /// The caller provides the PermitTransferFrom struct and the user's signature.
    function acceptSignatureAndTransfer(
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external {
        // Execute the signature-transfer in Permit2 (atomic single call).
        PERMIT2.permitTransferFrom(permit, signature);

        // Emit events for monitoring/reconciliation. Emit basic info for first transfer
        if (permit.transfers.length > 0) {
            emit PermitTransferExecuted(msg.sender, permit.details.token, permit.transfers[0].to, permit.transfers[0].amount);
        }
        emit PermitTransferBatchExecuted(msg.sender, permit.details.token);
    }
}

