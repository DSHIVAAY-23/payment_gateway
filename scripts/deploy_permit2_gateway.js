// scripts/deploy_permit2_gateway.js
/* eslint-disable no-console */
const hre = require('hardhat');

async function main() {
  const PERMIT2_ADDRESS = process.env.PERMIT2_ADDRESS || '0x000000000022D473030F116dDEE9F6B43AC78BA3';
  const CUT_COLLECTOR = process.env.CUT_COLLECTOR;
  const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS, 10) : 100; // 1%

  if (!CUT_COLLECTOR) {
    throw new Error('Set CUT_COLLECTOR env var');
  }

  console.log('Deploying GaslessPermit2GatewayDualFee with:');
  console.log('  PERMIT2_ADDRESS:', PERMIT2_ADDRESS);
  console.log('  CUT_COLLECTOR  :', CUT_COLLECTOR);
  console.log('  CUT_BPS        :', CUT_BPS);

  const Factory = await hre.ethers.getContractFactory('GaslessPermit2GatewayDualFee');
  const gateway = await Factory.deploy(PERMIT2_ADDRESS, CUT_COLLECTOR, CUT_BPS);
  await gateway.deployed();

  console.log('\n✅ Deployed GaslessPermit2GatewayDualFee at:', gateway.address);
  console.log('Owner:', await gateway.owner());
  console.log('Cut Collector:', await gateway.cutCollector());
  console.log('Cut BPS:', (await gateway.cutBps()).toString());
  console.log('Etherscan:', `https://sepolia.etherscan.io/address/${gateway.address}`);
  console.log('\nexport GASLESS_ADDRESS=' + gateway.address);
}

main().catch((err) => { console.error(err); process.exit(1); });







