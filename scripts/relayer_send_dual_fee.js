// scripts/relayer_send_dual_fee.js
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const filePath = process.env.PERMIT_JSON_PATH || path.join(process.cwd(), 'out', 'pyusd_permit_dual_fee.json');
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

  // Check relayer balance
  const relayerBalance = await hre.ethers.provider.getBalance(relayer.address);
  console.log('Relayer ETH balance:', hre.ethers.utils.formatEther(relayerBalance), 'ETH');
  if (relayerBalance.lt(hre.ethers.utils.parseEther('0.001'))) {
    console.warn('⚠️  Warning: Relayer has low ETH balance. May fail to pay gas.');
  }

  const gateway = await hre.ethers.getContractAt('GaslessTokenGatewayDualFee', gatewayAddr, relayer);

  const token = raw.token;
  const sender = raw.owner;
  const receiver = raw.receiver;
  const amount = raw.amount;
  const deadline = raw.deadline;
  const v = raw.v;
  const r = raw.r;
  const s = raw.s;

  // Get fee and cut BPS from permit or contract
  const feeBps = raw.feeBps || (await gateway.feeBps()).toNumber();
  const cutBps = raw.cutBps || (await gateway.cutBps()).toNumber();
  const feeCollector = await gateway.feeCollector();
  const cutCollector = await gateway.cutCollector();

  console.log('\n--- Transaction Details ---');
  console.log('Token:', token);
  console.log('Sender:', sender);
  console.log('Receiver (Merchant):', receiver);
  console.log('Amount:', amount);
  console.log('Fee BPS:', feeBps);
  console.log('Cut BPS:', cutBps);
  console.log('Fee Collector:', feeCollector);
  console.log('Cut Collector:', cutCollector);
  console.log('Deadline:', deadline);

  console.log('\nCalling gateway.sendWithDualCollection...');
  const tx = await gateway.sendWithDualCollection(
    token,      // IERC20 token
    token,      // permitToken (same for EIP-2612)
    sender,
    receiver,
    amount,
    deadline,
    v,
    r,
    s,
    { gasLimit: 800000 }
  );

  console.log('Transaction sent:', tx.hash);
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('✅ Mined in block', receipt.blockNumber);
  console.log('Etherscan: https://sepolia.etherscan.io/tx/' + receipt.transactionHash);

  // Parse events
  const event = receipt.events?.find(e => e.event === 'PulledAndSplit');
  if (event) {
    console.log('\n--- PulledAndSplit Event ---');
    console.log('Token:', event.args.token);
    console.log('Sender:', event.args.sender);
    console.log('Receiver:', event.args.receiver);
    console.log('Amount:', event.args.amount.toString());
    console.log('Fee:', event.args.fee.toString());
    console.log('Cut:', event.args.cut.toString());
    console.log('Relayer:', event.args.relayer);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });



