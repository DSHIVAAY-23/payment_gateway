// scripts/relayer_send_permit2_dual.js
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const filePath = process.env.PERMIT_JSON_PATH || path.join(process.cwd(), 'out', 'permit2_usdt.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Permit JSON not found at ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const gatewayAddr = process.env.GASLESS_ADDRESS || raw.gateway;
  if (!gatewayAddr) throw new Error('GASLESS_ADDRESS not set and not present in JSON');

  let relayer;
  if (process.env.RELAYER_PRIVATE_KEY) {
    relayer = new hre.ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, hre.ethers.provider);
    console.log('Using RELAYER_PRIVATE_KEY as relayer:', relayer.address);
  } else {
    [relayer] = await hre.ethers.getSigners();
    console.log('Using first Hardhat signer as relayer:', relayer.address);
  }

  const gateway = await hre.ethers.getContractAt('GaslessPermit2GatewayDualFee', gatewayAddr, relayer);

  const permit = raw.permit;
  const transferDetails = raw.transferDetails;
  const owner = raw.owner;
  const signature = raw.signature;
  const receiver = raw.receiver;

  console.log('\n--- Calling sendWithPermit2DualCollection ---');
  console.log('Gateway   :', gatewayAddr);
  console.log('Owner     :', owner);
  console.log('Receiver  :', receiver);
  console.log('Token     :', permit.permitted[0]?.token);
  console.log('Amount    :', permit.permitted[0]?.amount);

  const tx = await gateway.sendWithPermit2DualCollection(
    permit,
    transferDetails,
    owner,
    signature,
    receiver,
    { gasLimit: 900000 }
  );
  console.log('Tx hash   :', tx.hash);
  const receipt = await tx.wait();
  console.log('Mined in block:', receipt.blockNumber);
  console.log('Etherscan :', `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });




