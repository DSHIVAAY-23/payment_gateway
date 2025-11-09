// scripts/signPermit_pyusd_for_fee.js
// Builds an EIP-2612 permit for pyUSD with value = amount (not amount+fee)

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  const RPC = process.env.SEPOLIA_RPC || process.env.TESTNET_RPC;
  if (!RPC) {
    // Try using Hardhat provider if available
    const provider = ethers.provider;
    if (!provider) throw new Error('Set SEPOLIA_RPC or use --network sepolia');
  }

  const provider = RPC ? new ethers.providers.JsonRpcProvider(RPC) : ethers.provider;
  const PRIVATE_KEY = process.env.PRIVATE_KEY; // owner's private key
  if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY');

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const TOKEN = process.env.TOKEN_ADDRESS || '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'; // pyUSD
  const GATEWAY = process.env.GASLESS_ADDRESS; // contract that will be spender
  if (!GATEWAY) throw new Error('Set GASLESS_ADDRESS (deployed GaslessTokenTransferWithFee address)');

  const RECEIVER = process.env.RECEIVER || wallet.address;
  const AMOUNT_HUMAN = process.env.AMOUNT || '10';
  const FEE_BPS = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 100;

  const token = new ethers.Contract(TOKEN, [
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
    'function nonces(address) view returns (uint256)'
  ], provider);

  const name = await token.name();
  const decimals = await token.decimals();
  const nonce = (await token.nonces(wallet.address)).toString();
  const chainId = (await provider.getNetwork()).chainId;
  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, decimals);
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  const domain = {
    name,
    version: '1',
    chainId,
    verifyingContract: TOKEN
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

  const message = {
    owner: wallet.address,
    spender: GATEWAY,
    value: amount.toString(),
    nonce,
    deadline
  };

  console.log('Signing permit for', wallet.address, 'amount', AMOUNT_HUMAN);
  console.log('Gateway (spender):', GATEWAY);
  console.log('Receiver:', RECEIVER);
  console.log('Fee BPS:', FEE_BPS);

  const signature = await wallet._signTypedData(domain, types, message);
  const sig = ethers.utils.splitSignature(signature);

  const out = {
    token: TOKEN,
    gateway: GATEWAY,
    owner: wallet.address,
    receiver: RECEIVER,
    amount: amount.toString(),
    feeBps: FEE_BPS,
    deadline,
    v: sig.v,
    r: sig.r,
    s: sig.s
  };

  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(outDir, 'pyusd_permit_fee.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log('Wrote permit to', outPath);
}

main().catch((err) => { console.error(err); process.exit(1); });

