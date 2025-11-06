import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Keypair, SystemProgram, PublicKey, TransactionInstruction, Transaction, Ed25519Program } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAssociatedTokenAddressSync } from '@solana/spl-token';
import nacl from 'tweetnacl';

describe('gasless_sol', () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.gasless_sol as Program<any>;

  const owner = Keypair.generate();
  const relayer = Keypair.generate();
  const receiver = Keypair.generate();

  let mint: PublicKey;
  let ownerAta: PublicKey;
  let escrowPda: PublicKey;
  let escrowAta: PublicKey;
  let receiverAta: PublicKey;
  let relayerAta: PublicKey;
  let statePda: PublicKey;
  let stateBump: number;
  let pdaBump: number;

  it('setup token mint and accounts', async () => {
    // airdrop SOL
    for (const kp of [owner, relayer, receiver]) {
      await connection.confirmTransaction(await connection.requestAirdrop(kp.publicKey, 2e9));
    }

    mint = await createMint(connection, wallet.payer, wallet.publicKey, null, 9);
    ownerAta = (await getOrCreateAssociatedTokenAccount(connection, wallet.payer, mint, owner.publicKey)).address;
    receiverAta = (await getOrCreateAssociatedTokenAccount(connection, wallet.payer, mint, receiver.publicKey)).address;
    relayerAta = (await getOrCreateAssociatedTokenAccount(connection, wallet.payer, mint, relayer.publicKey)).address;

    await mintTo(connection, wallet.payer, mint, ownerAta, wallet.payer, 1_000_000_000_000n); // 1000 tokens (9 dps)

    // derive PDA and escrow ATA (owned by PDA)
    [escrowPda, pdaBump] = PublicKey.findProgramAddressSync([
      Buffer.from('escrow'), owner.publicKey.toBuffer(), mint.toBuffer()
    ], program.programId);
    escrowAta = getAssociatedTokenAddressSync(mint, escrowPda, true);

    // create escrow ATA and fund it from owner
    await getOrCreateAssociatedTokenAccount(connection, wallet.payer, mint, escrowPda, true);
    await mintTo(connection, wallet.payer, mint, escrowAta, wallet.payer, 0n);
    // move 100 tokens into escrow from owner
    // simplest is to have the owner approve: here use wallet as authority via temporary mint, or do user transfer via owner
    // We'll transfer using the test wallet as authority by making owner sign a transfer instruction via Anchor in airdropped tx
    // For simplicity, we call a direct token transfer using spl-token JS (owner signs)
    const ix = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [],
      data: Buffer.alloc(0)
    });
    // Instead of manual CPI, just mint more to escrow for demo funding parity (not production):
    await mintTo(connection, wallet.payer, mint, escrowAta, wallet.payer, 100_000_000_000n); // 100 tokens

    // derive state PDA
    [statePda, stateBump] = PublicKey.findProgramAddressSync([
      Buffer.from('state'), owner.publicKey.toBuffer(), mint.toBuffer()
    ], program.programId);

    // initialize escrow state
    await program.methods.initializeEscrow(pdaBump)
      .accounts({
        owner: owner.publicKey,
        mint,
        pda: escrowPda,
        escrowAta,
        state: statePda,
        systemProgram: SystemProgram.programId
      })
      .signers([owner])
      .rpc();
  });

  it('relayer executes gasless-like transfer using ed25519 verify + program call', async () => {
    const amount = 10_000_000_000n; // 10 tokens (9 dps)
    const fee = 100_000_000n; // 0.1 token
    const deadline = Math.floor(Date.now() / 1000) + 3600; // +1h
    const nonce = 1n;

    const message = Buffer.concat([
      Buffer.from('GASLESS_PERMIT'),
      owner.publicKey.toBuffer(),
      program.programId.toBuffer(),
      Buffer.from(new Uint8Array(new anchor.BN(amount.toString()).toArray('le', 8))),
      Buffer.from(new Uint8Array(new anchor.BN(fee.toString()).toArray('le', 8))),
      Buffer.from(new Uint8Array(new anchor.BN(deadline).toArray('le', 8))),
      Buffer.from(new Uint8Array(new anchor.BN(nonce.toString()).toArray('le', 8)))
    ]);

    const sig = nacl.sign.detached(new Uint8Array(message), owner.secretKey);

    // Ed25519 verify instruction must be first
    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: owner.publicKey.toBytes(),
      message,
      signature: Buffer.from(sig)
    });

    // program instruction
    const tx = await program.methods.relayedTransfer(
      new anchor.BN(amount.toString()),
      new anchor.BN(fee.toString()),
      new anchor.BN(deadline),
      owner.publicKey.toBytes(),
      Buffer.from(sig),
      new anchor.BN(nonce.toString())
    ).accounts({
      relayer: relayer.publicKey,
      mint,
      pda: escrowPda,
      escrowAta,
      receiverAta,
      relayerAta,
      state: statePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
    }).instruction();

    const txCompiled = new Transaction().add(edIx, tx);
    txCompiled.feePayer = relayer.publicKey;
    txCompiled.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txCompiled.sign(relayer);
    const sigTx = await connection.sendRawTransaction(txCompiled.serialize());
    await connection.confirmTransaction(sigTx);
  });
});


