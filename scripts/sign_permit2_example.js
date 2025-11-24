// scripts/sign_permit2_example.js
// NOTE: This is a minimal example for local testing. For production, use @uniswap/permit2 SDK to build the exact typed data and signature safely.
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  const RPC = process.env.SEPOLIA_RPC;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const PERMIT2_ADDRESS = process.env.PERMIT2_ADDRESS || '0x000000000022D473030F116dDEE9F6B43AC78BA3';
  const USDT = process.env.USDT_ADDRESS || '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
  const GATEWAY = process.env.GASLESS_ADDRESS;
  const RECEIVER = process.env.RECEIVER || process.env.FEE_COLLECTOR || ethers.constants.AddressZero;
  const AMOUNT = process.env.AMOUNT || '10';

  if (!RPC) throw new Error('Set SEPOLIA_RPC');
  if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY');
  if (!GATEWAY) throw new Error('Set GASLESS_ADDRESS (gateway address)');
  if (!RECEIVER || RECEIVER === ethers.constants.AddressZero) throw new Error('Set RECEIVER');

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // USDT on Sepolia has 6 decimals
  const decimals = 6;
  const amountBN = ethers.utils.parseUnits(AMOUNT, decimals);
  const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(8)).toString(); // example nonce; SDK will manage nonces
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // Permit2 typed data (simplified). Use SDK in production.
  const domain = {
    name: 'Permit2',
    chainId: (await provider.getNetwork()).chainId,
    verifyingContract: PERMIT2_ADDRESS,
  };

  const types = {
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    PermitBatchTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions[]' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  // Permit object
  const permit = {
    permitted: [{ token: USDT, amount: amountBN.toString() }],
    nonce: nonce,
    deadline: deadline,
  };

  // Permit typed-data includes the spender (gateway). This must match the actual caller.
  const permitForSig = {
    ...permit,
    spender: GATEWAY,
  };

  // Transfer details instruct Permit2 how much to pull and where
  // For the gateway pattern, we pull to the gateway itself; the gateway will then split and forward.
  const transferDetails = [
    { to: GATEWAY, requestedAmount: amountBN.toString() },
  ];

  console.log('Owner:', wallet.address);
  console.log('Gateway:', GATEWAY);
  console.log('USDT:', USDT);
  console.log('Amount:', AMOUNT, `(wei ${amountBN.toString()})`);
  console.log('Signing Permit2 typed data...');

  const signature = await wallet._signTypedData(domain, types, permitForSig);

  const out = {
    gateway: GATEWAY,
    permit,
    transferDetails,
    owner: wallet.address,
    signature,
    receiver: RECEIVER,
  };

  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(outDir, 'permit2_usdt.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Wrote', outPath);
  console.log('NOTE: This example is for testing only. Use the @uniswap/permit2 SDK in production.');
}

main().catch((e) => { console.error(e); process.exit(1); });




