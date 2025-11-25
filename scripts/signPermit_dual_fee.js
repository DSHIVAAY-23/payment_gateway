// scripts/signPermit_dual_fee.js
// Builds an EIP-2612 permit for dual fee gateway with value = amount

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  const RPC = process.env.SEPOLIA_RPC || process.env.TESTNET_RPC;
  const provider = RPC ? new ethers.providers.JsonRpcProvider(RPC) : ethers.provider;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY');

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const TOKEN = process.env.TOKEN_ADDRESS || '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'; // pyUSD on Sepolia
  const GATEWAY = process.env.GASLESS_ADDRESS;
  if (!GATEWAY) throw new Error('Set GASLESS_ADDRESS (deployed GaslessTokenGatewayDualFee address)');

  const RECEIVER = process.env.RECEIVER || wallet.address;
  const AMOUNT_HUMAN = process.env.AMOUNT || '10';
  const CUT_BPS = process.env.CUT_BPS ? parseInt(process.env.CUT_BPS) : 100;

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

  // Calculate cut for display
  const cut = (amount.mul(CUT_BPS)).div(10000);
  const net = amount.sub(cut);

  console.log('=== Permit Signing for Gateway ===');
  console.log('Token:', TOKEN, `(${name})`);
  console.log('Gateway:', GATEWAY);
  console.log('Owner:', wallet.address);
  console.log('Receiver (Merchant):', RECEIVER);
  console.log('\n--- Amount Breakdown ---');
  console.log('Total Amount:', AMOUNT_HUMAN, name);
  console.log('Cut (' + CUT_BPS + ' bps):', ethers.utils.formatUnits(cut, decimals), name);
  console.log('Net to Merchant:', ethers.utils.formatUnits(net, decimals), name);

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
    value: amount.toString(), // User signs for full amount
    nonce,
    deadline
  };

  console.log('\n--- Signing Permit ---');
  console.log('Domain:', domain);
  console.log('Message:', message);

  const signature = await wallet._signTypedData(domain, types, message);
  const sig = ethers.utils.splitSignature(signature);

  const out = {
    token: TOKEN,
    gateway: GATEWAY,
    owner: wallet.address,
    receiver: RECEIVER,
    amount: amount.toString(),
    cutBps: CUT_BPS,
    deadline,
    v: sig.v,
    r: sig.r,
    s: sig.s
  };

  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(outDir, 'pyusd_permit_dual_fee.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log('\n✅ Wrote permit to', outPath);
  console.log('Signature v, r, s:', sig.v, sig.r, sig.s);
}

main().catch((err) => { console.error(err); process.exit(1); });

