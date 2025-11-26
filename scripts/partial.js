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
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

const RPC_URL = process.env.SOLANA_URL || "https://api.devnet.solana.com";
const conn = new Connection(RPC_URL, "confirmed");

function loadKeypair(keyPath) {
  const expanded = keyPath.replace("~", process.env.HOME || "");
  const raw = fs.readFileSync(expanded, "utf8");
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

function resolveKeypairPath(envName, defaultPath) {
  if (process.env[envName]) {
    return process.env[envName];
  }
  return defaultPath;
}

async function main() {
  const recipientArg = process.argv[2] || process.env.RECIPIENT_PUBKEY;
  if (!recipientArg) {
    console.error("Usage: node scripts/partial.js <RECIPIENT_PUBKEY>");
    process.exit(1);
  }
  const recipient = new PublicKey(recipientArg);

  const userKeyPath = resolveKeypairPath(
    "USER_KEYPAIR_PATH",
    "./user_dev_keypair.json"
  );
  const relayerKeyPath = resolveKeypairPath(
    "RELAYER_KEYPAIR_PATH",
    fs.existsSync(path.join(process.env.HOME || "", ".config/solana/id.json"))
      ? path.join(process.env.HOME || "", ".config/solana/id.json")
      : "./relayer_dev_keypair.json"
  );

  const userKP = loadKeypair(userKeyPath);
  const relayerKP = loadKeypair(relayerKeyPath);

  const mintStr = process.env.MINT_ADDRESS;
  if (!mintStr) {
    console.error("MINT_ADDRESS is not set in .env");
    process.exit(1);
  }
  const mint = new PublicKey(mintStr);

  const tokenProgram = process.env.TOKEN_PROGRAM_ID
    ? new PublicKey(process.env.TOKEN_PROGRAM_ID)
    : TOKEN_PROGRAM_ID;
  const ataProgram = process.env.ASSOCIATED_TOKEN_PROGRAM_ID
    ? new PublicKey(process.env.ASSOCIATED_TOKEN_PROGRAM_ID)
    : ASSOCIATED_TOKEN_PROGRAM_ID;

  console.log("RPC URL:", RPC_URL);
  console.log("User pubkey:", userKP.publicKey.toBase58());
  console.log("Relayer pubkey:", relayerKP.publicKey.toBase58());
  console.log("Recipient pubkey:", recipient.toBase58());
  console.log("Mint:", mint.toBase58());

  const mintAcc = await conn.getParsedAccountInfo(mint);
  if (!mintAcc.value) {
    console.error("Mint not found on chain");
    process.exit(1);
  }
  const decimals =
    mintAcc.value?.data?.parsed?.info?.decimals ??
    mintAcc.value?.data?.parsed?.info?.mintAuthority?.decimals ??
    6;
  console.log("Mint decimals:", decimals);

  const userATA = await getAssociatedTokenAddress(
    mint,
    userKP.publicKey,
    false,
    tokenProgram,
    ataProgram
  );
  const recipientATA = await getAssociatedTokenAddress(
    mint,
    recipient,
    false,
    tokenProgram,
    ataProgram
  );

  console.log("User ATA:", userATA.toBase58());
  console.log("Recipient ATA:", recipientATA.toBase58());

  const instructions = [];
  const recipientInfo = await conn.getAccountInfo(recipientATA);
  if (!recipientInfo) {
    console.log(
      "Recipient ATA missing; including createAssociatedTokenAccountInstruction"
    );
    instructions.push(
      createAssociatedTokenAccountInstruction(
        relayerKP.publicKey,
        recipientATA,
        recipient,
        mint,
        tokenProgram,
        ataProgram
      )
    );
  }

  const amountHuman = parseFloat(process.env.AMOUNT_HUMAN || "1");
  if (Number.isNaN(amountHuman) || amountHuman <= 0) {
    console.error("AMOUNT_HUMAN must be > 0");
    process.exit(1);
  }
  const amountSmall = Math.round(amountHuman * Math.pow(10, decimals));

  instructions.push(
    createTransferCheckedInstruction(
      userATA,
      mint,
      recipientATA,
      userKP.publicKey,
      amountSmall,
      decimals,
      [],
      tokenProgram
    )
  );

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = relayerKP.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  tx.partialSign(userKP);

  const sigStatus = tx.signatures.map((s) => ({
    pubkey: s.publicKey.toBase58(),
    sigPresent: !!s.signature,
  }));
  console.log("Signatures before relayer:", sigStatus);

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const base64 = serialized.toString("base64");
  fs.writeFileSync("partial_tx.base64", base64);
  console.log("Wrote partial_tx.base64");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

