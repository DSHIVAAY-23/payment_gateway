// scripts/verify_permit_signature.js
// Usage: node scripts/verify_permit_signature.js out/solana_pyusd_permit.json

const fs = require('fs');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { PublicKey } = require('@solana/web3.js');

function u64LE(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

function i64LE(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(n));
  return buf;
}

const path = process.argv[2] || 'out/solana_pyusd_permit.json';
const p = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log('Permit loaded from', path);
console.log('owner:', p.owner);
console.log('programId:', p.programId);
console.log('amount:', p.amount);
console.log('fee:', p.fee);
console.log('deadline:', p.deadline);
console.log('nonce:', p.nonce);
console.log('signature length (chars):', p.signature.length);

// Public keys from base58 strings
const ownerPk = Buffer.from(new PublicKey(p.owner).toBytes());
const programPk = Buffer.from(new PublicKey(p.programId).toBytes());

// Build message exactly like relay script does:
// "GASLESS_PERMIT" + owner(32) + programId(32) + amount(8 LE) + fee(8 LE) + deadline(8 LE) + nonce(8 LE)
const prefix = Buffer.from('GASLESS_PERMIT', 'utf8');
const amountBuf = u64LE(p.amount);
const feeBuf = u64LE(p.fee);
const deadlineBuf = u64LE(p.deadline);
const nonceBuf = u64LE(p.nonce);

const message = Buffer.concat([
  prefix,
  ownerPk,
  programPk,
  amountBuf,
  feeBuf,
  deadlineBuf,
  nonceBuf,
]);
console.log('message length:', message.length);

// Decode signature: try hex, then base58 if hex fails or wrong length
let sigBuf;

try {
  sigBuf = Buffer.from(p.signature, 'hex');
  console.log('decoded signature as hex, bytes:', sigBuf.length);
} catch (e) {
  console.log('signature is not valid hex, trying base58...');
}

if (!sigBuf || sigBuf.length !== 64) {
  try {
    sigBuf = bs58.decode(p.signature);
    console.log('decoded signature as base58, bytes:', sigBuf.length);
  } catch (e) {
    console.log('signature is not valid base58 either');
  }
}

if (!sigBuf) {
  console.error('Could not decode signature to bytes (not hex or base58).');
  process.exit(2);
}

if (sigBuf.length !== 64) {
  console.error('Signature is not 64 bytes after decoding. length =', sigBuf.length);
  process.exit(3);
}

// Verify using tweetnacl against owner pubkey
const verified = nacl.sign.detached.verify(
  new Uint8Array(message),
  new Uint8Array(sigBuf),
  new Uint8Array(ownerPk),
);

console.log('signature verification result (with owner pk, LE integers):', verified);

// For extra debug, also test with BE encoding
function u64BE(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(n));
  return b;
}
const messageBE = Buffer.concat([
  prefix,
  ownerPk,
  programPk,
  u64BE(p.amount),
  u64BE(p.fee),
  u64BE(p.deadline),
  u64BE(p.nonce),
]);
const verifiedBE = nacl.sign.detached.verify(
  new Uint8Array(messageBE),
  new Uint8Array(sigBuf),
  new Uint8Array(ownerPk),
);
console.log('signature verify with BE integers:', verifiedBE);

console.log('sig first 8 bytes (hex):', sigBuf.slice(0, 8).toString('hex'));
console.log('sig last 8 bytes (hex):', sigBuf.slice(-8).toString('hex'));
