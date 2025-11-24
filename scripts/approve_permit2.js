// scripts/approve_permit2.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  // Config (or read from env)
  const tokenAddress = process.env.USDT_ADDRESS || "0xCd56D421E5E623eB12d74712b463E9A336B6f287";
  const spender = process.env.PERMIT2_ADDRESS || "0x000000000022d473030f116ddee9f6b43ac78ba3";
  const ownerPrivateKey = process.env.PRIVATE_KEY; // owner's private key (the address to approve from)
  if (!ownerPrivateKey) throw new Error("Set PRIVATE_KEY in env (owner's key)");

  const wallet = new hre.ethers.Wallet(ownerPrivateKey, hre.ethers.provider);
  const erc20 = await hre.ethers.getContractAt(
    ["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"],
    tokenAddress,
    wallet
  );

  const max = hre.ethers.constants.MaxUint256;
  console.log(`Sending approve(token=${tokenAddress} spender=${spender} amount=MaxUint256) from ${wallet.address} ...`);

  const tx = await erc20.approve(spender, max);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("mined in block", receipt.blockNumber);

  const allowance = await erc20.allowance(wallet.address, spender);
  console.log("allowance set:", allowance.toString());
}

main().catch(e => { console.error(e); process.exit(1); });
