// scripts/settle.js
require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');

async function main() {
  const inputPath = process.argv[2]; // e.g. node scripts/settle.js payload.json
  if (!inputPath) {
    console.error("Usage: node scripts/settle.js <payload.json>");
    process.exit(1);
  }
  const raw = fs.readFileSync(inputPath, 'utf8');
  const payload = JSON.parse(raw);

  // Expect payload shape:
  // {
  //   "authorization": {
  //     "from":"0xpayer",
  //     "to":"0xpayee",
  //     "value":"10000",
  //     "validAfter":"0",
  //     "validBefore":"1735689600",
  //     "nonce":"0x...."
  //   },
  //   "signature": "0x...."   // 65-byte hex or bytes
  // }

  const { authorization, signature } = payload;
  if (!authorization || !signature) {
    console.error("payload must include authorization and signature");
    process.exit(1);
  }

  const RPC_URL = process.env.RPC_URL_BASE;
  const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY;
  const USDC_ADDRESS = process.env.USDC_ADDRESS;
  const GAS_LIMIT = process.env.GAS_LIMIT ? parseInt(process.env.GAS_LIMIT) : 200000;

  if (!RPC_URL || !RELAYER_KEY || !USDC_ADDRESS) {
    console.error("Please set RPC_URL_BASE, RELAYER_PRIVATE_KEY and USDC_ADDRESS in .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const relayer = new ethers.Wallet(RELAYER_KEY, provider);

  // Minimal ABI fragments for both common variants:
  const USDC_ABI = [
    // bytes signature variant (common)
    "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) external",
    // v,r,s variant (older style)
    "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external"
  ];

  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, relayer);

  // Normalize fields
  const from = authorization.from;
  const to = authorization.to;
  const value = ethers.BigNumber.from(authorization.value);
  const validAfter = ethers.BigNumber.from(authorization.validAfter || 0);
  const validBefore = ethers.BigNumber.from(authorization.validBefore || 0);
  let nonce = authorization.nonce;
  // ensure nonce is 32 bytes hex
  if (!nonce.startsWith('0x')) nonce = '0x' + (nonce);
  // ethers will accept a hex32 string

  console.log("Preparing to call transferWithAuthorization on", USDC_ADDRESS);
  console.log("from:", from, "to:", to, "value:", value.toString());

  // Try bytes-signature variant first (signature as single bytes)
  try {
    console.log("Trying bytes signature variant...");
    const tx = await usdc.transferWithAuthorization(
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
      signature,
      { gasLimit: GAS_LIMIT }
    );
    console.log("Submitted tx (bytes-signature variant):", tx.hash);
    const receipt = await tx.wait();
    console.log("Receipt:", receipt.transactionHash, "status:", receipt.status);
    process.exit(0);
  } catch (err) {
    console.warn("bytes-signature call failed:", err.message || err);
    console.warn("Falling back to v,r,s call...");
  }

  // Fallback: split signature into v,r,s and call the v,r,s overload
  try {
    const sig = ethers.utils.splitSignature(signature);
    const tx2 = await usdc.transferWithAuthorization(
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
      sig.v,
      sig.r,
      sig.s,
      { gasLimit: GAS_LIMIT }
    );
    console.log("Submitted tx (v,r,s variant):", tx2.hash);
    const receipt2 = await tx2.wait();
    console.log("Receipt:", receipt2.transactionHash, "status:", receipt2.status);
    process.exit(0);
  } catch (err) {
    console.error("v,r,s variant failed:", err.message || err);
    process.exit(2);
  }
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(99);
});
