use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program_pack::Pack,
    sysvar::instructions::load_instruction_at_checked,
};
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("EkoeaRAyhZ4KwQG1SLPVBPxTS796d1bk3Z4TMaiEur8e");

#[program]
pub mod gasless_sol {
    use super::*;

    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, bump: u8) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.owner = ctx.accounts.owner.key();
        state.mint = ctx.accounts.mint.key();
        state.escrow = ctx.accounts.escrow_ata.key();
        state.bump = bump;
        state.last_nonce = 0;

        // Basic checks: ensure the escrow ATA is owned by the PDA and matches mint
        require_keys_eq!(ctx.accounts.escrow_ata.owner, ctx.accounts.pda.key());
        require_keys_eq!(ctx.accounts.escrow_ata.mint, ctx.accounts.mint.key());
        Ok(())
    }

    pub fn relayed_transfer(
        ctx: Context<RelayedTransfer>,
        amount: u64,
        fee: u64,
        deadline: i64,
        sig_pubkey: [u8; 32],
        _sig: Vec<u8>,
        nonce: u64,
    ) -> Result<()> {
        // Manual account validations to reduce stack usage
        let mint = anchor_spl::token::spl_token::state::Mint::unpack(&ctx.accounts.mint.try_borrow_data()?)?;
        let escrow_ata = anchor_spl::token::spl_token::state::Account::unpack(&ctx.accounts.escrow_ata.try_borrow_data()?)?;
        
        // Deserialize state manually (skip 8-byte discriminator)
        let state_data = EscrowState::try_deserialize(&mut &ctx.accounts.state.try_borrow_data()?[8..])?;
        
        // Validate PDA
        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[b"escrow", state_data.owner.as_ref(), ctx.accounts.mint.key().as_ref()],
            ctx.program_id,
        );
        require_keys_eq!(ctx.accounts.pda.key(), expected_pda);
        
        // Validate state PDA
        let (expected_state, _bump) = Pubkey::find_program_address(
            &[b"state", state_data.owner.as_ref(), ctx.accounts.mint.key().as_ref()],
            ctx.program_id,
        );
        require_keys_eq!(ctx.accounts.state.key(), expected_state);
        
        // Validate escrow ATA
        let mint_pubkey = ctx.accounts.mint.key();
        require_keys_eq!(escrow_ata.mint, mint_pubkey);
        require_keys_eq!(escrow_ata.owner, ctx.accounts.pda.key());
        require_keys_eq!(mint_pubkey, state_data.mint);
        
        let clock = Clock::get()?;
        require!(deadline >= clock.unix_timestamp, GaslessError::DeadlineExpired);

        // Nonce must be increasing
        require!(nonce > state_data.last_nonce, GaslessError::InvalidNonce);

        // Instruction 0 must be ed25519 verification
        let ed_ix = load_instruction_at_checked(0, &ctx.accounts.sysvar_instructions.to_account_info()).map_err(|_| GaslessError::SignatureMessageMismatch)?;
        require_keys_eq!(ed_ix.program_id, anchor_lang::solana_program::ed25519_program::id());

        // Build expected message
        let mut msg: Vec<u8> = Vec::new();
        msg.extend_from_slice(b"GASLESS_PERMIT");
        msg.extend_from_slice(&state_data.owner.to_bytes());
        msg.extend_from_slice(&crate::id().to_bytes());
        msg.extend_from_slice(&amount.to_le_bytes());
        msg.extend_from_slice(&fee.to_le_bytes());
        msg.extend_from_slice(&deadline.to_le_bytes());
        msg.extend_from_slice(&nonce.to_le_bytes());

        // Ed25519 instruction format: [signature(64 bytes)][public_key(32 bytes)][message(variable)]
        require!(ed_ix.data.len() >= 96, GaslessError::SignatureMessageMismatch);
        
        // Extract public key from instruction (bytes 64-96)
        let ix_pubkey = &ed_ix.data[64..96];
        require!(ix_pubkey == sig_pubkey, GaslessError::SignaturePubkeyMismatch);
        
        // Confirm the signer pubkey matches the state owner
        require!(sig_pubkey == state_data.owner.to_bytes(), GaslessError::OwnerPubkeyMismatch);
        
        // Extract message from instruction (bytes 96+)
        let ix_msg = &ed_ix.data[96..];
        require!(ix_msg == msg.as_slice(), GaslessError::SignatureMessageMismatch);

        // Perform token transfers via CPI: amount to receiver, fee to relayer
        let mint_key = mint_pubkey;
        let (_, pda_bump) = Pubkey::find_program_address(
            &[b"escrow", state_data.owner.as_ref(), mint_key.as_ref()],
            ctx.program_id,
        );
        let seeds: &[&[u8]] = &[b"escrow", state_data.owner.as_ref(), mint_key.as_ref(), &[pda_bump]];
        let signer: &[&[&[u8]]] = &[seeds];

        // Transfer amount to receiver
        let cpi_accounts_amount = Transfer {
            from: ctx.accounts.escrow_ata.to_account_info(),
            to: ctx.accounts.receiver_ata.to_account_info(),
            authority: ctx.accounts.pda.to_account_info(),
        };
        let cpi_ctx_amount = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts_amount, signer);
        token::transfer(cpi_ctx_amount, amount)?;

        // Transfer fee to relayer
        if fee > 0 {
            let cpi_accounts_fee = Transfer {
                from: ctx.accounts.escrow_ata.to_account_info(),
                to: ctx.accounts.relayer_ata.to_account_info(),
                authority: ctx.accounts.pda.to_account_info(),
            };
            let token_program = anchor_spl::token::Token::id();
            require_keys_eq!(ctx.accounts.token_program.key(), token_program);
            let cpi_ctx_fee = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_fee,
                signer,
            );
            token::transfer(cpi_ctx_fee, fee)?;
        }

        // Update nonce - write back to state
        let mut state_data_mut = state_data;
        state_data_mut.last_nonce = nonce;
        state_data_mut.serialize(&mut &mut ctx.accounts.state.try_borrow_mut_data()?[8..])?;

        // Emit event
        let receiver_ata_data = anchor_spl::token::spl_token::state::Account::unpack(&ctx.accounts.receiver_ata.try_borrow_data()?)?;
        emit!(GaslessPayment {
            owner: state_data_mut.owner,
            receiver: receiver_ata_data.owner,
            token_mint: mint_pubkey,
            amount,
            fee,
            relayer: ctx.accounts.relayer.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA derived inside program, used as token account authority
    #[account(seeds = [b"escrow", owner.key().as_ref(), mint.key().as_ref()], bump = bump)]
    pub pda: UncheckedAccount<'info>,
    #[account(
        constraint = escrow_ata.owner == pda.key(),
        constraint = escrow_ata.mint == mint.key()
    )]
    pub escrow_ata: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = owner,
        space = 8 + EscrowState::SIZE,
        seeds = [b"state", owner.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub state: Account<'info, EscrowState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RelayedTransfer<'info> {
    /// CHECK: Relayer pays fees, signs transaction
    pub relayer: UncheckedAccount<'info>,
    /// CHECK: Mint validated manually
    pub mint: UncheckedAccount<'info>,
    /// CHECK: PDA derived and validated manually
    pub pda: UncheckedAccount<'info>,
    /// CHECK: Escrow ATA validated manually
    #[account(mut)]
    pub escrow_ata: UncheckedAccount<'info>,
    /// CHECK: Receiver ATA validated manually
    #[account(mut)]
    pub receiver_ata: UncheckedAccount<'info>,
    /// CHECK: Relayer ATA validated manually
    #[account(mut)]
    pub relayer_ata: UncheckedAccount<'info>,
    /// CHECK: State validated manually
    #[account(mut)]
    pub state: UncheckedAccount<'info>,
    /// CHECK: Token program
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: Sysvar for reading instructions
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

#[account]
pub struct EscrowState {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub escrow: Pubkey,
    pub last_nonce: u64,
    pub bump: u8,
}

impl EscrowState {
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 1;
}

#[event]
pub struct GaslessPayment {
    pub owner: Pubkey,
    pub receiver: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub relayer: Pubkey,
    pub timestamp: i64,
}

#[error_code]
pub enum GaslessError {
    #[msg("Deadline expired")] DeadlineExpired,
    #[msg("Invalid or replayed nonce")] InvalidNonce,
    #[msg("Signature message does not match expected")] SignatureMessageMismatch,
    #[msg("Signature pubkey does not match expected")] SignaturePubkeyMismatch,
    #[msg("Owner pubkey mismatch")] OwnerPubkeyMismatch,
}


