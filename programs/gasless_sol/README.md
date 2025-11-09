# gasless_sol (Anchor program)

This Anchor program demonstrates a "gasless-like" escrow transfer flow on Solana using off-chain Ed25519 signatures and a relayer.

Message format (little-endian serialization):

```
Buffer.concat([
  Buffer.from('GASLESS_PERMIT'),         // 15 bytes
  ownerPubkey.toBuffer(),                // 32 bytes
  programId.toBuffer(),                  // 32 bytes
  u64LE(amount),                         // 8 bytes
  u64LE(fee),                            // 8 bytes
  i64LE(deadline),                       // 8 bytes
  u64LE(nonce)                           // 8 bytes
])
```

- The relayer constructs an ed25519 verification instruction using the user's pubkey and signature over the message.
- The transaction must include two instructions in order: (1) ed25519 verify, (2) program `relayed_transfer`.
- The program loads instruction 0 from `sysvar::instructions`, ensures it's targeting the Ed25519 program, and validates that the message and public key appear within it.

Why escrow?
- Unlike EVM `permit`, Solana SPL Tokens don't generally allow approvals controlled by an off-chain signature in a canonical way. We require a prior deposit into a PDA-owned escrow ATA; once deposited, transfers can be authorized by off-chain signatures verified in the same transaction by the relayer.

Security notes
- Nonce is stored per owner and must increase to prevent replay.
- Deadline is checked against `Clock::get()?.unix_timestamp`.
- Production systems should strictly parse the Ed25519 instruction format and validate offsets, not just presence of slices.



