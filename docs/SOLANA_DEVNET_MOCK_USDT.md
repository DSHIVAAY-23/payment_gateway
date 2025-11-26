# Solana Devnet Mock USDT Setup & Test

## Overview

Created a legacy SPL (Tokenkeg) mint on Solana devnet, funded user/relayer wallets, minted 1,000 mock USDT tokens to the user, and demonstrated the partial-transfer + relayer-submit flow using the new scripts.

## Key References

- **RPC**: `https://api.devnet.solana.com`
- **Relayer pubkey**: `GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd`
- **User pubkey**: `7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5`
- **Mint (mock USDT)**: `8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr`
- **User ATA**: `7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB`
- **Mint creation signature**: `2iUkmastZkyfFzB3C8gxPCCUnQo5DycTzBawp8Pm3nsRsk8tK7HLYRYXH5b6mrxRYCFbP7eqXRLjRva3JutfJvKL`
- **ATA creation signature**: `5zWvw8iez6k7YXishDPdKNBqkw1ktwn47BSrYELpbNnSVwm6sfa7NvP5K8F7GSKuVMu5VhZKynwaRfSNmp4gzXkY`
- **Mint-to-user signature**: `4AV5EK53BbHDvB4QzLUcZzCQg6oE8rBzJJ5BxpWLy39K93YKi3Cb1RB6mC14pHWmM49e785Mpn9efWrZLq2ua5gP`
- **Relayed transfer signature**: `539oufuSyMd5KBUBuTdKQyABC4zhFp8RNK9ZaY2QSWzCQY7PuC2pVyes6Rj639HNzmo4z6tCBiXmjF2j6Vnc7dvz`

`.env` now contains `MINT_ADDRESS=8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr` (previous value backed up to `.env.bak`).

## Steps Performed

1. **CLI checks**
   ```bash
   command -v solana
   command -v spl-token
   ```
   _Both commands returned exit code 0 (tools already installed)._

2. **Set devnet RPC**
   ```bash
   export SOLANA_URL=https://api.devnet.solana.com
   solana config set --url $SOLANA_URL
   solana config get
   ```
   **Output (abridged)**
   ```text
   Config File: /home/user/.config/solana/cli/config.yml
   RPC URL: https://api.devnet.solana.com
   WebSocket URL: wss://api.devnet.solana.com/ (computed)
   Keypair Path: /home/user/.config/solana/id.json
   Commitment: confirmed
   ```

3. **Keypairs**
   - Relayer: reused `~/.config/solana/id.json`
   - User: generated `./user_dev_keypair.json`
   ```bash
   solana-keygen new --outfile ./user_dev_keypair.json --no-bip39-passphrase
   solana-keygen pubkey ~/.config/solana/id.json
   solana-keygen pubkey ./user_dev_keypair.json
   ```
   **Output (user creation)**
   ```text
   Generating a new keypair
   Wrote new keypair to ./user_dev_keypair.json
   pubkey: 7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5
   ```
   **Pubkeys**
   ```text
   Relayer pubkey: GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd
   User pubkey:    7rKDTsVBJ49Rtj7LvxYzsYn5Fhb6bqtu1WGx5h2nZdQ5
   ```

4. **Airdrops**
   ```bash
   solana balance GsPrDLX... --url $SOLANA_URL
   solana airdrop 1 7rKDTs... --url $SOLANA_URL
   ```
   **Output**
   ```text
   26.041055709 SOL          # relayer balance
   Requesting airdrop of 1 SOL
   Error: airdrop request failed. This can happen when the rate limit is reached.
   ```
   _Relayer already had funds; user faucet call was rate-limited, so relayer paid fees later._

5. **Create SPL mint (6 decimals)**
   ```bash
   spl-token create-token --decimals 6 --url $SOLANA_URL
   ```
   **Output**
   ```text
   Creating token 8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr under program TokenkegQfeZyi...
   Address:  8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr
   Decimals: 6
   Signature: 2iUkmastZkyfFzB3C8gxPCCUnQo5DycTzBawp8Pm3nsRsk8t...
   ```

6. **Create user ATA + mint 1,000 tokens**
   ```bash
   spl-token create-account $MINT --owner $USER_PUBKEY --fee-payer $RELAYER_KEY --url $SOLANA_URL
   spl-token accounts --owner $USER_PUBKEY --url $SOLANA_URL --output json
   spl-token mint $MINT 1000 $USER_ATA --owner $RELAYER_KEY --url $SOLANA_URL
   ```
   **Outputs**
   ```text
   Creating account 7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB
   Signature: 5zWvw8iez6k7YXishDPdKNBqkw1ktwn47BSrYELpbNnSVwm6sfa7NvP5K8F7GSKu...
   ```
   ```json
   {
     "accounts": [
       {
         "address": "7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB",
         "mint": "8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr",
         "tokenAmount": { "amount": "0", "decimals": 6 }
       }
     ]
   }
   ```
   ```text
   Minting 1000 tokens
     Token: 8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr
     Recipient: 7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB
   Signature: 4AV5EK53BbHDvB4QzLUcZzCQg6oE8rBzJJ5BxpWLy39K93YKi3Cb1RB6mC14pHWm...
   ```

7. **Verify balances**
   ```bash
   spl-token accounts --owner $USER_PUBKEY --url $SOLANA_URL
   solana account $USER_ATA --output json --url $SOLANA_URL
   ```
   **Outputs**
   ```text
   Token                                         Balance
   -----------------------------------------------------
   8h5oStyyHZspFCTLoXEqw6JK8Dc9fKcgpjeJQEsDe4qr  1000
   ```
   ```json
   {
     "pubkey": "7bGgUV6NfGnYKtAnyb4CCktQQPSUh7Gh6gwH2uNm26JB",
     "account": {
       "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
       "space": 165
     }
   }
   ```

8. **Update `.env`**
   ```bash
   cp .env .env.bak
   sed -i "s/^MINT_ADDRESS=.*/MINT_ADDRESS=$MINT/" .env
   ```

9. **Partial transfer + relayer submission**
   ```bash
   node scripts/partial.js GsPrDLXoqVbcWwofYpRZFJg4h5dzHEjyNfPyzPrcUKGd
   node scripts/reaysol.js
   ```
   **Partial output**
   ```text
   RPC URL: https://api.devnet.solana.com
   User pubkey: 7rKDTsVB...
   Recipient ATA missing; including createAssociatedTokenAccountInstruction
   Signatures before relayer: [
     { pubkey: 'GsPrDLXoqVbc...', sigPresent: false },
     { pubkey: '7rKDTsVBJ49...', sigPresent: true }
   ]
   Wrote partial_tx.base64
   ```
   **Relayer output**
   ```text
   Submitting transaction...
   submitted tx: 539oufuSyMd5KBUBuTdKQyABC4zhFp8RNK9ZaY2QSWzCQY7PuC2pVyes6Rj639HNzmo4z6tCBiXmjF2j6Vnc7dvz
   confirmation status: { context: { slot: 424157774 }, value: { err: null } }
   Explorer: https://explorer.solana.com/tx/539oufuSyMd5KBUBuTdKQyABC4zhFp8RNK9ZaY2QSWzCQY7PuC2pVyes6Rj639HNzmo4z6tCBiXmjF2j6Vnc7dvz?cluster=devnet
   ```

   _The partial builder created the recipient ATA automatically; the relayer signed and finalized the transaction._

## Next Steps / Usage

- Re-run the test with different recipients or amounts by setting:
  ```bash
  export AMOUNT_HUMAN=5        # defaults to 1
  export USER_KEYPAIR_PATH=./user_dev_keypair.json
  export RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
  ```
- Then:
  ```bash
  node scripts/partial.js <recipient_pubkey>
  node scripts/reaysol.js
  ```
  _Expected output mirrors the logs captured above:_ partial builder prints the user/relayer info, notes whether the recipient ATA is created, and writes `partial_tx.base64`; the relayer script reports the submitted transaction signature and the explorer URL.

- Inspect transactions via the Solana explorer using the provided signatures (ensure `?cluster=devnet`).

This workflow confirms the mock USDT mint and the partial/relayer flow operate correctly on Solana devnet.

