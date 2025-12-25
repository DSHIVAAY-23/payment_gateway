// scripts/relayer_send_permit2_dual.js
/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import hre from 'hardhat';

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
];

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
  const tokenAddr = permit?.permitted?.[0]?.token;
  const amount = hre.ethers.BigNumber.from(permit?.permitted?.[0]?.amount || 0);

  if (!tokenAddr) throw new Error('Permit JSON missing token address');
  if (amount.isZero()) throw new Error('Permit JSON amount is zero');

  const permit2Address = await gateway.PERMIT2();
  const token = new hre.ethers.Contract(tokenAddr, ERC20_ABI, hre.ethers.provider);
  const allowance = await token.allowance(owner, permit2Address);
  if (allowance.lt(amount)) {
    console.error('\n✗ Owner has not approved Permit2 for the requested amount.');
    console.error('  token      :', tokenAddr);
    console.error('  owner      :', owner);
    console.error('  permit2    :', permit2Address);
    console.error('  allowance  :', allowance.toString());
    console.error('  needed     :', amount.toString());
    console.error('\nHave the owner run token.approve(PERMIT2, amount) before retrying.\n');
    throw new Error('Insufficient Permit2 allowance');
  }

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

  // Parse events
  const event = receipt.events?.find(e => e.event === 'PulledAndSplit');
  if (event) {
    console.log('\n--- PulledAndSplit Event ---');
    console.log('Token:', event.args.token);
    console.log('Owner:', event.args.ownerAddr);
    console.log('Receiver:', event.args.receiver);
    console.log('Amount:', event.args.amount.toString());
    console.log('Cut:', event.args.cut.toString());
    console.log('Relayer:', event.args.relayer);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });






