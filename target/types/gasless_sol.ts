/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gasless_sol.json`.
 */
export type GaslessSol = {
  "address": "EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e",
  "metadata": {
    "name": "gaslessSol",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Anchor program for gasless-like escrow transfers"
  },
  "instructions": [
    {
      "name": "initializeEscrow",
      "discriminator": [
        243,
        160,
        77,
        153,
        11,
        92,
        48,
        209
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "pda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "escrowAta"
        },
        {
          "name": "state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "relayedTransfer",
      "discriminator": [
        226,
        64,
        225,
        4,
        82,
        52,
        14,
        190
      ],
      "accounts": [
        {
          "name": "relayer"
        },
        {
          "name": "mint"
        },
        {
          "name": "pda"
        },
        {
          "name": "escrowAta",
          "writable": true
        },
        {
          "name": "receiverAta",
          "writable": true
        },
        {
          "name": "relayerAta",
          "writable": true
        },
        {
          "name": "state",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "sysvarInstructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "fee",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "sigPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "sig",
          "type": "bytes"
        },
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrowState",
      "discriminator": [
        19,
        90,
        148,
        111,
        55,
        130,
        229,
        108
      ]
    }
  ],
  "events": [
    {
      "name": "gaslessPayment",
      "discriminator": [
        183,
        210,
        71,
        217,
        165,
        149,
        130,
        217
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "deadlineExpired",
      "msg": "Deadline expired"
    },
    {
      "code": 6001,
      "name": "invalidNonce",
      "msg": "Invalid or replayed nonce"
    },
    {
      "code": 6002,
      "name": "signatureMessageMismatch",
      "msg": "Signature message does not match expected"
    },
    {
      "code": 6003,
      "name": "signaturePubkeyMismatch",
      "msg": "Signature pubkey does not match expected"
    },
    {
      "code": 6004,
      "name": "ownerPubkeyMismatch",
      "msg": "Owner pubkey mismatch"
    }
  ],
  "types": [
    {
      "name": "escrowState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "lastNonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gaslessPayment",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "receiver",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "relayer",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
