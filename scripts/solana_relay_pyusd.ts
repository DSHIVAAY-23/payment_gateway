// scripts/solana_relay_pyusd.ts
// Relay PYUSD permit on devnet
import * as fs from 'fs';
import * as path from 'path';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, Ed25519Program, Keypair, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const PROGRAM_ID = new PublicKey('9wnLiHURHXvYF6AuggZBX4FXPUkwjWMtCWFzosDB3ugh');
const PYUSD_MINT = new PublicKey('CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM');
const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: ts-node scripts/solana_relay_pyusd.ts <permit_json> <relayer_keypair.json> [receiver_pubkey]');
    console.log('Example: ts-node scripts/solana_relay_pyusd.ts out/solana_pyusd_permit.json ~/.config/solana/id.json');
    process.exit(1);
  }

  const permitPath = args[0];
  const relayerPath = args[1].replace('~', process.env.HOME || '');
  const receiverStr = args[2]; // optional, defaults to relayer

  const kp = JSON.parse(fs.readFileSync(relayerPath, 'utf8'));
  const relayer = Keypair.fromSecretKey(Uint8Array.from(kp));
  const conn = new Connection(DEVNET_RPC, 'confirmed');

  const permit = JSON.parse(fs.readFileSync(permitPath, 'utf8'));
  const owner = new PublicKey(permit.owner);
  const programId = new PublicKey(permit.programId);
  const receiver = receiverStr ? new PublicKey(receiverStr) : relayer.publicKey;

  const mint = PYUSD_MINT;
  const amount = new anchor.BN(permit.amount);
  const fee = new anchor.BN(permit.fee);
  const deadline = new anchor.BN(permit.deadline);
  const nonce = new anchor.BN(permit.nonce);
  const signature = Buffer.from(permit.signature, 'hex');

  console.log('Relayer:', relayer.publicKey.toBase58());
  console.log('Owner:', owner.toBase58());
  console.log('Receiver:', receiver.toBase58());
  console.log('Amount:', amount.toString());
  console.log('Fee:', fee.toString());

  // Derive accounts
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), owner.toBuffer(), mint.toBuffer()],
    programId
  );
  const escrowAta = getAssociatedTokenAddressSync(mint, escrowPda, true);
  const receiverAta = getAssociatedTokenAddressSync(mint, receiver);
  const relayerAta = getAssociatedTokenAddressSync(mint, relayer.publicKey);
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('state'), owner.toBuffer(), mint.toBuffer()],
    programId
  );

  console.log('\nAccounts:');
  console.log('Escrow PDA:', escrowPda.toBase58());
  console.log('Escrow ATA:', escrowAta.toBase58());
  console.log('Receiver ATA:', receiverAta.toBase58());
  console.log('Relayer ATA:', relayerAta.toBase58());
  console.log('State PDA:', statePda.toBase58());

  // Build message
  const message = Buffer.concat([
    Buffer.from('GASLESS_PERMIT'),
    owner.toBuffer(),
    programId.toBuffer(),
    Buffer.from(amount.toArray('le', 8)),
    Buffer.from(fee.toArray('le', 8)),
    Buffer.from(deadline.toArray('le', 8)),
    Buffer.from(nonce.toArray('le', 8))
  ]);

  // Ed25519 verify instruction (must be first)
  const edIx = Ed25519Program.createInstructionWithPublicKey({
    publicKey: owner.toBytes(),
    message,
    signature
  });

  // Fetch IDL and create program
  const wallet = new anchor.Wallet(relayer);
  const provider = new anchor.AnchorProvider(conn, wallet, {});
  let program: any;
  
  // Try loading from file first
  const idlPath = path.join(process.cwd(), 'target', 'idl', 'gasless_sol.json');
  if (fs.existsSync(idlPath)) {
    const idlData = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    try {
      // @ts-ignore
      program = new anchor.Program(idlData, programId, provider);
    } catch (e) {
      console.log('Failed to load IDL from file, trying to fetch from chain...');
      const idl = await anchor.Program.fetchIdl(programId, provider);
      if (!idl) {
        throw new Error('Failed to fetch IDL from chain');
      }
      // @ts-ignore
      program = new anchor.Program(idl, programId, provider);
    }
  } else {
    const idl = await anchor.Program.fetchIdl(programId, provider);
    if (!idl) {
      throw new Error('Failed to fetch IDL');
    }
    // @ts-ignore
    program = new anchor.Program(idl, programId, provider);
  }

  // Program instruction
  const progIx = await program.methods
    .relayedTransfer(amount, fee, deadline, owner.toBytes(), Array.from(signature), nonce)
    .accounts({
      relayer: relayer.publicKey,
      mint,
      pda: escrowPda,
      escrowAta,
      receiverAta,
      relayerAta,
      state: statePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY
    })
    .instruction();

  const tx = new Transaction().add(edIx, progIx);
  tx.feePayer = relayer.publicKey;
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(relayer);

  console.log('\nSending transaction...');
  const sigHash = await conn.sendRawTransaction(tx.serialize());
  console.log('Transaction:', sigHash);
  console.log('View on Solana Explorer: https://explorer.solana.com/tx/' + sigHash + '?cluster=devnet');
  
  await conn.confirmTransaction(sigHash);
  console.log('✓ Transaction confirmed!');
}

main().catch((e) => {
  console.error(e);
  if (e.logs) {
    console.error('Program logs:');
    e.logs.forEach((log: string) => console.error('  ', log));
  }
  process.exit(1);
});

