// scripts/relayer_send_with_fee.js
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const filePath = process.env.PERMIT_JSON_PATH || path.join(process.cwd(), 'out', 'pyusd_permit_fee.json');
  if (!fs.existsSync(filePath)) throw new Error('Permit JSON not found: ' + filePath);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const gatewayAddr = process.env.GASLESS_ADDRESS || raw.gateway;
  if (!gatewayAddr) throw new Error('GASLESS_ADDRESS not set and not found in permit JSON');

  let relayer;
  if (process.env.RELAYER_PRIVATE_KEY) {
    relayer = new hre.ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, hre.ethers.provider);
    console.log('Using separate relayer account from RELAYER_PRIVATE_KEY');
  } else {
    const signers = await hre.ethers.getSigners();
    relayer = signers[0];
    console.log('Using first Hardhat signer as relayer');
  }

  console.log('Relayer address:', relayer.address);

  const gateway = await hre.ethers.getContractAt('GaslessTokenTransferWithFee', gatewayAddr, relayer);

  const token = raw.token;
  const sender = raw.owner;
  const receiver = raw.receiver;
  const amount = raw.amount;
  const deadline = raw.deadline;
  const v = raw.v;
  const r = raw.r;
  const s = raw.s;

  console.log('Calling gateway.sendWithFee...');
  console.log('Token:', token);
  console.log('Sender:', sender);
  console.log('Receiver:', receiver);
  console.log('Amount:', amount);
  console.log('Deadline:', deadline);

  const tx = await gateway.sendWithFee(token, sender, receiver, amount, deadline, v, r, s, { gasLimit: 700000 });
  console.log('tx hash', tx.hash);
  const receipt = await tx.wait();
  console.log('Mined in block', receipt.blockNumber);
  console.log('Etherscan: https://sepolia.etherscan.io/tx/' + receipt.transactionHash);
}

main().catch((e) => { console.error(e); process.exit(1); });

