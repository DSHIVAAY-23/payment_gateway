require('dotenv').config();
require('@nomiclabs/hardhat-ethers');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: process.env.LOCAL_RPC || 'http://127.0.0.1:8545'
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC || process.env.TESTNET_RPC,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    polygonAmoy: {
      url: process.env.AMOY_RPC || 'https://amoy-polygon.invalid',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};


