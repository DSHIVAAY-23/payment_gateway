// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
    function transfer(address to, uint256 value) external returns (bool);
}

contract GaslessTokenTransferWithFee {
    address public owner;
    address public feeCollector;
    uint16 public feeBps; // basis points (100 = 1%)

    event FeeParamsUpdated(address indexed owner, address indexed feeCollector, uint16 feeBps);
    event GaslessTransfer(address indexed token, address indexed sender, address indexed receiver, uint256 amount, uint256 fee, uint256 deadline, address relayer);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address _feeCollector, uint16 _feeBps) {
        require(_feeCollector != address(0), "INVALID_FEE_COLLECTOR");
        owner = msg.sender;
        feeCollector = _feeCollector;
        feeBps = _feeBps;
        emit FeeParamsUpdated(msg.sender, feeCollector, feeBps);
    }

    function setFeeParams(address _feeCollector, uint16 _feeBps) external onlyOwner {
        require(_feeCollector != address(0), "INVALID_FEE_COLLECTOR");
        require(_feeBps <= 1000, "MAX_10_PERCENT");
        feeCollector = _feeCollector;
        feeBps = _feeBps;
        emit FeeParamsUpdated(msg.sender, feeCollector, feeBps);
    }

    /// @notice User signs permit for `amount`. Contract deducts feeBps and forwards net+fee.
    function sendWithFee(
        IERC20PermitLike token,
        address sender,
        address receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(feeCollector != address(0), "NO_FEE_COLLECTOR");

        // approve this contract for exactly `amount` from sender
        token.permit(sender, address(this), amount, deadline, v, r, s);

        uint256 fee = (amount * uint256(feeBps)) / 10000;
        uint256 net = amount - fee;

        require(net > 0, "AMOUNT_TOO_SMALL_AFTER_FEE");

        // Transfer net to receiver, fee to feeCollector
        require(token.transferFrom(sender, receiver, net), "TRANSFER_TO_RECEIVER_FAILED");
        require(token.transferFrom(sender, feeCollector, fee), "TRANSFER_FEE_FAILED");

        emit GaslessTransfer(address(token), sender, receiver, amount, fee, deadline, msg.sender);
    }
}

