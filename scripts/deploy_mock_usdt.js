// scripts/deploy_mock_usdt.js
/* eslint-disable no-console */
const hre = require('hardhat');

async function main() {
  const name = process.env.MOCK_NAME || 'Mock Tether USD';
  const symbol = process.env.MOCK_SYMBOL || 'mUSDT';
  // INITIAL_SUPPLY in human units (defaults to 1,000,000)
  const human = process.env.INITIAL_SUPPLY || '1000000';
  const decimals = 6; // mUSDT like USDT

  const initialSupply = hre.ethers.utils.parseUnits(human, decimals);

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying MockUSDT with deployer:', deployer.address);
  console.log('Name:', name, 'Symbol:', symbol, 'InitialSupply (human):', human);

  const Factory = await hre.ethers.getContractFactory('MockUSDT');
  const token = await Factory.deploy(name, symbol, initialSupply);
  await token.deployed();

  console.log('\n✅ Deployed MockUSDT at:', token.address);
  console.log('Decimals:', decimals);
  console.log('Deployer balance:', (await token.balanceOf(deployer.address)).toString());
  console.log('Etherscan:', `https://sepolia.etherscan.io/address/${token.address}`);
  console.log('\nexport USDT_ADDRESS=' + token.address);
}

main().catch((e) => { console.error(e); process.exit(1); });






