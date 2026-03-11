// EN: Buy internal Season-1 creator tokens by burning non-transferable SPUMP.
// ZH: 通过销毁不可转账 SPUMP，购买创作者 Season-1 内部代币。
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Burn, Mint, TokenAccount, TokenInterface},
};

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
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

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

    token_interface::burn(
        CpiContext::new(
            ctx.accounts.spump_token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.spump_mint.to_account_info(),
                from: ctx.accounts.user_spump_ata.to_account_info(),
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
    creator_profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
