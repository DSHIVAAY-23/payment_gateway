// scripts/relayerPermit2Send.js
// Reads a JSON file containing { permit: <object>, signature: "0x..." }
// and calls the deployed gateway's acceptSignatureAndTransfer function.

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const gatewayAddress = process.env.GATEWAY_ADDRESS; // e.g. exported before run
  if (!gatewayAddress) throw new Error('Set GATEWAY_ADDRESS in env');

  const filePath = process.env.PERMIT_JSON_PATH || path.join(process.cwd(), 'out', 'permit2_transfer.json');
  if (!fs.existsSync(filePath)) throw new Error('Permit JSON not found: ' + filePath);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const permit = raw.permit;
  const signature = raw.signature;

  if (!permit || !signature) throw new Error('permit or signature missing in JSON');

  const [signer] = await hre.ethers.getSigners();
  const gateway = await hre.ethers.getContractAt('Permit2SignatureGateway', gatewayAddress, signer);

  // Note: Hardhat/ethers will ABI-encode the struct automatically if shapes match.
  console.log('Calling gateway.acceptSignatureAndTransfer with permit:', permit);
  const tx = await gateway.acceptSignatureAndTransfer(permit, signature, { gasLimit: 800000 });
  console.log('Sent tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Mined in block', receipt.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

