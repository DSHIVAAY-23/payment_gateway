import * as fs from 'fs';
import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey, Transaction, Ed25519Program } from '@solana/web3.js';

async function main() {
  const permitPath = process.argv[2] || 'out/solana_permit.json';
  const relayerPath = process.argv[3] || process.env.RELAYER_KEYPAIR || '~/.config/solana/id.json';
  const mintStr = process.argv[4];
  const escrowAtaStr = process.argv[5];
  const receiverAtaStr = process.argv[6];
  const relayerAtaStr = process.argv[7];
  const stateStr = process.argv[8];

  if (!mintStr || !escrowAtaStr || !receiverAtaStr || !relayerAtaStr || !stateStr) {
    console.log('Usage: ts-node client/solana/relayer_send.ts <permit_json> <relayer_keypair> <mint> <escrowAta> <receiverAta> <relayerAta> <statePda>');
    process.exit(1);
  }

  const kp = JSON.parse(fs.readFileSync(relayerPath.replace('~', process.env.HOME || ''), 'utf8'));
  const relayer = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(kp));
  const conn = new Connection('http://127.0.0.1:8899');

  const permit = JSON.parse(fs.readFileSync(permitPath, 'utf8'));
  const owner = new PublicKey(permit.owner);
  const programId = new PublicKey(permit.programId);

  const mint = new PublicKey(mintStr);
  const escrowAta = new PublicKey(escrowAtaStr);
  const receiverAta = new PublicKey(receiverAtaStr);
  const relayerAta = new PublicKey(relayerAtaStr);
  const state = new PublicKey(stateStr);

  const amount = new anchor.BN(permit.amount);
  const fee = new anchor.BN(permit.fee);
  const deadline = new anchor.BN(permit.deadline);
  const nonce = new anchor.BN(permit.nonce);
  const signature = Buffer.from(permit.signature, 'hex');

  const message = Buffer.concat([
    Buffer.from('GASLESS_PERMIT'),
    owner.toBuffer(),
    programId.toBuffer(),
    Buffer.from(new anchor.BN(permit.amount).toArray('le', 8)),
    Buffer.from(new anchor.BN(permit.fee).toArray('le', 8)),
    Buffer.from(new anchor.BN(permit.deadline).toArray('le', 8)),
    Buffer.from(new anchor.BN(permit.nonce).toArray('le', 8))
  ]);

  const edIx = Ed25519Program.createInstructionWithPublicKey({
    publicKey: owner.toBytes(),
    message,
    signature
  });

  const idl = await anchor.Program.fetchIdl(programId, new anchor.AnchorProvider(conn, new anchor.Wallet(relayer), {}));
  const program = new anchor.Program(idl!, programId, new anchor.AnchorProvider(conn, new anchor.Wallet(relayer), {}));

  const progIx = await program.methods.relayedTransfer(amount, fee, deadline, owner.toBytes(), signature, nonce).accounts({
    relayer: relayer.publicKey,
    mint,
    pda: (await PublicKey.findProgramAddress([Buffer.from('escrow'), owner.toBuffer(), mint.toBuffer()], programId))[0],
    escrowAta,
    receiverAta,
    relayerAta,
    state,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
  }).instruction();

  const tx = new Transaction().add(edIx, progIx);
  tx.feePayer = relayer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(relayer);
  const sigHash = await conn.sendRawTransaction(tx.serialize());
  console.log('Submitted tx', sigHash);
  await conn.confirmTransaction(sigHash);
}

main().catch((e) => { console.error(e); process.exit(1); });


