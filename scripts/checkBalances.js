/* eslint-disable no-console */
require('dotenv').config();
const { ethers } = require('hardhat');
const { formatToken } = require('../utils/format');

async function main() {
  const tokenAddr = process.env.TOKEN_ADDRESS || process.argv[2];
  if (!tokenAddr) throw new Error('TOKEN_ADDRESS required (env or argv[2])');
  const addresses = (process.env.ADDRS || '').split(',').filter(Boolean);
  const signers = await ethers.getSigners();
  while (addresses.length < 3) addresses.push(signers[addresses.length]?.address);

  const token = await ethers.getContractAt('ERC20Permit', tokenAddr);
  console.log('Token:', tokenAddr);
  for (const a of addresses) {
    if (!a) continue;
    const bal = await token.balanceOf(a);
    console.log(a, '=>', formatToken(bal, 18));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


