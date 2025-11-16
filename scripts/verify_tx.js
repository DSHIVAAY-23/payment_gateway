// scripts/verify_tx.js
/* eslint-disable no-console */
const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

const GATEWAY_ABI = [
  'event PulledAndSplit(address indexed token, address indexed ownerAddr, address indexed receiver, uint256 amount, uint256 fee, uint256 cut, address relayer)'
];

async function main() {
  const RPC = process.env.SEPOLIA_RPC;
  const TX_HASH = process.env.TX_HASH || process.argv[2];
  if (!RPC) throw new Error('Set SEPOLIA_RPC');
  if (!TX_HASH) throw new Error('Usage: TX_HASH=0x... node scripts/verify_tx.js');

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  if (!receipt) throw new Error('Receipt not found. Check the tx hash.');

  console.log('Tx status:', receipt.status ? 'SUCCESS' : 'FAILED');
  console.log('Block    :', receipt.blockNumber);

  const ifaceERC20 = new ethers.utils.Interface(ERC20_ABI);
  const ifaceGateway = new ethers.utils.Interface(GATEWAY_ABI);

  console.log('\n--- Logs ---');
  for (const log of receipt.logs) {
    try {
      const parsed = ifaceGateway.parseLog(log);
      if (parsed && parsed.name === 'PulledAndSplit') {
        console.log('[PulledAndSplit]');
        console.log(' token   :', parsed.args.token);
        console.log(' owner   :', parsed.args.ownerAddr);
        console.log(' receiver:', parsed.args.receiver);
        console.log(' amount  :', parsed.args.amount.toString());
        console.log(' fee     :', parsed.args.fee.toString());
        console.log(' cut     :', parsed.args.cut.toString());
        console.log(' relayer :', parsed.args.relayer);
        continue;
      }
    } catch (_) {}
    try {
      const parsed = ifaceERC20.parseLog(log);
      if (parsed && parsed.name === 'Transfer') {
        console.log('[Transfer]');
        console.log(' token   :', log.address);
        console.log(' from    :', parsed.args.from);
        console.log(' to      :', parsed.args.to);
        console.log(' value   :', parsed.args.value.toString());
      }
    } catch (_) {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });




