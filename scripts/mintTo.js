/* eslint-disable no-console */
require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const to = process.env.TO || process.env.SENDER;
  const amountStr = process.env.AMOUNT || '1000';
  if (!tokenAddress || !to) throw new Error('TOKEN_ADDRESS and TO (or SENDER) are required');
  const amount = ethers.utils.parseUnits(amountStr, 18);

  const [signer] = await ethers.getSigners();
  const token = await ethers.getContractAt('ERC20Permit', tokenAddress, signer);
  const tx = await token.mint(to, amount);
  const rcpt = await tx.wait();
  console.log(`Minted ${amount.toString()} to ${to} in tx ${rcpt.transactionHash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });



