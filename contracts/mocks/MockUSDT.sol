// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDT
/// @notice Simple ERC20 with 6 decimals for testing Permit2 flows on Sepolia
contract MockUSDT is ERC20 {
	uint8 private constant _DECIMALS = 6;

	constructor(string memory name_, string memory symbol_, uint256 initialSupply) ERC20(name_, symbol_) {
		// initialSupply should be provided in smallest units (6 decimals)
		_mint(msg.sender, initialSupply);
	}

	function decimals() public pure override returns (uint8) {
		return _DECIMALS;
	}
}


