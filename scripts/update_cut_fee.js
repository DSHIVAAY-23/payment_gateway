// scripts/update_cut_fee.js
import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const gatewayAddress = process.env.GASLESS_ADDRESS;
  const newCutCollector = process.env.CUT_COLLECTOR;
  const newCutBps = parseInt(process.env.CUT_BPS); // e.g. 200 for 2%

  if (!gatewayAddress || !newCutCollector || isNaN(newCutBps)) {
    throw new Error("Missing required env vars: GASLESS_ADDRESS, CUT_COLLECTOR, CUT_BPS");
  }

  const [deployer] = await ethers.getSigners();
  console.log("🔐 Using deployer:", deployer.address);

  const Gateway = await ethers.getContractFactory("GaslessTokenGatewayDualFee");
  const gateway = await Gateway.attach(gatewayAddress);

  console.log(`📢 Updating fee to ${newCutBps / 100}%...`);
  const tx = await gateway.setParams(newCutCollector, newCutBps);
  await tx.wait();

  console.log(`✅ Fee updated to ${newCutBps / 100}%`);
  console.log("New collector:", newCutCollector);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

