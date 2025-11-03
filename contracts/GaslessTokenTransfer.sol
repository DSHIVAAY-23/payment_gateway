// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title GaslessTokenTransfer
/// @notice Relayer contract to execute ERC20 transfers using EIP-2612 permits.
/// @dev The relayer obtains an off-chain signature and pays gas; user approves amount+fee via permit.
interface IERC20PermitLike {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract GaslessTokenTransfer {
    /// @notice Execute a gasless token transfer using an EIP-2612 permit.
    /// @param token The ERC20 token supporting `permit`.
    /// @param sender The token owner who signed the permit.
    /// @param receiver The recipient of the token transfer.
    /// @param amount Amount of tokens to send to `receiver`.
    /// @param fee Fee paid to `msg.sender` (relayer) in tokens.
    /// @param deadline Deadline from the signed permit.
    /// @param v ECDSA v value.
    /// @param r ECDSA r value.
    /// @param s ECDSA s value.
    /// @dev We approve `amount + fee` in a single permit to avoid multiple signatures.
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


