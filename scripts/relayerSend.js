/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const { formatToken, parseToken } = require('../utils/format');

async function loadFromFile(defaults) {
  try {
    const p = path.join(process.cwd(), 'out', 'permit.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { ...defaults, ...data };
    }
  } catch (e) {
    // ignore
  }
  return defaults;
}

async function main() {
  const defaults = {
    TOKEN_ADDRESS: process.env.TOKEN_ADDRESS,
    GASLESS_ADDRESS: process.env.GASLESS_ADDRESS,
    SENDER: process.env.SENDER,
    RECEIVER: process.env.RECEIVER,
    AMOUNT: process.env.AMOUNT && parseToken(process.env.AMOUNT, 18).toString(),
    FEE: process.env.FEE && parseToken(process.env.FEE, 18).toString(),
    DEADLINE: process.env.DEADLINE && parseInt(process.env.DEADLINE, 10),
    V: process.env.V && parseInt(process.env.V, 10),
    R: process.env.R,
    S: process.env.S
  };

  const cfg = await loadFromFile(defaults);
  const required = ['TOKEN_ADDRESS', 'GASLESS_ADDRESS', 'SENDER', 'RECEIVER', 'AMOUNT', 'FEE', 'DEADLINE', 'V', 'R', 'S'];
  for (const k of required) {
    if (cfg[k] === undefined || cfg[k] === null || cfg[k] === '') {
      throw new Error(`Missing required field: ${k}. Provide via env or out/permit.json`);
    }
  }

  const [relayer] = await ethers.getSigners();
  console.log('Relayer:', relayer.address);

  const gasless = await ethers.getContractAt('GaslessTokenTransfer', cfg.GASLESS_ADDRESS);
  const token = await ethers.getContractAt('ERC20Permit', cfg.TOKEN_ADDRESS);

  const beforeReceiver = await token.balanceOf(cfg.RECEIVER);
  const beforeRelayer = await token.balanceOf(relayer.address);

  console.log('Sending gasless transfer...');
  const tx = await gasless
    .connect(relayer)
    .send(
      cfg.TOKEN_ADDRESS, // interface compatible
      cfg.SENDER,
      cfg.RECEIVER,
      cfg.AMOUNT,
      cfg.FEE,
      cfg.DEADLINE,
      cfg.V,
      cfg.R,
      cfg.S
    );
  const receipt = await tx.wait();
  console.log('Tx mined in block', receipt.blockNumber, 'hash', receipt.transactionHash);

  const afterReceiver = await token.balanceOf(cfg.RECEIVER);
  const afterRelayer = await token.balanceOf(relayer.address);

  console.log('--- Balances ---');
  console.log('Receiver:', formatToken(afterReceiver, 18), '(delta +', formatToken(afterReceiver.sub(beforeReceiver), 18) + ')');
  console.log('Relayer :', formatToken(afterRelayer, 18), '(delta +', formatToken(afterRelayer.sub(beforeRelayer), 18) + ')');

  console.log('\nDone. If deltas are 10 and 0.1 respectively, it worked.');
}

main().catch((err) => {
  console.error('Relayer send failed:', err.message || err);
  console.error('Troubleshooting: check chainId mismatch, nonce usage, deadline, and token address.');
  process.exitCode = 1;
});


