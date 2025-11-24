// scripts/inspect_revert.js
const hre = require('hardhat');
require('dotenv').config();

async function main() {
  const txHash = process.env.TX_HASH;
  if (!txHash) throw new Error('Set TX_HASH env var to the failed tx hash');

  const tx = await hre.ethers.provider.getTransaction(txHash);
  if (!tx) throw new Error('Transaction not found: ' + txHash);

  // Call the tx locally at the same block to get the revert data
  const blockNumber = tx.blockNumber || (await hre.ethers.provider.getBlockNumber());
  // Use a call so we get the revert payload
  let result;
  try {
    result = await hre.ethers.provider.call({ to: tx.to, data: tx.data }, blockNumber - 1);
    console.log('Call returned (no revert):', result);
    return;
  } catch (err) {
    // provider.call may itself throw; try to extract revert data
    if (err.error && err.error.data) {
      result = err.error.data;
    } else if (err.data) {
      result = err.data;
    } else {
      console.error('Could not get revert payload from provider.call; raw error:', err);
      return;
    }
  }

  if (!result || result === '0x') {
    console.log('No revert payload present.');
    return;
  }

  // Standard revert reason ABI: 0x08c379a0 + offset + string length + string
  try {
    const sig = result.slice(0, 10);
    if (sig === '0x08c379a0') {
      // strip selector + offset (10 chars + 64 chars), decode string
      const reasonHex = '0x' + result.slice(10 + 64);
      const reason = hre.ethers.utils.defaultAbiCoder.decode(['string'], reasonHex);
      console.log('Revert reason:', reason[0]);
    } else {
      console.log('Revert data (hex):', result);
    }
  } catch (e) {
    console.error('Failed to decode revert reason:', e, 'raw:', result);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
