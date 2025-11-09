/* eslint-disable no-console */
require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
  console.log('=== Deploying GaslessTokenTransfer to Polygon Amoy Testnet ===\n');

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  console.log('Deployer address:', deployer.address);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer MATIC balance:', ethers.utils.formatEther(balance), 'MATIC');
  
  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    throw new Error('Insufficient MATIC balance. Need at least 0.01 MATIC for deployment.');
  }

  console.log('\nDeploying GaslessTokenTransfer contract...');
  const Gasless = await ethers.getContractFactory('GaslessTokenTransfer');
  const gasless = await Gasless.deploy();
  await gasless.deployed();

  console.log('\n✅ GaslessTokenTransfer deployed successfully!');
  console.log('Contract address:', gasless.address);
  console.log('Network: Polygon Amoy Testnet (Chain ID: 80002)');
  
  const network = await ethers.provider.getNetwork();
  console.log('Actual Chain ID:', network.chainId.toString());

  console.log('\n--- Deployment Summary ---');
  console.log('Contract: GaslessTokenTransfer');
  console.log('Address:', gasless.address);
  console.log('Deployer:', deployer.address);
  console.log('Transaction hash:', gasless.deployTransaction.hash);
  
  console.log('\n--- Next Steps ---');
  console.log('1. Save this address: export GASLESS_ADDRESS=' + gasless.address);
  console.log('2. Verify on Polygonscan Amoy: https://amoy.polygonscan.com/address/' + gasless.address);
  console.log('3. Use this address in your gasless transaction scripts');
  
  console.log('\n--- Environment Variables ---');
  console.log('export AMOY_RPC=<your-amoy-rpc-url>');
  console.log('export PRIVATE_KEY=<your-deployer-private-key>');
  console.log('export GASLESS_ADDRESS=' + gasless.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

