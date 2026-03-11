// EN: Fan exits during execution-pending window with zero exit tax.
// ZH: 粉丝在执行等待窗口内以 0 税率退出。
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutState, S1UserPosition,
    },
    utils::{calculate_sell_return, checked_sub},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RageQuitS1Args {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct RageQuitS1<'info> {
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
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump = s1_buyout_state.bump,
        constraint = s1_buyout_state.creator == creator_profile.key() @ StreamPumpError::BuyoutStateMismatch
    )]
    pub s1_buyout_state: Account<'info, S1BuyoutState>,

    #[account(
        mut,
        seeds = [b"s1_position", user.key().as_ref(), creator_profile.key().as_ref()],
        bump = s1_user_position.bump,
        constraint = s1_user_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = s1_user_position.creator == creator_profile.key() @ StreamPumpError::S1PositionAccountMismatch
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
}

pub(crate) fn handler(ctx: Context<RageQuitS1>, args: RageQuitS1Args) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Execution_Pending,
        StreamPumpError::InvalidCreatorStatus
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now < ctx.accounts.s1_buyout_state.rage_quit_deadline,
        StreamPumpError::RageQuitWindowNotActive
    );

    let creator_profile = &ctx.accounts.creator_profile;
    let position = &ctx.accounts.s1_user_position;
    require!(
        position.internal_token_balance >= args.amount,
        StreamPumpError::InsufficientInternalTokenBalance
    );

    let gross_return = calculate_sell_return(creator_profile.s1_supply, args.amount)?;

    let bump_bytes = [ctx.accounts.protocol_config.bump];
    let signer_seeds: [&[u8]; 2] = [b"protocol_config", bump_bytes.as_ref()];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    token_interface::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.spump_token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.spump_mint.to_account_info(),
                to: ctx.accounts.user_spump_ata.to_account_info(),
                authority: ctx.accounts.protocol_config.to_account_info(),
            },
            signer,
        ),
        gross_return,
    )?;

    let position = &mut ctx.accounts.s1_user_position;
    let creator_profile = &mut ctx.accounts.creator_profile;

    let balance_before = position.internal_token_balance;
    let cost_basis_before = position.spump_cost_basis;
    let released_cost_basis = if args.amount == balance_before {
        cost_basis_before
    } else {
        let numerator = (cost_basis_before as u128)
            .checked_mul(args.amount as u128)
            .ok_or(StreamPumpError::MathOverflow)?;
        let quotient = numerator
            .checked_div(balance_before as u128)
            .ok_or(StreamPumpError::MathOverflow)?;
        u64::try_from(quotient).map_err(|_| error!(StreamPumpError::MathOverflow))?
    };

    position.internal_token_balance = checked_sub(position.internal_token_balance, args.amount)?;
    position.spump_cost_basis = checked_sub(position.spump_cost_basis, released_cost_basis)?;

    creator_profile.s1_supply = checked_sub(creator_profile.s1_supply, args.amount)?;
    creator_profile.updated_at = now;

    Ok(())
}
