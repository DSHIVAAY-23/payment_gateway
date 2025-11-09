/* eslint-disable no-console */
require('dotenv').config();
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const PYUSD_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';
  const OWNER_ADDRESS = '0x329b06f125daff5bd16ccb7b3906227e50c18bb2';
  // Use the deployed GaslessTokenTransfer from earlier deployment
  const GASLESS_ADDRESS = process.env.GASLESS_ADDRESS || '0xA6Ed60154D78B9aF278811c6ac0c4259eFEa914E';
  const RECEIVER = process.env.RECEIVER || process.argv[3] || OWNER_ADDRESS;
  const AMOUNT = process.env.AMOUNT || '10';
  const FEE = process.env.FEE || '0.1';

  if (!GASLESS_ADDRESS) {
    throw new Error('GASLESS_ADDRESS required (env or CLI arg)');
  }

  console.log('=== Gasless pyUSD Transfer ===');
  console.log('Token (pyUSD):', PYUSD_ADDRESS);
  console.log('Owner:', OWNER_ADDRESS);
  console.log('Gasless Contract:', GASLESS_ADDRESS);
  console.log('Receiver:', RECEIVER);
  console.log('Amount:', AMOUNT);
  console.log('Fee:', FEE);

  const provider = ethers.provider;
  const token = new ethers.Contract(
    PYUSD_ADDRESS,
    [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
      'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
      'function nonces(address) view returns (uint256)',
      'function DOMAIN_SEPARATOR() view returns (bytes32)'
    ],
    provider
  );

  // Check token info
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  console.log(`\nToken: ${name} (${symbol}), decimals: ${decimals}`);

  // Check balance
  const balance = await token.balanceOf(OWNER_ADDRESS);
  console.log(`Owner balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);

  // Check if permit is supported
  let supportsPermit = false;
  try {
    await token.DOMAIN_SEPARATOR();
    const nonce = await token.nonces(OWNER_ADDRESS);
    supportsPermit = true;
    console.log(`✓ Token supports EIP-2612 permit (nonce: ${nonce.toString()})`);
  } catch (e) {
    console.log('✗ Token does NOT support EIP-2612 permit');
    console.log('  Error:', e.message);
    throw new Error('pyUSD does not support EIP-2612 permit. Consider using Permit2 instead.');
  }

  // Get signer (must be the owner)
  const signers = await ethers.getSigners();
  const ownerSigner = signers.find(s => s.address.toLowerCase() === OWNER_ADDRESS.toLowerCase());
  
  if (!ownerSigner) {
    // Try to create wallet from PRIVATE_KEY if available
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error(`Owner signer not found. Ensure PRIVATE_KEY env var is set to the owner's key.`);
    }
    const wallet = new ethers.Wallet(privateKey, provider);
    if (wallet.address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
      throw new Error(`PRIVATE_KEY does not match owner address ${OWNER_ADDRESS}`);
    }
    console.log('Using wallet from PRIVATE_KEY');
  } else {
    console.log('Using signer from Hardhat accounts');
  }

  const signer = ownerSigner || new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Prepare permit
  const amountWei = ethers.utils.parseUnits(AMOUNT, decimals);
  const feeWei = ethers.utils.parseUnits(FEE, decimals);
  const totalValue = amountWei.add(feeWei);
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  const nonce = await token.nonces(OWNER_ADDRESS);
  const network = await provider.getNetwork();
  const domainSeparator = await token.DOMAIN_SEPARATOR();

  // Build EIP-712 domain (we'll use the token's domain separator)
  const domain = {
    name,
    version: '1',
    chainId: network.chainId,
    verifyingContract: PYUSD_ADDRESS
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
    owner: OWNER_ADDRESS,
    spender: GASLESS_ADDRESS,
    value: totalValue.toString(),
    nonce: nonce.toString(),
    deadline
  };

  console.log('\n--- Signing Permit ---');
  console.log('Domain:', domain);
  console.log('Message:', message);

  const signature = await signer._signTypedData(domain, types, message);
  const { v, r, s } = ethers.utils.splitSignature(signature);

  console.log('Signature v, r, s:', v, r, s);

  // Save permit
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const permitPath = path.join(outDir, 'pyusd_permit.json');
  
  const permitData = {
    TOKEN_ADDRESS: PYUSD_ADDRESS,
    GASLESS_ADDRESS,
    SENDER: OWNER_ADDRESS,
    RECEIVER,
    AMOUNT: amountWei.toString(),
    FEE: feeWei.toString(),
    AMOUNT_READABLE: AMOUNT,
    FEE_READABLE: FEE,
    DEADLINE: deadline,
    V: v,
    R: r,
    S: s,
    NONCE: nonce.toString()
  };

  fs.writeFileSync(permitPath, JSON.stringify(permitData, null, 2));
  console.log(`\nSaved permit to: ${permitPath}`);

  // Now relay it
  console.log('\n--- Relaying Transaction ---');
  
  // Use separate relayer account if RELAYER_PRIVATE_KEY is provided
  let relayer;
  if (process.env.RELAYER_PRIVATE_KEY) {
    relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
    console.log('Using separate relayer account from RELAYER_PRIVATE_KEY');
  } else {
    const [defaultRelayer] = await ethers.getSigners();
    relayer = defaultRelayer;
    console.log('Using first Hardhat signer as relayer (set RELAYER_PRIVATE_KEY for separate account)');
  }
  console.log('Relayer address:', relayer.address);
  
  // Verify relayer has ETH for gas
  const relayerBalance = await provider.getBalance(relayer.address);
  console.log(`Relayer ETH balance: ${ethers.utils.formatEther(relayerBalance)} ETH`);
  if (relayerBalance.lt(ethers.utils.parseEther('0.001'))) {
    console.warn('⚠️  Warning: Relayer has low ETH balance. May fail to pay gas.');
  }

  const gasless = await ethers.getContractAt('GaslessTokenTransfer', GASLESS_ADDRESS);
  const tokenContract = await ethers.getContractAt('ERC20Permit', PYUSD_ADDRESS);

  const beforeReceiver = await tokenContract.balanceOf(RECEIVER);
  const beforeRelayer = await tokenContract.balanceOf(relayer.address);

  console.log('Calling gasless.send(...)');
  const tx = await gasless
    .connect(relayer)
    .send(
      PYUSD_ADDRESS,
      OWNER_ADDRESS,
      RECEIVER,
      amountWei,
      feeWei,
      deadline,
      v,
      r,
      s,
      { gasLimit: 500000 }
    );

  console.log('Transaction sent:', tx.hash);
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('✓ Transaction confirmed in block', receipt.blockNumber);

  const afterReceiver = await tokenContract.balanceOf(RECEIVER);
  const afterRelayer = await tokenContract.balanceOf(relayer.address);

  console.log('\n--- Results ---');
  console.log(`Receiver: ${ethers.utils.formatUnits(afterReceiver, decimals)} ${symbol} (delta: +${ethers.utils.formatUnits(afterReceiver.sub(beforeReceiver), decimals)})`);
  console.log(`Relayer: ${ethers.utils.formatUnits(afterRelayer, decimals)} ${symbol} (delta: +${ethers.utils.formatUnits(afterRelayer.sub(beforeRelayer), decimals)})`);
  console.log(`\nEtherscan: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exitCode = 1;
});

