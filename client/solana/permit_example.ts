import * as fs from 'fs';
import * as path from 'path';
import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

function u64le(n: bigint) { return Buffer.from(new anchor.BN(n.toString()).toArray('le', 8)); }
function i64le(n: number) { return Buffer.from(new anchor.BN(n).toArray('le', 8)); }

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 7) {
    console.log('Usage: ts-node client/solana/permit_example.ts <owner_keypair.json> <programId> <ownerPubkey> <amount> <fee> <deadlineSec> <nonce>');
    process.exit(1);
  }
  const [kpPath, programIdStr, ownerStr, amountStr, feeStr, deadlineStr, nonceStr] = args;
  const secret = JSON.parse(fs.readFileSync(kpPath, 'utf8')) as number[];
  const ownerKey = nacl.sign.keyPair.fromSecretKey(Uint8Array.from(secret));
  const owner = new PublicKey(ownerStr);
  const programId = new PublicKey(programIdStr);
  const amount = BigInt(amountStr);
  const fee = BigInt(feeStr);
  const deadline = parseInt(deadlineStr, 10);
  const nonce = BigInt(nonceStr);

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
  const outPath = path.join(outDir, 'solana_permit.json');
  fs.writeFileSync(outPath, JSON.stringify({
    owner: owner.toBase58(),
    programId: programId.toBase58(),
    amount: amount.toString(),
    fee: fee.toString(),
    deadline,
    nonce: nonce.toString(),
    signature: Buffer.from(signature).toString('hex')
  }, null, 2));
  console.log('Saved', outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });



