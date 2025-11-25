// scripts/deployGaslessDualFee.js
const hre = require('hardhat');

async function main() {
  const CUT_COLLECTOR = process.env.CUT_COLLECTOR || '0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2';
  const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS) : 100; // default 1%

  if (!CUT_COLLECTOR) {
    throw new Error('Set CUT_COLLECTOR env var');
  }

  const Factory = await hre.ethers.getContractFactory('GaslessTokenGatewayDualFee');

  console.log('Deploying GaslessTokenGatewayDualFee with:');
  console.log('  Cut Collector:', CUT_COLLECTOR);
  console.log('  Cut BPS:', CUT_BPS, `(${CUT_BPS / 100}%)`);

  const gateway = await Factory.deploy(CUT_COLLECTOR, CUT_BPS);
  await gateway.deployed();

  console.log('\n✅ Deployed gateway:', gateway.address);
  console.log('\n--- Deployment Summary ---');
  console.log('Contract: GaslessTokenGatewayDualFee');
  console.log('Address:', gateway.address);
  console.log('Owner:', await gateway.owner());
  console.log('Cut Collector:', await gateway.cutCollector());
  console.log('Cut BPS:', (await gateway.cutBps()).toString());
  console.log('\n--- Next Steps ---');
  console.log('export GASLESS_ADDRESS=' + gateway.address);
  console.log('Etherscan: https://sepolia.etherscan.io/address/' + gateway.address);
}

main().catch((err) => { console.error(err); process.exit(1); });






