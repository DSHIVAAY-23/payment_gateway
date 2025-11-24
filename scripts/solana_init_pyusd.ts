// scripts/solana_init_pyusd.ts
// Initialize escrow for PYUSD on devnet
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('9wnLiHURHXvYF6AuggZBX4FXPUkwjWMtCWFzosDB3ugh');
const PYUSD_MINT = new PublicKey('CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM');
const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: ts-node scripts/solana_init_pyusd.ts <owner_keypair.json>');
    console.log('Example: ts-node scripts/solana_init_pyusd.ts ~/.config/solana/id.json');
    process.exit(1);
  }

  const keypairPath = args[0].replace('~', process.env.HOME || '');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const owner = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load IDL and create program
  let program: any;
  const idlPath = path.join(process.cwd(), 'target', 'idl', 'gasless_sol.json');
  if (fs.existsSync(idlPath)) {
    console.log('Loading IDL from file...');
    const idlData = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    // Anchor expects the IDL in a specific format - ensure address is at root level
    if (idlData.address) {
      // IDL format is correct
    } else if (idlData.metadata?.address) {
      // Move address to root
      idlData.address = idlData.metadata.address;
    }
    try {
      // @ts-ignore - TypeScript type issues with Anchor Program
      program = new anchor.Program(idlData, PROGRAM_ID, provider);
    } catch (e: any) {
      console.error('Failed to load IDL:', e.message);
      console.log('Trying to fetch IDL from chain instead...');
      const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
      if (!idl) {
        console.error('Failed to fetch IDL from chain. Make sure program is deployed.');
        process.exit(1);
      }
      // @ts-ignore
      program = new anchor.Program(idl, PROGRAM_ID, provider);
    }
  } else {
    console.log('IDL file not found, trying to fetch from chain...');
    const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) {
      console.error('Failed to fetch IDL. Make sure program is deployed.');
      console.error('You may need to run: anchor build');
      process.exit(1);
    }
    // @ts-ignore
    program = new anchor.Program(idl, PROGRAM_ID, provider);
  }

  console.log('Owner:', owner.publicKey.toBase58());
  console.log('PYUSD Mint:', PYUSD_MINT.toBase58());
  console.log('Program ID:', PROGRAM_ID.toBase58());

  // Derive PDAs
  const [escrowPda, pdaBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), owner.publicKey.toBuffer(), PYUSD_MINT.toBuffer()],
    PROGRAM_ID
  );
  const [statePda, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state'), owner.publicKey.toBuffer(), PYUSD_MINT.toBuffer()],
    PROGRAM_ID
  );

  console.log('\nDerived PDAs:');
  console.log('Escrow PDA:', escrowPda.toBase58());
  console.log('State PDA:', statePda.toBase58());
  console.log('PDA Bump:', pdaBump);

  // Get or create escrow ATA (owned by PDA)
  const escrowAta = getAssociatedTokenAddressSync(PYUSD_MINT, escrowPda, true);
  console.log('Escrow ATA:', escrowAta.toBase58());

  try {
    // Check if escrow ATA exists
    const escrowAtaInfo = await connection.getAccountInfo(escrowAta);
    if (!escrowAtaInfo) {
      console.log('\n⚠️  Escrow ATA does not exist yet.');
      console.log('You need to create it first. Run:');
      console.log(`spl-token create-account ${PYUSD_MINT.toBase58()} --owner ${escrowPda.toBase58()}`);
      console.log('Or use a script to create it programmatically.');
      process.exit(1);
    }
    console.log('✓ Escrow ATA exists');
  } catch (e) {
    console.error('Error checking escrow ATA:', e);
    process.exit(1);
  }

  // Check if state already exists
  const stateInfo = await connection.getAccountInfo(statePda);
  if (stateInfo) {
    console.log('\n⚠️  State PDA already initialized. Skipping initialization.');
    console.log('If you want to reinitialize, close the account first.');
    process.exit(0);
  }

  // Initialize escrow using manual instruction construction
  console.log('\nInitializing escrow...');
  try {
    // Build instruction data: 8-byte discriminator + 1-byte bump
    const discriminator = Buffer.from([0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91]); // Placeholder - need actual discriminator
    // For now, let's use Anchor's instruction builder if we can get the IDL working
    // Otherwise, we'll need to calculate the discriminator
    
    // Try loading IDL and using Program class
    let program: any;
    const idlPath = path.join(process.cwd(), 'target', 'idl', 'gasless_sol.json');
    if (fs.existsSync(idlPath)) {
      const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
      // @ts-ignore
      program = new anchor.Program(idl, PROGRAM_ID, provider);
    } else {
      // Fallback: try to fetch from chain
      const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
      if (idl) {
        // @ts-ignore
        program = new anchor.Program(idl, PROGRAM_ID, provider);
      } else {
        throw new Error('Could not load IDL. Please run: anchor build');
      }
    }
    
    const tx = await program.methods.initializeEscrow(pdaBump)
      .accounts({
        owner: owner.publicKey,
        mint: PYUSD_MINT,
        pda: escrowPda,
        escrowAta: escrowAta,
        state: statePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✓ Initialization successful!');
    console.log('Transaction:', tx);
    console.log('View on Solana Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');

    // Save state info
    const stateDir = path.join(process.cwd(), 'out');
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'solana_pyusd_state.json');
    fs.writeFileSync(statePath, JSON.stringify({
      owner: owner.publicKey.toBase58(),
      mint: PYUSD_MINT.toBase58(),
      escrowPda: escrowPda.toBase58(),
      escrowAta: escrowAta.toBase58(),
      statePda: statePda.toBase58(),
      pdaBump,
      stateBump,
      programId: PROGRAM_ID.toBase58(),
    }, null, 2));
    console.log('\nSaved state to:', statePath);
  } catch (e: any) {
    console.error('Initialization failed:', e.message);
    if (e.logs) {
      console.error('Program logs:');
      e.logs.forEach((log: string) => console.error('  ', log));
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

