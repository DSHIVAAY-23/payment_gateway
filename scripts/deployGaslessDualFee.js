// scripts/deployGaslessDualFee.js
const hre = require('hardhat');

async function main() {
  const FEE_COLLECTOR = process.env.FEE_COLLECTOR || '0x06deedD21AfE4ae6BFb443A4f560aD13d81e05a7';
  const CUT_COLLECTOR = process.env.CUT_COLLECTOR || '0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2';
  const FEE_BPS = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 50; // default 0.5%
  const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS) : 100; // default 1%

  if (!FEE_COLLECTOR || !CUT_COLLECTOR) {
    throw new Error('Set FEE_COLLECTOR and CUT_COLLECTOR env vars');
  }

  const Factory = await hre.ethers.getContractFactory('GaslessTokenGatewayDualFee');

  console.log('Deploying GaslessTokenGatewayDualFee with:');
  console.log('  Fee Collector:', FEE_COLLECTOR);
  console.log('  Cut Collector:', CUT_COLLECTOR);
  console.log('  Fee BPS:', FEE_BPS, `(${FEE_BPS / 100}%)`);
  console.log('  Cut BPS:', CUT_BPS, `(${CUT_BPS / 100}%)`);

  const gateway = await Factory.deploy(FEE_COLLECTOR, CUT_COLLECTOR, FEE_BPS, CUT_BPS);
  await gateway.deployed();

  console.log('\n✅ Deployed gateway:', gateway.address);
  console.log('\n--- Deployment Summary ---');
  console.log('Contract: GaslessTokenGatewayDualFee');
  console.log('Address:', gateway.address);
  console.log('Owner:', await gateway.owner());
  console.log('Fee Collector:', await gateway.feeCollector());
  console.log('Cut Collector:', await gateway.cutCollector());
  console.log('Fee BPS:', (await gateway.feeBps()).toString());
  console.log('Cut BPS:', (await gateway.cutBps()).toString());
  console.log('\n--- Next Steps ---');
  console.log('export GASLESS_ADDRESS=' + gateway.address);
  console.log('Etherscan: https://sepolia.etherscan.io/address/' + gateway.address);
}

main().catch((err) => { console.error(err); process.exit(1); });



