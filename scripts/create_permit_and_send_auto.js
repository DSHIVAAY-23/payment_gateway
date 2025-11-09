#!/usr/bin/env node
/*
 * Automated permit signer + relayer client for Sepolia
 *
 * Reads configuration from environment variables:
 *  - SEPOLIA_RPC / TESTNET_RPC / ETHEREUM_RPC_URL
 *  - PRIVATE_KEY (signer that owns the tokens)
 *  - TOKEN_ADDRESS (ERC20Permit token)
 *  - GASLESS_ADDRESS (GaslessTokenTransfer contract)
 *  - RECEIVER (optional; defaults to signer address)
 *  - AMOUNT, FEE (token amounts as decimals; defaults 10 and 0.1)
 *  - DEADLINE_SECONDS (optional; default 1800 seconds)
 *  - TOKEN_DECIMALS (optional; fallback to token.decimals() or 18)
 *  - TOKEN_VERSION (optional; default '1')
 *  - RELAYER_URL (default http://localhost:3000/api/relay)
 *  - RELAYER_API_KEY / NEXT_PUBLIC_RELAYER_API_KEY (optional header)
 *  - DRY_RUN=1 to print payload without POSTing
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function fetchWrapper(url, init) {
  if (typeof fetch === 'function') {
    return fetch(url, init);
  }
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url, init);
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC || process.env.TESTNET_RPC || process.env.ETHEREUM_RPC_URL;
  if (!rpcUrl) {
    throw new Error('Missing RPC URL. Set SEPOLIA_RPC, TESTNET_RPC, or ETHEREUM_RPC_URL.');
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required (signer that owns the tokens).');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS || process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('TOKEN_ADDRESS (or NEXT_PUBLIC_TOKEN_ADDRESS) is required.');
  }

  const gaslessAddress = process.env.GASLESS_ADDRESS || process.env.NEXT_PUBLIC_GASLESS_ADDRESS;
  if (!gaslessAddress) {
    throw new Error('GASLESS_ADDRESS (or NEXT_PUBLIC_GASLESS_ADDRESS) is required.');
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const receiver = process.env.RECEIVER || wallet.address;
  const amountStr = process.env.AMOUNT || '10';
  const feeStr = process.env.FEE || '0.1';
  const deadlineSeconds = parseInt(process.env.DEADLINE_SECONDS || '1800', 10);

  const tokenAbi = [
    'function name() view returns (string)',
    'function version() view returns (string)',
    'function decimals() view returns (uint8)',
    'function nonces(address) view returns (uint256)'
  ];

  const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

  let tokenName;
  try {
    tokenName = await token.name();
  } catch (err) {
    throw new Error(`Failed to read token name(): ${err.message || err}`);
  }

  let tokenVersion = process.env.TOKEN_VERSION || '1';
  try {
    const version = await token.version();
    if (version) tokenVersion = version;
  } catch (err) {
    // most ERC20Permit tokens lack version(); continue with default
  }

  let decimals = Number(process.env.TOKEN_DECIMALS || NaN);
  if (Number.isNaN(decimals)) {
    try {
      decimals = await token.decimals();
    } catch (err) {
      decimals = 18;
    }
  }

  const amountWei = ethers.utils.parseUnits(amountStr, decimals);
  const feeWei = ethers.utils.parseUnits(feeStr, decimals);
  const totalValue = amountWei.add(feeWei);

  const network = await provider.getNetwork();
  const nonce = await token.nonces(wallet.address);
  const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

  const domain = {
    name: tokenName,
    version: tokenVersion,
    chainId: network.chainId,
    verifyingContract: tokenAddress
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
    spender: gaslessAddress,
    value: totalValue.toString(),
    nonce: nonce.toString(),
    deadline
  };

  console.log('--- Permit Preview ---');
  console.log('Token:', tokenAddress, `(${tokenName})`);
  console.log('Gasless contract:', gaslessAddress);
  console.log('Owner:', wallet.address);
  console.log('Receiver:', receiver);
  console.log('Amount (wei):', amountWei.toString());
  console.log('Fee (wei):', feeWei.toString());
  console.log('Nonce:', nonce.toString());
  console.log('Deadline (unix):', deadline);

  const signature = await wallet._signTypedData(domain, types, message);
  const { v, r, s } = ethers.utils.splitSignature(signature);

  const payload = {
    token: tokenAddress,
    gasless: gaslessAddress,
    owner: wallet.address,
    receiver,
    amountWei: amountWei.toString(),
    feeWei: feeWei.toString(),
    deadline,
    v,
    r,
    s
  };

  const relayerUrl = process.env.RELAYER_URL || 'http://localhost:3000/api/relay';
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = process.env.RELAYER_API_KEY || process.env.NEXT_PUBLIC_RELAYER_API_KEY;
  if (apiKey) headers['x-relayer-key'] = apiKey;

  console.log('\nRelayer URL:', relayerUrl);
  console.log('POST payload:', payload);

  if (process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true') {
    console.log('DRY_RUN enabled – not sending to relayer.');
    return;
  }

  const res = await fetchWrapper(relayerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log('Relayer response status:', res.status);
  console.log('Relayer response body:', text);

  if (!res.ok) {
    throw new Error(`Relayer returned status ${res.status}. See response above.`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('create_permit_and_send_auto error:', err);
    process.exitCode = 1;
  });
}


