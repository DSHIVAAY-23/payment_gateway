// scripts/relayer_monitor.js
/* eslint-disable no-console */
const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  const RPC = process.env.SEPOLIA_RPC;
  if (!RPC) throw new Error('Set SEPOLIA_RPC');
  const provider = new ethers.providers.JsonRpcProvider(RPC);

  let relayerAddress = process.env.RELAYER_ADDRESS;
  if (!relayerAddress && process.env.RELAYER_PRIVATE_KEY) {
    relayerAddress = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address;
  }
  if (!relayerAddress) throw new Error('Set RELAYER_ADDRESS or RELAYER_PRIVATE_KEY');

  const intervalSec = parseInt(process.env.CHECK_INTERVAL_SEC || '15', 10);
  const minEth = ethers.utils.parseEther(process.env.MIN_ETH_THRESHOLD || '0.01');

  console.log('Monitoring relayer balance...');
  console.log('Relayer:', relayerAddress);
  console.log('Threshold:', ethers.utils.formatEther(minEth), 'ETH');
  console.log('Interval:', intervalSec, 'sec');

  async function tick() {
    try {
      const bal = await provider.getBalance(relayerAddress);
      const eth = ethers.utils.formatEther(bal);
      const ok = bal.gte(minEth);
      console.log(new Date().toISOString(), 'Balance:', eth, 'ETH', ok ? '' : '⚠️ LOW BALANCE');
    } catch (e) {
      console.error('Error reading balance:', e.message || e);
    }
  }

  await tick();
  setInterval(tick, intervalSec * 1000);
}

main().catch((e) => { console.error(e); process.exit(1); });






