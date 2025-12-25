// scripts/gaslessPyUSD.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const RPC = process.env.SEPOLIA_RPC;
  const OWNER_PK = process.env.PRIVATE_KEY;
  const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY;
  let GASLESS_ADDRESS = process.env.GASLESS_ADDRESS || "";
  const RECEIVER = process.env.RECEIVER;
  const AMOUNT = process.env.AMOUNT;
  const FEE = process.env.FEE;

  if (!RPC || !OWNER_PK || !RELAYER_PK || !RECEIVER || !AMOUNT || !FEE) {
    throw new Error("Missing required env vars. Ensure SEPOLIA_RPC, PRIVATE_KEY, RELAYER_PRIVATE_KEY, RECEIVER, AMOUNT, FEE are set.");
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const ownerWallet = new ethers.Wallet(OWNER_PK, provider);
  const relayerWallet = new ethers.Wallet(RELAYER_PK, provider);

  const pyusdAddr = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

  // Compile-time contract factory
  const GaslessContractFactory = await ethers.getContractFactory("GaslessUnifiedGatewayDualFee");

  if (!GASLESS_ADDRESS || GASLESS_ADDRESS === "") {
    console.log("GASLESS_ADDRESS not provided — deploying GaslessUnifiedGatewayDualFee to Sepolia...");
    const permit2Addr = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 on Sepolia
    const feeCollector = ownerWallet.address;
    const cutCollector = ownerWallet.address;
    const feeBps = 100; // 1.00%
    const cutBps = 50;  // 0.50%

    const deployed = await GaslessContractFactory.connect(ownerWallet).deploy(
      permit2Addr, 
      feeCollector, 
      cutCollector, 
      feeBps, 
      cutBps, 
      { gasLimit: 1500000 }
    );
    await deployed.deployed();
    GASLESS_ADDRESS = deployed.address;
    console.log("✅ Deployed Gasless contract at:", GASLESS_ADDRESS);
    console.log("Etherscan: https://sepolia.etherscan.io/address/" + GASLESS_ADDRESS);

    // set permit mode for pyUSD to ERC2612
    const setModeTx = await deployed.connect(ownerWallet).setPermitMode(pyusdAddr, 1, { gasLimit: 250000 }); // PermitMode.ERC2612 = 1
    await setModeTx.wait();
    console.log("✅ Set permitMode[pyUSD] = ERC2612");
  } else {
    console.log("Using existing GASLESS_ADDRESS:", GASLESS_ADDRESS);
  }

  // Minimal ABIs
  const tokenAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function nonces(address) view returns (uint256)"
  ];
  const gaslessAbi = [
    "function feeBps() view returns (uint16)",
    "function cutBps() view returns (uint16)",
    "function permitMode(address token) view returns (uint8)",
    "function setPermitMode(address token, uint8 mode) external",
    "function sendWithDualCollection(address token, address permitToken, address sender, address receiver, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s, bytes32 requirementKey) external"
  ];

  const token = new ethers.Contract(pyusdAddr, tokenAbi, provider);
  const gasless = new ethers.Contract(GASLESS_ADDRESS, gaslessAbi, provider);

  // Ensure permit mode is set to ERC2612 (1)
  try {
    const currentMode = await gasless.permitMode(pyusdAddr);
    if (currentMode !== 1) {
      console.log("Updating permitMode for pyUSD to ERC2612...");
      const gaslessWithOwner = gasless.connect(ownerWallet);
      await (await gaslessWithOwner.setPermitMode(pyusdAddr, 1, { gasLimit: 250000 })).wait();
      console.log("✅ permitMode[pyUSD] set to ERC2612");
    } else {
      console.log("✓ permitMode[pyUSD] already set to ERC2612");
    }
  } catch (err) {
    console.warn("⚠️  Warning: unable to set permitMode[pyUSD] (maybe not owner?):", err.message || err);
  }

  const tokenName = await token.name();
  let tokenSymbol = "PYUSD";
  try { tokenSymbol = await token.symbol(); } catch(_) {}
  const decimals = await token.decimals();

  console.log("\n=== Gasless pyUSD Transfer ===");
  console.log("Token (pyUSD):", pyusdAddr);
  console.log("Owner:", ownerWallet.address);
  console.log("Gasless Contract:", GASLESS_ADDRESS);
  console.log("Receiver:", RECEIVER);
  console.log("Amount:", AMOUNT);
  console.log("Fee:", FEE);
  console.log();

  const ownerBalBefore = await token.balanceOf(ownerWallet.address);
  const receiverBalBefore = await token.balanceOf(RECEIVER);
  console.log(`Token: ${tokenName} (${tokenSymbol}), decimals: ${decimals}`);
  console.log(`Owner balance: ${ethers.utils.formatUnits(ownerBalBefore, decimals)} ${tokenSymbol}`);
  console.log(`Receiver balance: ${ethers.utils.formatUnits(receiverBalBefore, decimals)} ${tokenSymbol}`);

  // compute permit amount = amount + fee
  const amountUnits = ethers.utils.parseUnits(String(AMOUNT), decimals);
  const feeUnits = ethers.utils.parseUnits(String(FEE), decimals);
  const permitValue = amountUnits.add(feeUnits);

  const nonce = (await token.nonces(ownerWallet.address)).toString();
  const network = await provider.getNetwork();
  const chainId = network.chainId;

  const domain = {
    name: tokenName,
    version: "1",
    chainId: chainId,
    verifyingContract: pyusdAddr
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]
  };

  const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365; // 1 year

  const message = {
    owner: ownerWallet.address,
    spender: GASLESS_ADDRESS,
    value: permitValue.toString(),
    nonce: nonce,
    deadline: deadline
  };

  console.log("\n✓ Token supports EIP-2612 permit (nonce:", nonce, ")");
  console.log("\n--- Signing Permit ---");
  console.log("Domain:", JSON.stringify(domain, null, 2));
  console.log("Message:", JSON.stringify(message, null, 2));

  const signature = await ownerWallet._signTypedData(domain, types, message);
  const sig = ethers.utils.splitSignature(signature);
  console.log("Signature v, r, s:", sig.v, sig.r, sig.s);

  // save permit
  const outDir = path.join(process.cwd(), "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const permitSave = { domain, types, message, signature, sig };
  fs.writeFileSync(path.join(outDir, "pyusd_permit.json"), JSON.stringify(permitSave, null, 2));
  console.log(`\n✅ Saved permit to: ${path.join(outDir, "pyusd_permit.json")}\n`);

  const feeBps = await gasless.feeBps().catch(() => 0);
  const cutBps = await gasless.cutBps().catch(() => 0);
  console.log(`Gateway feeBps: ${feeBps}, cutBps: ${cutBps}`);

  const gaslessWithRelayer = new ethers.Contract(GASLESS_ADDRESS, gaslessAbi, relayerWallet);

  console.log("\n--- Relaying Transaction ---");
  console.log("Relayer address:", relayerWallet.address);
  console.log("Calling gasless.sendWithDualCollection(...)");

  // Check if contract has requirementKey parameter (GaslessUnifiedGatewayDualFee) or not (GaslessTokenGatewayDualFee)
  let tx;
  try {
    // Try with requirementKey (GaslessUnifiedGatewayDualFee)
    tx = await gaslessWithRelayer.sendWithDualCollection(
      pyusdAddr,
      pyusdAddr,
      ownerWallet.address,
      RECEIVER,
      amountUnits,
      deadline,
      sig.v,
      sig.r,
      sig.s,
      ethers.constants.HashZero,
      { gasLimit: 900000 }
    );
  } catch (err) {
    // Fallback to without requirementKey (GaslessTokenGatewayDualFee)
    console.log("Trying without requirementKey parameter...");
    tx = await gaslessWithRelayer.sendWithDualCollection(
      pyusdAddr,
      pyusdAddr,
      ownerWallet.address,
      RECEIVER,
      amountUnits,
      deadline,
      sig.v,
      sig.r,
      sig.s,
      { gasLimit: 900000 }
    );
  }

  console.log("Transaction sent:", tx.hash);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block", receipt.blockNumber);

  const ownerBalAfter = await token.balanceOf(ownerWallet.address);
  const receiverBalAfter = await token.balanceOf(RECEIVER);

  const ownerDelta = ethers.utils.formatUnits(ownerBalAfter.sub(ownerBalBefore).mul(-1), decimals);
  const receiverDelta = ethers.utils.formatUnits(receiverBalAfter.sub(receiverBalBefore), decimals);

  console.log("\n--- Results ---");
  console.log(`Receiver: ${ethers.utils.formatUnits(receiverBalAfter, decimals)} ${tokenSymbol} (delta: +${receiverDelta})`);
  console.log(`Owner: ${ethers.utils.formatUnits(ownerBalAfter, decimals)} ${tokenSymbol} (delta: -${ownerDelta})`);
  console.log("\nEtherscan: https://sepolia.etherscan.io/tx/" + tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
  });
