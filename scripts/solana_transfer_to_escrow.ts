// scripts/solana_transfer_to_escrow.ts
// Transfer PYUSD from owner account to escrow ATA
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAccount, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';

const PYUSD_MINT = new PublicKey('CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM');
const DEVNET_RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: ts-node scripts/solana_transfer_to_escrow.ts <owner_keypair.json> <amount_in_base_units>');
    console.log('Example: ts-node scripts/solana_transfer_to_escrow.ts ~/.config/solana/id.json 1000000');
    console.log('Note: PYUSD has 6 decimals, so 1000000 = 1 PYUSD');
    process.exit(1);
  }

  const keypairPath = args[0].replace('~', process.env.HOME || '');
  const amount = BigInt(args[1]);
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const owner = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log('Owner:', owner.publicKey.toBase58());
  console.log('Amount:', amount.toString(), 'base units');

  // Get owner's PYUSD ATA
  const ownerAta = getAssociatedTokenAddressSync(PYUSD_MINT, owner.publicKey);
  console.log('Owner ATA:', ownerAta.toBase58());

  // Derive escrow PDA and ATA
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), owner.publicKey.toBuffer(), PYUSD_MINT.toBuffer()],
    PROGRAM_ID
  );
  const escrowAta = getAssociatedTokenAddressSync(PYUSD_MINT, escrowPda, true);
  console.log('Escrow ATA:', escrowAta.toBase58());

  // Check owner balance
  try {
    const ownerAccount = await getAccount(connection, ownerAta);
    console.log('Owner balance:', ownerAccount.amount.toString());
    if (ownerAccount.amount < amount) {
      console.error(`Insufficient balance. Need ${amount}, have ${ownerAccount.amount}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('Owner ATA not found or error:', e);
    console.log('Make sure you have PYUSD in your account.');
    process.exit(1);
  }

  // Check escrow ATA exists
  try {
    await getAccount(connection, escrowAta);
  } catch (e) {
    console.error('Escrow ATA not found. Initialize escrow first.');
    console.log('Run: ts-node scripts/solana_init_pyusd.ts', keypairPath);
    process.exit(1);
  }

  // Create transfer instruction
  const transferIx = createTransferInstruction(
    ownerAta,
    escrowAta,
    owner.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(transferIx);
  tx.feePayer = owner.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(owner);

  console.log('\nSending transfer transaction...');
  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log('Transaction:', sig);
  console.log('View on Solana Explorer: https://explorer.solana.com/tx/' + sig + '?cluster=devnet');
  
  await connection.confirmTransaction(sig);
  console.log('✓ Transfer confirmed!');

  // Check new balances
  const ownerAccount = await getAccount(connection, ownerAta);
  const escrowAccount = await getAccount(connection, escrowAta);
  console.log('\nNew balances:');
  console.log('Owner:', ownerAccount.amount.toString());
  console.log('Escrow:', escrowAccount.amount.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

