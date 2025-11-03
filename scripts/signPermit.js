/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function main() {
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || process.argv[2];
  const GASLESS_ADDRESS = process.env.GASLESS_ADDRESS || process.argv[3];
  if (!TOKEN_ADDRESS || !GASLESS_ADDRESS) {
    throw new Error('TOKEN_ADDRESS and GASLESS_ADDRESS are required (env or CLI).');
  }

  const [relayer, user] = await ethers.getSigners();

  const sender = process.env.SENDER || user.address; // owner of tokens
  const receiver = process.env.RECEIVER || relayer.address; // default to relayer for demo

  const amountStr = process.env.AMOUNT || '10';
  const feeStr = process.env.FEE || '0.1';
  const amount = ethers.utils.parseUnits(amountStr, 18);
  const fee = ethers.utils.parseUnits(feeStr, 18);

  const now = Math.floor(Date.now() / 1000);
  const deadline = process.env.DEADLINE ? parseInt(process.env.DEADLINE, 10) : now + 3600;

  const erc20 = await ethers.getContractAt('ERC20Permit', TOKEN_ADDRESS);
  const name = await erc20.name();

  // Fetch current nonce for the sender
  const nonce = await erc20.nonces(sender);
  const chainId = await user.getChainId();

  // EIP-712 domain and types for permit
  const domain = {
    name,
    version: '1',
    chainId,
    verifyingContract: TOKEN_ADDRESS
  };

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };

  // We approve amount + fee in one go to cover receiver + relayer payment
  const value = amount.add(fee);
  const message = {
    owner: sender,
    spender: GASLESS_ADDRESS,
    value: value.toString(),
    nonce: nonce.toString(),
    deadline
  };

  const signer = await ethers.getSigner(sender);
  const sig = await signer._signTypedData(domain, types, message);
  const { v, r, s } = ethers.utils.splitSignature(sig);

  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'permit.json');

  const payload = {
    TOKEN_ADDRESS,
    GASLESS_ADDRESS,
    SENDER: sender,
    RECEIVER: receiver,
    AMOUNT: amount.toString(),
    FEE: fee.toString(),
    DEADLINE: deadline,
    V: v,
    R: r,
    S: s
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log('--- Permit Signed ---');
  console.log('domain:', domain);
  console.log('message:', message);
  console.log('signature v,r,s:', v, r, s);
  console.log(`Saved to ${outPath}`);
  console.log('\nRun relayer next:');
  console.log('  npx hardhat run scripts/relayerSend.js --network localhost');
}

main().catch((err) => {
  console.error('Error signing permit:', err);
  process.exitCode = 1;
});


