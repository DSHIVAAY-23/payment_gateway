// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Minimal ERC20 with EIP-2612 permit (Solmate-style)
/// @notice Simple ERC20 for demo purposes. Includes EIP-2612 permit with DOMAIN_SEPARATOR and nonces.
contract ERC20Permit {
    // --- ERC20 Metadata ---
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    // --- ERC20 Storage ---
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- EIP-2612 Permit Storage ---
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;
    uint256 internal immutable INITIAL_CHAIN_ID;
    bytes32 public DOMAIN_SEPARATOR;
    mapping(address => uint256) public nonces;

    /// @dev Emitted on transfers, approvals.
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    /// @param _name Token name used for ERC-20 and EIP-712 domain.
    /// @param _symbol Token symbol.
    /// @param _decimals Token decimals.
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        INITIAL_CHAIN_ID = block.chainid;
        INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
        DOMAIN_SEPARATOR = INITIAL_DOMAIN_SEPARATOR;
    }

    // --- ERC20 Logic ---
    function approve(address spender, uint256 amount) public virtual returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "INSUFFICIENT_ALLOWANCE");
            unchecked { allowance[from][msg.sender] = allowed - amount; }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "TRANSFER_TO_ZERO");
        uint256 fromBal = balanceOf[from];
        require(fromBal >= amount, "INSUFFICIENT_BALANCE");
        unchecked {
            balanceOf[from] = fromBal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    /// @notice Mint tokens for demo/testing. Not access-controlled in this PoC.
    function mint(address to, uint256 amount) external {
        require(to != address(0), "MINT_TO_ZERO");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // --- EIP-2612 Permit ---
    /// @notice Approve via signature without spending gas from the owner.
    /// @dev Protects against replay via per-owner `nonces` and `deadline`.
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "PERMIT_DEADLINE_EXPIRED");

        // Keep DOMAIN_SEPARATOR updated if chainId changed (e.g., hardhat forks)
        if (block.chainid != INITIAL_CHAIN_ID) {
            DOMAIN_SEPARATOR = _computeDomainSeparator();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH,
                        owner,
                        spender,
                        value,
                        nonces[owner]++,
                        deadline
                    )
                )
            )
        );

        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0) && recovered == owner, "INVALID_SIGNER");

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }
}


