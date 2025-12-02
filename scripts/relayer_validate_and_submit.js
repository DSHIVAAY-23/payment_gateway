#!/usr/bin/env node
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

const RPC_URL = process.env.SOLANA_URL || "https://api.devnet.solana.com";
const conn = new Connection(RPC_URL, "confirmed");

function loadKeypair(keyPath, label) {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`${label} keypair not found at ${keyPath}`);
  }
  const raw = fs.readFileSync(keyPath, "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function resolveRelayerKey() {
  if (process.env.RELAYER_KEYPATH) return process.env.RELAYER_KEYPATH;
  const defaultPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  if (fs.existsSync(defaultPath)) return defaultPath;
  const fallback = path.join(process.cwd(), "relayer_dev_keypair.json");
  if (fs.existsSync(fallback)) return fallback;
  throw new Error("Relayer keypair not found. Set RELAYER_KEYPATH.");
}

function decodeTransaction(base64) {
  const raw = Buffer.from(base64, "base64");
  try {
    return Transaction.from(raw);
  } catch {
    const vtx = VersionedTransaction.deserialize(raw);
    const legacy = Transaction.from(
      new TransactionMessage(vtx.message).compileLegacyTransaction().serialize({
        requireAllSignatures: false,
      })
    );
    legacy.signatures = vtx.signatures.map((sig, i) => ({
      signature: sig,
      publicKey: vtx.message.staticAccountKeys[i],
    }));
    return legacy;
  }
}

async function main() {
  try {
    if (!fs.existsSync("partial_tx.base64")) {
      throw new Error("partial_tx.base64 not found. Run the builder first.");
    }

    const relayerKeyPath = resolveRelayerKey();
    const relayerKP = loadKeypair(relayerKeyPath, "Relayer");
    console.log("Relayer pub:", relayerKP.publicKey.toBase58());

    const envMint = process.env.MINT_ADDRESS;
    const envFee = process.env.FEE_COLLECTOR_PUBKEY;
    const envUser = process.env.USER_PUBKEY;

    if(!envMint) throw new Error("MINT_ADDRESS not set in env");
    if(!envFee)  throw new Error("FEE_COLLECTOR_PUBKEY not set in env");
    if(!envUser) throw new Error("USER_PUBKEY not set in env");

    const mint = new PublicKey(envMint);
    const feeCollector = new PublicKey(envFee);
    const userPub = new PublicKey(envUser);

    const merchantArg = process.argv[2] || process.env.MERCHANT_PUBKEY || relayerKP.publicKey.toBase58();
    const merchantPub = new PublicKey(merchantArg);

    const base64 = fs.readFileSync("partial_tx.base64", "utf8").trim();
    const tx = decodeTransaction(base64);

    if (!tx.feePayer?.equals(relayerKP.publicKey)) {
      throw new Error(`feePayer mismatch: tx=${tx.feePayer?.toBase58()} relayer=${relayerKP.publicKey.toBase58()}`);
    }

    const progs = tx.instructions.map(ix => ix.programId.toBase58());
    console.log("Instruction programs:", progs);

    const tokenProgram = process.env.TOKEN_PROGRAM_ID ? new PublicKey(process.env.TOKEN_PROGRAM_ID) : TOKEN_PROGRAM_ID;
    const ataProgram = process.env.ASSOCIATED_TOKEN_PROGRAM_ID ? new PublicKey(process.env.ASSOCIATED_TOKEN_PROGRAM_ID) : ASSOCIATED_TOKEN_PROGRAM_ID;

    const expectedMerchantAta = await getAssociatedTokenAddress(mint, merchantPub, false, tokenProgram, ataProgram);
    const expectedFeeAta = await getAssociatedTokenAddress(mint, feeCollector, false, tokenProgram, ataProgram);

    const tokenIxs = tx.instructions.filter(ix => ix.programId.equals(tokenProgram) || ix.programId.toBase58().startsWith("Token"));
    if(tokenIxs.length < 2) throw new Error("Expected at least two token program instructions (merchant + fee)");

    const decodeAmount = (data) => {
      if(!data || data.length < 10) return null;
      try { return Number(data.readBigUInt64LE(1)); } catch { return null; }
    };

    let merchantAmt = null, feeAmt = null;
    for(const ix of tokenIxs){
      if(!ix.keys || ix.keys.length < 3) continue;
      const dest = ix.keys[2].pubkey;
      const amt = decodeAmount(ix.data);
      if(amt === null) continue;
      if(dest.equals(expectedMerchantAta)) merchantAmt = amt;
      else if(dest.equals(expectedFeeAta)) feeAmt = amt;
    }

    if(merchantAmt === null || feeAmt === null){
      throw new Error("Could not identify merchant and fee transfers (amounts missing). Inspect tx.instructions program/keys.");
    }

    const total = merchantAmt + feeAmt;
    const expectedFee = Math.max(1, Math.floor(total / 100));
    if(feeAmt !== expectedFee) throw new Error(`Fee mismatch expected=${expectedFee} found=${feeAmt}`);

    console.log(`Validated amounts: merchant=${merchantAmt} fee=${feeAmt} total=${total}`);

    tx.partialSign(relayerKP);

    // Simulate in-memory transaction so signatures remain intact
    const sim = await conn.simulateTransaction(tx, { sigVerify: false, commitment: "confirmed" });
    if(sim.value.err){
      console.error("Simulation logs:", sim.value.logs);
      throw new Error("Simulation failed: " + JSON.stringify(sim.value.err));
    }
    console.log("Simulation success.");

    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    console.log("submitted tx:", sig);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("Explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");

  } catch (e) {
    console.error("ERROR:", e.message || e);
    if(e.stack) console.error(e.stack);
    process.exit(1);
  }
}

main();
