// EN: Buy internal Season-1 creator tokens using SPUMP locked in creator S1 vault.
// ZH: 使用 SPUMP 购买创作者 Season-1 内部代币，并锁定到创作者 S1 金库。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1UserPosition},
    utils::{calculate_buy_cost, checked_add},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BuyS1TokenArgs {
    /// Internal S1 token amount to buy.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct BuyS1Token<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"s1_position", user.key().as_ref(), creator_profile.key().as_ref()],
        bump,
        space = 8 + S1UserPosition::INIT_SPACE
    )]
    pub s1_user_position: Account<'info, S1UserPosition>,

    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"creator_s1_spump_vault", creator_profile.key().as_ref()],
        bump,
        token::mint = spump_mint,
        token::authority = creator_profile
    )]
    pub creator_s1_spump_vault: Account<'info, TokenAccount>,

    #[account(address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub(crate) fn handler(ctx: Context<BuyS1Token>, args: BuyS1TokenArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Active,
        StreamPumpError::InvalidCreatorStatus
    );

    let current_supply = ctx.accounts.creator_profile.s1_supply;
    let spump_cost = calculate_buy_cost(current_supply, args.amount)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_spump_ata.to_account_info(),
                to: ctx.accounts.creator_s1_spump_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        spump_cost,
    )?;

    let creator_key = ctx.accounts.creator_profile.key();

    let position = &mut ctx.accounts.s1_user_position;
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.creator = creator_key;
        position.internal_token_balance = 0;
        position.spump_cost_basis = 0;
        position.bump = ctx.bumps.s1_user_position;
    }

    require_keys_eq!(
        position.user,
        ctx.accounts.user.key(),
        StreamPumpError::Unauthorized
    );
    require_keys_eq!(
        position.creator,
        creator_key,
        StreamPumpError::S1PositionAccountMismatch
    );

    position.internal_token_balance = checked_add(position.internal_token_balance, args.amount)?;
    position.spump_cost_basis = checked_add(position.spump_cost_basis, spump_cost)?;

    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.s1_supply = checked_add(creator_profile.s1_supply, args.amount)?;
    creator_profile.s1_pool_spump = checked_add(creator_profile.s1_pool_spump, spump_cost)?;
    creator_profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
