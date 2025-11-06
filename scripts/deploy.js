/* eslint-disable no-console */
require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
  const signers = await ethers.getSigners();
  const relayer = signers[0];
  const userAddr = process.env.SENDER || signers[1]?.address || relayer.address;
  const receiverAddr = process.env.RECEIVER || signers[2]?.address || relayer.address;

  console.log('Deploying contracts with relayer:', relayer.address);

  const ERC20Permit = await ethers.getContractFactory('ERC20Permit');
  const token = await ERC20Permit.deploy('DemoToken', 'DMT', 18);
  await token.deployed();
  console.log('ERC20Permit deployed at:', token.address);

  // Mint 1000 tokens to the user account for testing (18 decimals)
  const mintAmount = ethers.utils.parseUnits('1000', 18);
  const mintTx = await token.mint(userAddr, mintAmount);
  await mintTx.wait();
  console.log('Minted', mintAmount.toString(), 'to user:', userAddr);

  const Gasless = await ethers.getContractFactory('GaslessTokenTransfer');
  const gasless = await Gasless.deploy();
  await gasless.deployed();
  console.log('GaslessTokenTransfer deployed at:', gasless.address);

  const chainId = (await relayer.getChainId()).toString();
  console.log('\nExample env setup for sign/relayer:');
  console.log('  export LOCAL_RPC=http://127.0.0.1:8545');
  console.log(`  export TOKEN_ADDRESS=${token.address}`);
  console.log(`  export GASLESS_ADDRESS=${gasless.address}`);
  console.log(`  export SENDER=${userAddr}`);
  console.log(`  export RECEIVER=${receiverAddr}`);
  console.log('  # Optional overrides: AMOUNT, FEE, DEADLINE');
  console.log(`  # chainId=${chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


