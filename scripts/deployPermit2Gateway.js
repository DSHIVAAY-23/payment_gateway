// scripts/deployPermit2Gateway.js
const hre = require("hardhat");

async function main() {
  const Permit2SignatureGateway = await hre.ethers.getContractFactory("Permit2SignatureGateway");

  // Mainnet Permit2 canonical address (change for other networks)
  const PERMIT2_ADDR = process.env.PERMIT2_ADDRESS || "0x000000000022D473030F116dDEE9F6B43AC78BA3";

  console.log("Deploying Permit2SignatureGateway with Permit2 at:", PERMIT2_ADDR);
  const gateway = await Permit2SignatureGateway.deploy(PERMIT2_ADDR);
  await gateway.deployed();

  console.log("Gateway deployed to:", gateway.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

