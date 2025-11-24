// scripts/solana_permit_pyusd.ts
// Create permit signature for PYUSD transfer
import * as fs from 'fs';
import * as path from 'path';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import * as anchor from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey('9wnLiHURHXvYF6AuggZBX4FXPUkwjWMtCWFzosDB3ugh');

function u64le(n: bigint) {
  return Buffer.from(new anchor.BN(n.toString()).toArray('le', 8));
}

function i64le(n: number) {
  return Buffer.from(new anchor.BN(n).toArray('le', 8));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 6) {
    console.log('Usage: ts-node scripts/solana_permit_pyusd.ts <owner_keypair.json> <ownerPubkey> <amount> <fee> <deadlineSec> <nonce>');
    console.log('Example: ts-node scripts/solana_permit_pyusd.ts ~/.config/solana/id.json 9mEQMLLKBnAXnDuWijXWUwAmPP8EHC3h7BBofDvXXpL2 1000000 10000 1735689600 1');
    console.log('Note: PYUSD has 6 decimals, so 1000000 = 1 PYUSD');
    process.exit(1);
  }

  const [kpPath, ownerStr, amountStr, feeStr, deadlineStr, nonceStr] = args;
  const secret = JSON.parse(fs.readFileSync(kpPath.replace('~', process.env.HOME || ''), 'utf8')) as number[];
  const ownerKey = nacl.sign.keyPair.fromSecretKey(Uint8Array.from(secret));
  const owner = new PublicKey(ownerStr);
  const programId = PROGRAM_ID;
  const amount = BigInt(amountStr);
  const fee = BigInt(feeStr);
  const deadline = parseInt(deadlineStr, 10);
  const nonce = BigInt(nonceStr);

  // Verify owner matches keypair
  if (!owner.equals(new PublicKey(ownerKey.publicKey))) {
    console.error('Owner pubkey does not match keypair!');
    process.exit(1);
  }

  const message = Buffer.concat([
    Buffer.from('GASLESS_PERMIT'),
    owner.toBuffer(),
    programId.toBuffer(),
    u64le(amount),
    u64le(fee),
    i64le(deadline),
    u64le(nonce)
  ]);

  const signature = nacl.sign.detached(new Uint8Array(message), ownerKey.secretKey);

  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'solana_pyusd_permit.json');
  fs.writeFileSync(outPath, JSON.stringify({
    owner: owner.toBase58(),
    programId: programId.toBase58(),
    amount: amount.toString(),
    fee: fee.toString(),
    deadline,
    nonce: nonce.toString(),
    signature: Buffer.from(signature).toString('hex')
  }, null, 2));
  
  console.log('✓ Permit saved to:', outPath);
  console.log('Owner:', owner.toBase58());
  console.log('Amount:', amount.toString());
  console.log('Fee:', fee.toString());
  console.log('Deadline:', new Date(deadline * 1000).toISOString());
  console.log('Nonce:', nonce.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

