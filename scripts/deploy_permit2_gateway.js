// scripts/deploy_permit2_gateway.js
/* eslint-disable no-console */
const hre = require('hardhat');

async function main() {
  const PERMIT2_ADDRESS = process.env.PERMIT2_ADDRESS || '0x000000000022D473030F116dDEE9F6B43AC78BA3';
  const FEE_COLLECTOR = process.env.FEE_COLLECTOR;
  const CUT_COLLECTOR = process.env.CUT_COLLECTOR;
  const FEE_BPS = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS, 10) : 50; // 0.5%
  const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS, 10) : 100; // 1%

  if (!FEE_COLLECTOR || !CUT_COLLECTOR) {
    throw new Error('Set FEE_COLLECTOR and CUT_COLLECTOR env vars');
  }

  console.log('Deploying GaslessPermit2GatewayDualFee with:');
  console.log('  PERMIT2_ADDRESS:', PERMIT2_ADDRESS);
  console.log('  FEE_COLLECTOR  :', FEE_COLLECTOR);
  console.log('  CUT_COLLECTOR  :', CUT_COLLECTOR);
  console.log('  FEE_BPS        :', FEE_BPS);
  console.log('  CUT_BPS        :', CUT_BPS);

  const Factory = await hre.ethers.getContractFactory('GaslessPermit2GatewayDualFee');
  const gateway = await Factory.deploy(PERMIT2_ADDRESS, FEE_COLLECTOR, CUT_COLLECTOR, FEE_BPS, CUT_BPS);
  await gateway.deployed();

  console.log('\n✅ Deployed GaslessPermit2GatewayDualFee at:', gateway.address);
  console.log('Owner:', await gateway.owner());
  console.log('Etherscan:', `https://sepolia.etherscan.io/address/${gateway.address}`);
  console.log('\nexport GASLESS_ADDRESS=' + gateway.address);
}

main().catch((err) => { console.error(err); process.exit(1); });






