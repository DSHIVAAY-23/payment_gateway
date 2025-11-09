// scripts/deployGaslessWithFee.js
const hre = require('hardhat');

async function main() {
  const FEE_COLLECTOR = process.env.FEE_COLLECTOR;
  const FEE_BPS = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 100; // default 1%

  if (!FEE_COLLECTOR) throw new Error('Set FEE_COLLECTOR env var');

  const Factory = await hre.ethers.getContractFactory('GaslessTokenTransferWithFee');

  console.log('Deploying GaslessTokenTransferWithFee with feeCollector=', FEE_COLLECTOR, 'feeBps=', FEE_BPS);

  const gateway = await Factory.deploy(FEE_COLLECTOR, FEE_BPS);

  await gateway.deployed();

  console.log('Deployed gateway:', gateway.address);
  console.log('\n--- Deployment Summary ---');
  console.log('Contract: GaslessTokenTransferWithFee');
  console.log('Address:', gateway.address);
  console.log('Fee Collector:', FEE_COLLECTOR);
  console.log('Fee BPS:', FEE_BPS, `(${FEE_BPS / 100}%)`);
  console.log('Owner:', await gateway.owner());
  console.log('\n--- Next Steps ---');
  console.log('export GASLESS_ADDRESS=' + gateway.address);
  console.log('Etherscan: https://sepolia.etherscan.io/address/' + gateway.address);
}

main().catch((err) => { console.error(err); process.exit(1); });

