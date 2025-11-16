// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @dev Minimal IERC20 and permit interfaces
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

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
}

contract GaslessTokenGatewayDualFee {
    address public owner;
    address public feeCollector;    // first collector (example: platform fee)
    address public cutCollector;    // second collector (example: gateway cut)
    uint16 public feeBps;           // basis points for fee (e.g. 50 = 0.5%)
    uint16 public cutBps;           // basis points for cut (e.g. 100 = 1%)

    event ParamsUpdated(address indexed owner, address feeCollector, address cutCollector, uint16 feeBps, uint16 cutBps);
    event PulledAndSplit(address indexed token, address indexed sender, address indexed receiver, uint256 amount, uint256 fee, uint256 cut, address relayer);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps) {
        require(_feeCollector != address(0) && _cutCollector != address(0), "INVALID_COLLECTOR");
        require(_feeBps <= 2000 && _cutBps <= 2000, "BPS_TOO_HIGH"); // safety cap 20% default
        owner = msg.sender;
        feeCollector = _feeCollector;
        cutCollector = _cutCollector;
        feeBps = _feeBps;
        cutBps = _cutBps;
        emit ParamsUpdated(owner, feeCollector, cutCollector, feeBps, cutBps);
    }

    function setParams(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps) external onlyOwner {
        require(_feeCollector != address(0) && _cutCollector != address(0), "INVALID_COLLECTOR");
        require(_feeBps <= 2000 && _cutBps <= 2000, "BPS_TOO_HIGH");
        feeCollector = _feeCollector;
        cutCollector = _cutCollector;
        feeBps = _feeBps;
        cutBps = _cutBps;
        emit ParamsUpdated(msg.sender, feeCollector, cutCollector, feeBps, cutBps);
    }

    /// @notice User signs permit for `amount`. Gateway pulls `amount`, computes fee & cut (both from `amount`), and forwards funds.
    /// @param token IERC20 token contract
    /// @param permitToken token contract implementing permit (usually same address)
    /// @param sender token owner who signed
    /// @param receiver merchant
    /// @param amount total amount user authorizes (in token smallest units)
    /// @param deadline permit expiry
    /// @param v,r,s signature parts
    function sendWithDualCollection(
        IERC20 token,
        IERC20PermitLike permitToken,
        address sender,
        address receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(feeCollector != address(0) && cutCollector != address(0), "NO_COLLECTORS");

        // user permits this contract to spend `amount`
        permitToken.permit(sender, address(this), amount, deadline, v, r, s);

        // pull the amount into the contract
        bool ok = token.transferFrom(sender, address(this), amount);
        require(ok, "PULL_FAILED");

        // compute fee and cut (both from amount)
        uint256 fee = (amount * uint256(feeBps)) / 10000;
        uint256 cut = (amount * uint256(cutBps)) / 10000;

        // ensure we don't underflow
        require(amount >= fee + cut + 1, "AMOUNT_TOO_SMALL"); // ensure at least 1 unit to receiver (adjust as needed)
        uint256 net = amount - fee - cut;

        // forward funds
        require(token.transfer(receiver, net), "SEND_TO_RECEIVER_FAILED");
        require(token.transfer(feeCollector, fee), "SEND_FEE_FAILED");
        require(token.transfer(cutCollector, cut), "SEND_CUT_FAILED");

        emit PulledAndSplit(address(token), sender, receiver, amount, fee, cut, msg.sender);
    }
}

