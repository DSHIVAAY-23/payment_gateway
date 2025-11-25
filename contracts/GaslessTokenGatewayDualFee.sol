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
    address public cutCollector;    // collector for gateway cut
    uint16 public cutBps;           // basis points for cut (e.g. 100 = 1%)

    event ParamsUpdated(address indexed owner, address cutCollector, uint16 cutBps);
    event PulledAndSplit(address indexed token, address indexed sender, address indexed receiver, uint256 amount, uint256 cut, address relayer);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address _cutCollector, uint16 _cutBps) {
        require(_cutCollector != address(0), "INVALID_COLLECTOR");
        require(_cutBps <= 2000, "BPS_TOO_HIGH"); // safety cap 20%
        owner = msg.sender;
        cutCollector = _cutCollector;
        cutBps = _cutBps;
        emit ParamsUpdated(owner, cutCollector, cutBps);
    }

    function setParams(address _cutCollector, uint16 _cutBps) external onlyOwner {
        require(_cutCollector != address(0), "INVALID_COLLECTOR");
        require(_cutBps <= 2000, "BPS_TOO_HIGH");
        cutCollector = _cutCollector;
        cutBps = _cutBps;
        emit ParamsUpdated(msg.sender, cutCollector, cutBps);
    }

    /// @notice User signs permit for `amount`. Gateway pulls `amount`, computes cut from `amount`, and forwards funds.
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
        require(cutCollector != address(0), "NO_COLLECTOR");

        // user permits this contract to spend `amount`
        permitToken.permit(sender, address(this), amount, deadline, v, r, s);

        // pull the amount into the contract
        bool ok = token.transferFrom(sender, address(this), amount);
        require(ok, "PULL_FAILED");

        // compute cut from amount
        uint256 cut = (amount * uint256(cutBps)) / 10000;

        // ensure we don't underflow
        require(amount >= cut + 1, "AMOUNT_TOO_SMALL"); // ensure at least 1 unit to receiver
        uint256 net = amount - cut;

        // forward funds
        require(token.transfer(receiver, net), "SEND_TO_RECEIVER_FAILED");
        require(token.transfer(cutCollector, cut), "SEND_CUT_FAILED");

        emit PulledAndSplit(address(token), sender, receiver, amount, cut, msg.sender);
    }
}

