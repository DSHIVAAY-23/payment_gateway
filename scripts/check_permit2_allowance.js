// scripts/check_permit2_allowance.js
// Check if Permit2 has sufficient allowance for a token
import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS || process.env.USDT_ADDRESS;
  const ownerAddress = process.env.OWNER_ADDRESS || process.env.USER_ADDRESS;
  const permit2Address = process.env.PERMIT2_ADDRESS || "0x000000000022d473030f116ddee9f6b43ac78ba3";
  const requiredAmount = process.env.AMOUNT; // human-readable amount (optional)

  if (!tokenAddress) throw new Error("Set TOKEN_ADDRESS or USDT_ADDRESS");

  // Derive owner address from PRIVATE_KEY if available, otherwise use OWNER_ADDRESS
  let owner;
  if (process.env.PRIVATE_KEY) {
    const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY, hre.ethers.provider);
    owner = wallet.address;
  } else if (ownerAddress) {
    owner = ownerAddress;
  } else {
    throw new Error("Set PRIVATE_KEY or OWNER_ADDRESS/USER_ADDRESS");
  }

  const token = new hre.ethers.Contract(tokenAddress, ERC20_ABI, hre.ethers.provider);
  
  // Try to get decimals, default to 6 for USDC/USDT if not available
  let decimals = 6;
  try {
    decimals = await token.decimals();
  } catch (e) {
    console.log("⚠️  Could not read decimals(), assuming 6 (USDC/USDT standard)");
  }
  
  const balance = await token.balanceOf(owner);
  const allowance = await token.allowance(owner, permit2Address);

  console.log("\n=== Permit2 Allowance Check ===");
  console.log("Token:", tokenAddress);
  console.log("Owner:", owner);
  console.log("Permit2:", permit2Address);
  console.log("Balance:", hre.ethers.utils.formatUnits(balance, decimals), "tokens");
  console.log("Allowance:", hre.ethers.utils.formatUnits(allowance, decimals), "tokens");

  if (requiredAmount) {
    const requiredBN = hre.ethers.utils.parseUnits(requiredAmount, decimals);
    console.log("\nRequired Amount:", requiredAmount, "tokens");
    console.log("Required (wei):", requiredBN.toString());

    if (allowance.gte(requiredBN)) {
      console.log("✅ Allowance is sufficient!");
      process.exit(0);
    } else {
      console.log("❌ Allowance is insufficient!");
      console.log("\nTo fix this, run:");
      console.log("  npx hardhat run scripts/approve_permit2.js --network sepolia");
      console.log("\nOr in a frontend:");
      console.log("  1. Check allowance before signing permit");
      console.log("  2. If insufficient, prompt user to approve Permit2");
      console.log("  3. After approval, proceed with permit signing");
      process.exit(1);
    }
  } else {
    if (allowance.gt(0)) {
      console.log("✅ Permit2 has allowance (may need more for larger amounts)");
    } else {
      console.log("❌ No allowance set. Run approve_permit2.js first.");
      process.exit(1);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });

