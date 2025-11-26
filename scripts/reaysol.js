#!/usr/bin/env node
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { Connection, Keypair, Transaction } from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_URL || "https://api.devnet.solana.com";
const conn = new Connection(RPC_URL, "confirmed");

function loadKeypair(keyPath) {
  const expanded = keyPath.replace("~", process.env.HOME || "");
  const raw = fs.readFileSync(expanded, "utf8");
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

function resolveRelayerKey() {
  if (process.env.RELAYER_KEYPAIR_PATH) {
    return process.env.RELAYER_KEYPAIR_PATH;
  }
  const defaultPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  return "./relayer_dev_keypair.json";
}

async function main() {
  const relayerKeyPath = resolveRelayerKey();
  const relayerKP = loadKeypair(relayerKeyPath);

  if (!fs.existsSync("partial_tx.base64")) {
    console.error("partial_tx.base64 not found. Run partial.js first.");
    process.exit(1);
  }

  const base64 = fs.readFileSync("partial_tx.base64", "utf8").trim();
  if (!base64) {
    console.error("partial_tx.base64 is empty");
    process.exit(1);
  }

  const raw = Buffer.from(base64, "base64");
  const tx = Transaction.from(raw);

  if (!tx.feePayer) {
    console.error("Transaction missing feePayer");
    process.exit(1);
  }

  if (!tx.feePayer.equals(relayerKP.publicKey)) {
    console.error(
      `feePayer mismatch. tx feePayer=${tx.feePayer.toBase58()} relayer=${relayerKP.publicKey.toBase58()}`
    );
    process.exit(1);
  }

  tx.partialSign(relayerKP);

  const serialized = tx.serialize();
  console.log("Submitting transaction...");
  const sig = await conn.sendRawTransaction(serialized, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  console.log("submitted tx:", sig);
  const confirmation = await conn.confirmTransaction(sig, "confirmed");
  console.log("confirmation status:", confirmation);
  console.log(
    `Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

