/* eslint-disable no-console */
require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS || process.argv[2];
  if (!tokenAddress) {
    throw new Error('TOKEN_ADDRESS required (env or CLI arg)');
  }

  const provider = ethers.provider;
  const token = new ethers.Contract(
    tokenAddress,
    [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
      'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
      'function nonces(address) view returns (uint256)',
      'function DOMAIN_SEPARATOR() view returns (bytes32)'
    ],
    provider
  );

  console.log('Checking token:', tokenAddress);
  
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    console.log(`Token: ${name} (${symbol}), decimals: ${decimals}`);
    
    // Check if permit exists (will throw if not)
    try {
      const domainSeparator = await token.DOMAIN_SEPARATOR();
      console.log('✓ Token supports EIP-2612 permit');
      console.log('  DOMAIN_SEPARATOR:', domainSeparator);
      
      // Check nonces
      const testAddress = '0x0000000000000000000000000000000000000001';
      try {
        const nonce = await token.nonces(testAddress);
        console.log(`  nonces() works, test nonce: ${nonce.toString()}`);
      } catch (e) {
        console.log('  ⚠ nonces() may not be available');
      }
      
      return { supportsPermit: true, token, name, symbol, decimals };
    } catch (e) {
      console.log('✗ Token does NOT support EIP-2612 permit');
      console.log('  Error:', e.message);
      return { supportsPermit: false, token, name, symbol, decimals };
    }
  } catch (err) {
    console.error('Failed to read token:', err.message);
    throw err;
  }
}

if (require.main === module) {
  main()
    .then((result) => {
      if (result) {
        process.exit(result.supportsPermit ? 0 : 1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };

