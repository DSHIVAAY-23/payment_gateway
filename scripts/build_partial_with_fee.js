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

function loadKeypair(keyPath, label) {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`${label} keypair not found at ${keyPath}`);
  }
  const raw = fs.readFileSync(keyPath, "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function ensureAta(mint, owner, payerKP, tokenProgram, ataProgram) {
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    tokenProgram,
    ataProgram
  );
  const info = await conn.getAccountInfo(ata);
  if (!info) {
    console.log(`ATA for ${owner.toBase58()} missing; adding create instruction`);
    return {
      ata,
      ix: createAssociatedTokenAccountInstruction(
        payerKP.publicKey,
        ata,
        owner,
        mint,
        tokenProgram,
        ataProgram
      ),
    };
  }
  return { ata };
}

async function main() {
  const merchantArg = process.argv[2];
  const amountHuman = parseFloat(process.argv[3] || "0");
  const reference = process.argv[4] || "";

  if (!merchantArg) {
    console.error("Usage: node scripts/build_partial_with_fee.js <merchant_pubkey> <amount> [reference]");
    process.exit(1);
  }
  if (!Number.isFinite(amountHuman) || amountHuman <= 0) {
    console.error("Amount must be > 0");
    process.exit(1);
  }

  const merchantPub = new PublicKey(merchantArg);
  const userKeyPath =
    process.env.USER_KEYPATH || path.join(process.cwd(), "user_dev_keypair.json");
  const relayerKeyPath =
    process.env.RELAYER_KEYPATH ||
    path.join(process.env.HOME || "", ".config/solana/id.json");
  const feeKeyPath =
    process.env.FEE_KEYPATH ||
    path.join(process.cwd(), "fee_collector_keypair.json");

  const userKP = loadKeypair(userKeyPath, "User");
  const relayerKP = loadKeypair(relayerKeyPath, "Relayer");
  const feePub =
    process.env.FEE_COLLECTOR_PUBKEY ||
    (() => {
      const kp = loadKeypair(feeKeyPath, "Fee collector");
      return kp.publicKey.toBase58();
    })();
  const feeCollector = new PublicKey(feePub);

  const mintStr = process.env.MINT_ADDRESS;
  if (!mintStr) {
    throw new Error("MINT_ADDRESS missing in env");
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
  console.log("Merchant pubkey:", merchantPub.toBase58());
  console.log("Fee collector pubkey:", feeCollector.toBase58());
  console.log("Mint:", mint.toBase58());
  console.log("Reference:", reference);

  const mintAcc = await conn.getParsedAccountInfo(mint);
  if (!mintAcc.value) throw new Error("Mint account not found");
  const decimals =
    mintAcc.value?.data?.parsed?.info?.decimals ??
    mintAcc.value?.data?.parsed?.info?.mintAuthority?.decimals ??
    6;

  const userAta = await getAssociatedTokenAddress(
    mint,
    userKP.publicKey,
    false,
    tokenProgram,
    ataProgram
  );
  console.log("User ATA:", userAta.toBase58());

  const userAtaInfo = await conn.getAccountInfo(userAta);
  if (!userAtaInfo) {
    throw new Error("User ATA missing; mint tokens or create ATA first");
  }

  const { ata: merchantAta, ix: createMerchantIx } = await ensureAta(
    mint,
    merchantPub,
    relayerKP,
    tokenProgram,
    ataProgram
  );
  const { ata: feeAta, ix: createFeeIx } = await ensureAta(
    mint,
    feeCollector,
    relayerKP,
    tokenProgram,
    ataProgram
  );

  console.log("Merchant ATA:", merchantAta.toBase58());
  console.log("Fee ATA:", feeAta.toBase58());

  const amountSmall = Math.round(amountHuman * Math.pow(10, decimals));
  const feeAmount = Math.max(1, Math.floor(amountSmall / 100)); // 1% fee (floor, ensure >=1)
  const merchantAmount = amountSmall - feeAmount;
  if (merchantAmount <= 0) {
    throw new Error("Amount too small after fee calculation");
  }

  console.log(
    `Splitting amount=${amountSmall} (smallest units) -> merchant=${merchantAmount}, fee=${feeAmount}`
  );

  const tx = new Transaction();
  if (createMerchantIx) tx.add(createMerchantIx);
  if (createFeeIx) tx.add(createFeeIx);
  tx.add(
    createTransferCheckedInstruction(
      userAta,
      mint,
      merchantAta,
      userKP.publicKey,
      merchantAmount,
      decimals,
      [],
      tokenProgram
    )
  );
  tx.add(
    createTransferCheckedInstruction(
      userAta,
      mint,
      feeAta,
      userKP.publicKey,
      feeAmount,
      decimals,
      [],
      tokenProgram
    )
  );

  tx.feePayer = relayerKP.publicKey;
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  tx.partialSign(userKP);

  const signatures = tx.signatures.map((s) => ({
    pubkey: s.publicKey.toBase58(),
    sigPresent: !!s.signature,
  }));
  console.log("Signatures before relayer:", signatures);

  const serialized = tx.serialize({
    requireAllSignatures: false,
  });
  fs.writeFileSync("partial_tx.base64", serialized.toString("base64"));
  console.log("partial_tx.base64 written (includes merchant+fee transfers with 1% fee)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


