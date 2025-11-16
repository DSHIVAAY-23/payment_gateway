// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/permit2/src/interfaces/ISignatureTransfer.sol";

/// @title GaslessPermit2GatewayDualFee
/// @notice Pulls tokens via Permit2 and splits to merchant (net), feeCollector (fee), and cutCollector (cut)
contract GaslessPermit2GatewayDualFee is ReentrancyGuard, Ownable {
	using SafeERC20 for IERC20;

	ISignatureTransfer public immutable PERMIT2;

	address public feeCollector;
	address public cutCollector;
	uint16 public feeBps; // e.g. 50 = 0.5%
	uint16 public cutBps; // e.g. 100 = 1%

	event ParamsUpdated(address indexed owner, address feeCollector, address cutCollector, uint16 feeBps, uint16 cutBps);
	event PulledAndSplit(address indexed token, address indexed ownerAddr, address indexed receiver, uint256 amount, uint256 fee, uint256 cut, address relayer);

	error InvalidCollector();
	error BpsTooHigh();
	error AmountTooSmall();

	/// @param permit2Address Address of Uniswap Permit2 contract
	/// @param _feeCollector Recipient of platform fee
	/// @param _cutCollector Recipient of gateway cut
	/// @param _feeBps Fee basis points (max 2000 = 20%)
	/// @param _cutBps Cut basis points (max 2000 = 20%)
	constructor(
		address permit2Address,
		address _feeCollector,
		address _cutCollector,
		uint16 _feeBps,
		uint16 _cutBps
	) Ownable(msg.sender) {
		if (permit2Address == address(0) || _feeCollector == address(0) || _cutCollector == address(0)) revert InvalidCollector();
		if (_feeBps > 2000 || _cutBps > 2000) revert BpsTooHigh();
		PERMIT2 = ISignatureTransfer(permit2Address);
		feeCollector = _feeCollector;
		cutCollector = _cutCollector;
		feeBps = _feeBps;
		cutBps = _cutBps;
		emit ParamsUpdated(msg.sender, feeCollector, cutCollector, feeBps, cutBps);
	}

	/// @notice Owner can update collectors and fee basis points (safety capped)
	function setParams(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps) external onlyOwner {
		if (_feeCollector == address(0) || _cutCollector == address(0)) revert InvalidCollector();
		if (_feeBps > 2000 || _cutBps > 2000) revert BpsTooHigh();
		feeCollector = _feeCollector;
		cutCollector = _cutCollector;
		feeBps = _feeBps;
		cutBps = _cutBps;
		emit ParamsUpdated(msg.sender, feeCollector, cutCollector, feeBps, cutBps);
	}

	/// @notice Pull via Permit2 and split to merchant + feeCollector + cutCollector
	/// @dev Assumes a single permitted item in the batch (permitted[0]) and that transferDetails pulls from owner to this gateway
	function sendWithPermit2DualCollection(
		ISignatureTransfer.PermitBatchTransferFrom calldata permit,
		ISignatureTransfer.SignatureTransferDetails[] calldata transferDetails,
		address ownerAddr,
		bytes calldata signature,
		address receiver
	) external nonReentrant {
		// Execute Permit2 pull (pulls from owner to transferDetails[].to)
		PERMIT2.permitTransferFrom(permit, transferDetails, ownerAddr, signature);

		// Infer the token and amount from the first permitted entry
		ISignatureTransfer.TokenPermissions memory perm = permit.permitted[0];
		address token = perm.token;
		uint256 amount = perm.amount;

		// Compute splits
		uint256 fee = (amount * uint256(feeBps)) / 10000;
		uint256 cut = (amount * uint256(cutBps)) / 10000;
		if (amount < fee + cut + 1) revert AmountTooSmall();
		uint256 net = amount - fee - cut;

		// Transfer out from this gateway using SafeERC20
		IERC20 erc20 = IERC20(token);
		erc20.safeTransfer(receiver, net);
		erc20.safeTransfer(feeCollector, fee);
		erc20.safeTransfer(cutCollector, cut);

		emit PulledAndSplit(token, ownerAddr, receiver, amount, fee, cut, msg.sender);
	}
}


