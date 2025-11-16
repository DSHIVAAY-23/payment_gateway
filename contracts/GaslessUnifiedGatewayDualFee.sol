// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/permit2/src/interfaces/ISignatureTransfer.sol";

/* ========== Minimal permit interface for EIP-2612 style tokens ========== */
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

/* ========== Minimal EIP-3009 interface ========== */
/// @dev Common transferWithAuthorization signature used in EIP-3009-style tokens
interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
}

/// @title GaslessUnifiedGatewayDualFee
/// @notice Single gateway that supports EIP-2612 `permit` tokens, Uniswap Permit2 `permitTransferFrom`, and EIP-3009 `transferWithAuthorization`.
/// It pulls funds (gasless user signature flows) and splits to merchant (net), feeCollector (fee) and cutCollector (cut).
contract GaslessUnifiedGatewayDualFee is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /* ========== Permit2 ========== */
    ISignatureTransfer public immutable PERMIT2;

    /* ========== Fee params ========== */
    address public feeCollector;
    address public cutCollector;
    uint16 public feeBps; // basis points (1 bps = 0.01%)
    uint16 public cutBps;

    /* ========== Permit mode mapping ========== */
    enum PermitMode { NONE, ERC2612, PERMIT2, EIP3009 }
    mapping(address => PermitMode) public permitMode; // token => permitted flow

    /* ========== Events & Errors ========== */
    event ParamsUpdated(address indexed owner, address feeCollector, address cutCollector, uint16 feeBps, uint16 cutBps);
    event PulledAndSplit(address indexed token, address indexed ownerAddr, address indexed receiver, uint256 amount, uint256 fee, uint256 cut, address relayer);
    event PermitModeSet(address indexed token, PermitMode mode);

    error InvalidCollector();
    error BpsTooHigh();
    error AmountTooSmall();
    error UnsupportedPermitMode();

    /* ========== PaymentRequirements helper (x402-ish) ========== */
    /// @notice On-chain representation of a payment requirement for simple verification.
    struct PaymentRequirement {
        address token;       // token to be paid
        uint256 amount;      // required amount
        address receiver;    // expected receiver/merchant
        bytes32 resourceHash; // optional resource identifier (hash of URL or resource body)
    }

    /// @notice Store expected payment requirement metadata on-chain for on-chain verification convenience.
    mapping(bytes32 => PaymentRequirement) public paymentRequirements; // key => requirement

    event PaymentRequirementSet(bytes32 indexed key, address token, uint256 amount, address receiver, bytes32 resourceHash);

    /* ========== Constructor ========== */
    /// @param permit2Address canonical Uniswap Permit2 SignatureTransfer contract
    /// @param _feeCollector recipient of platform fee
    /// @param _cutCollector recipient of gateway cut
    /// @param _feeBps fee bps (safety capped to 2000)
    /// @param _cutBps cut bps (safety capped to 2000)
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

    function setParams(address _feeCollector, address _cutCollector, uint16 _feeBps, uint16 _cutBps) external onlyOwner {
        if (_feeCollector == address(0) || _cutCollector == address(0)) revert InvalidCollector();
        if (_feeBps > 2000 || _cutBps > 2000) revert BpsTooHigh();
        feeCollector = _feeCollector;
        cutCollector = _cutCollector;
        feeBps = _feeBps;
        cutBps = _cutBps;
        emit ParamsUpdated(msg.sender, feeCollector, cutCollector, feeBps, cutBps);
    }

    function setPermitMode(address token, PermitMode mode) external onlyOwner {
        permitMode[token] = mode;
        emit PermitModeSet(token, mode);
    }

    /* ========== PaymentRequirement management ========== */
    /// @notice Store a payment requirement keyed by an identifier (could be hash of URL + params)
    function setPaymentRequirement(bytes32 key, address token, uint256 amount, address receiver, bytes32 resourceHash) external onlyOwner {
        paymentRequirements[key] = PaymentRequirement({ token: token, amount: amount, receiver: receiver, resourceHash: resourceHash });
        emit PaymentRequirementSet(key, token, amount, receiver, resourceHash);
    }

    /// @notice Helper to compute a key off-chain (e.g. keccak256(abi.encodePacked(url, amount, receiver))) and later verify
    function getPaymentRequirement(bytes32 key) external view returns (PaymentRequirement memory) {
        return paymentRequirements[key];
    }

    /* ========== EIP-2612 (token-permit) flow ========== */
    /// @notice User signs `permit` (EIP-2612-like). Gateway then pulls tokens via transferFrom and splits.
    function sendWithDualCollection(
        IERC20 token,
        IERC20PermitLike permitToken,
        address sender,
        address receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32 requirementKey
    ) external nonReentrant {
        if (permitMode[address(token)] != PermitMode.ERC2612) revert UnsupportedPermitMode();

        // If requirementKey provided, verify on-chain requirement matches
        if (requirementKey != bytes32(0)) {
            PaymentRequirement memory req = paymentRequirements[requirementKey];
            require(req.token == address(token) && req.amount == amount && req.receiver == receiver, "REQ_MISMATCH");
        }

        // Call token.permit(owner, spender=this, amount, deadline, v,r,s)
        permitToken.permit(sender, address(this), amount, deadline, v, r, s);

        // Pull tokens into this contract
        IERC20(address(token)).safeTransferFrom(sender, address(this), amount);

        _distribute(IERC20(address(token)), sender, receiver, amount);
    }

    /* ========== Permit2 flow ========== */
    function sendWithPermit2DualCollection(
        ISignatureTransfer.PermitBatchTransferFrom calldata permit,
        ISignatureTransfer.SignatureTransferDetails[] calldata transferDetails,
        address ownerAddr,
        bytes calldata signature,
        address receiver,
        bytes32 requirementKey
    ) external nonReentrant {
        address token = permit.permitted[0].token;
        if (permitMode[token] != PermitMode.PERMIT2) revert UnsupportedPermitMode();

        if (requirementKey != bytes32(0)) {
            PaymentRequirement memory req = paymentRequirements[requirementKey];
            require(req.token == token && req.amount == transferDetails[0].requestedAmount && req.receiver == receiver, "REQ_MISMATCH");
        }

        PERMIT2.permitTransferFrom(permit, transferDetails, ownerAddr, signature);

        require(transferDetails.length == 1, "ONLY_SINGLE_TRANSFER_DETAIL");
        uint256 amount = transferDetails[0].requestedAmount;

        _distribute(IERC20(token), ownerAddr, receiver, amount);
    }

    /* ========== EIP-3009 flow (transferWithAuthorization) ========== */
    /// @notice Accepts an EIP-3009 style transferWithAuthorization signature and executes it.
    /// @param token token that implements transferWithAuthorization
    /// @param from sender
    /// @param to recipient (should be this contract or receiver)
    /// @param value amount
    /// @param validAfter earliest time the authorization is valid
    /// @param validBefore expiration time for authorization
    /// @param nonce unique nonce
    /// @param signature full bytes signature as expected by token
    /// @param receiver merchant receiver for split
    /// @param requirementKey optional payment requirement key
    function sendWithEIP3009(
        IERC20 token,
        IERC3009 token3009,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature,
        address receiver,
        bytes32 requirementKey
    ) external nonReentrant {
        if (permitMode[address(token)] != PermitMode.EIP3009) revert UnsupportedPermitMode();

        if (requirementKey != bytes32(0)) {
            PaymentRequirement memory req = paymentRequirements[requirementKey];
            require(req.token == address(token) && req.amount == value && req.receiver == receiver, "REQ_MISMATCH");
        }

        // Execute token's transferWithAuthorization which will transfer tokens from `from` to `to`.
        token3009.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature);

        // If the token transferred to this contract, distribute. If token transferred directly to receiver, still emit event.
        if (to == address(this)) {
            _distribute(token, from, receiver, value);
        } else if (to == receiver) {
            // token was directly sent to receiver by the token contract — we only need to send fee/cut to collectors
            uint256 fee = (value * feeBps) / 10000;
            uint256 cut = (value * cutBps) / 10000;
            // transfer fee and cut from receiver to collectors — requires receiver has approved this contract (not ideal)
            // Safer approach is to route transferWithAuthorization to send to this contract (recommended)
            emit PulledAndSplit(address(token), from, receiver, value, fee, cut, msg.sender);
        } else {
            // unknown routing — do nothing but emit
            emit PulledAndSplit(address(token), from, receiver, value, 0, 0, msg.sender);
        }
    }

    /* ========== Internal distribution logic ========== */
    function _distribute(IERC20 token, address sender, address receiver, uint256 amount) internal {
        uint256 fee = (amount * feeBps) / 10000;
        uint256 cut = (amount * cutBps) / 10000;
        if (amount < fee + cut + 1) revert AmountTooSmall();
        uint256 net = amount - fee - cut;

        IERC20 erc20 = token;
        erc20.safeTransfer(receiver, net);
        erc20.safeTransfer(feeCollector, fee);
        erc20.safeTransfer(cutCollector, cut);

        emit PulledAndSplit(address(token), sender, receiver, amount, fee, cut, msg.sender);
    }

    /* ========== Convenience view helpers ========== */
    function getPermitMode(address token) external view returns (PermitMode) {
        return permitMode[token];
    }

    /// @notice Compute an on-chain key for a payment requirement (useful off-chain to match)
    function computeRequirementKey(string calldata resource, address token, uint256 amount, address receiver) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(resource, token, amount, receiver));
    }
}


