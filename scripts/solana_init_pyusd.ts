// scripts/solana_init_pyusd.ts
// Initialize escrow for PYUSD on devnet (no Anchor.Program, pure web3.js)

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Program + mint from your runbook / IDL
const PROGRAM_ID = new PublicKey('9wnLiHURHXvYF6AuggZBX4FXPUkwjWMtCWFzosDB3ugh');
const PYUSD_MINT = new PublicKey('CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM');
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Discriminator for initialize_escrow from gasless_sol.json IDL
// "initialize_escrow" → discriminator: [243,160,77,153,11,92,48,209]
const INITIALIZE_ESCROW_DISCRIMINATOR = Buffer.from([
  243, 160, 77, 153, 11, 92, 48, 209,
]);

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: ts-node scripts/solana_init_pyusd.ts <owner_keypair.json>');
    console.log('Example: ts-node scripts/solana_init_pyusd.ts ~/.config/solana/id.json');
    process.exit(1);
  }

  // Load owner keypair
  const keypairPath = args[0].replace('~', process.env.HOME || '');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const owner = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log('Owner:', owner.publicKey.toBase58());
  console.log('PYUSD Mint:', PYUSD_MINT.toBase58());
  console.log('Program ID:', PROGRAM_ID.toBase58());

  // Derive PDAs (same seeds as in your IDL)
  const [escrowPda, pdaBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), owner.publicKey.toBuffer(), PYUSD_MINT.toBuffer()],
    PROGRAM_ID,
  );
  const [statePda, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state'), owner.publicKey.toBuffer(), PYUSD_MINT.toBuffer()],
    PROGRAM_ID,
  );

  console.log('\nDerived PDAs:');
  console.log('Escrow PDA:', escrowPda.toBase58());
  console.log('State PDA :', statePda.toBase58());
  console.log('PDA Bump  :', pdaBump);

  // Escrow ATA (token account owned by escrow PDA)
  const escrowAta = getAssociatedTokenAddressSync(PYUSD_MINT, escrowPda, true);
  console.log('Escrow ATA:', escrowAta.toBase58());

  // Ensure escrow ATA exists
  try {
    const escrowAtaInfo = await connection.getAccountInfo(escrowAta);
    if (!escrowAtaInfo) {
      console.log('\n⚠️  Escrow ATA does not exist yet.');
      console.log('You need to create it first. Run:');
      console.log(`spl-token create-account ${PYUSD_MINT.toBase58()} --owner ${escrowPda.toBase58()}`);
      console.log('Then re-run this script.');
      process.exit(1);
    }
    console.log('✓ Escrow ATA exists');
  } catch (e) {
    console.error('Error checking escrow ATA:', e);
    process.exit(1);
  }

  // If state already exists, skip init
  const stateInfo = await connection.getAccountInfo(statePda);
  if (stateInfo) {
    console.log('\n⚠️  State PDA already initialized. Skipping initialization.');
    console.log('If you want to reinitialize, close the account first.');
    process.exit(0);
  }

  console.log('\nInitializing escrow (manual instruction)...');

  // Build data: 8-byte discriminator + 1-byte bump (matches Rust: initialize_escrow(bump: u8))
  const data = Buffer.concat([
    INITIALIZE_ESCROW_DISCRIMINATOR,
    Buffer.from([pdaBump]), // bump as u8
  ]);

  // Accounts (must match IDL order):
  // 1. owner (writable, signer)
  // 2. mint
  // 3. pda (escrow PDA)
  // 4. escrow_ata (writable)
  // 5. state (writable)
  // 6. system_program
  const keys = [
    { pubkey: owner.publicKey, isWritable: true, isSigner: true },
    { pubkey: PYUSD_MINT, isWritable: false, isSigner: false },
    { pubkey: escrowPda, isWritable: false, isSigner: false },
    { pubkey: escrowAta, isWritable: true, isSigner: false },
    { pubkey: statePda, isWritable: true, isSigner: false },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
  ];

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  const tx = new Transaction().add(ix);

  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);
    console.log('✓ Initialization successful!');
    console.log('Transaction:', sig);
    console.log('View on Solana Explorer: https://explorer.solana.com/tx/' + sig + '?cluster=devnet');

    // Save state metadata like before
    const stateDir = path.join(process.cwd(), 'out');
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'solana_pyusd_state.json');

    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          owner: owner.publicKey.toBase58(),
          mint: PYUSD_MINT.toBase58(),
          escrowPda: escrowPda.toBase58(),
          escrowAta: escrowAta.toBase58(),
          statePda: statePda.toBase58(),
          pdaBump,
          stateBump,
          programId: PROGRAM_ID.toBase58(),
        },
        null,
        2,
      ),
    );

    console.log('\nSaved state to:', statePath);
  } catch (e: any) {
    console.error('Initialization failed:', e.message || e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
