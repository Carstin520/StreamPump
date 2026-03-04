// EN: Sell internal Season-1 creator tokens for SPUMP with dynamic exit tax.
// ZH: 卖出创作者 Season-1 内部代币换回 SPUMP，并收取动态退出税。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1UserPosition},
    utils::{amount_from_bps, calculate_sell_return, checked_sub},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellS1TokenArgs {
    /// Internal S1 token amount to sell.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct SellS1Token<'info> {
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
    pub user_spump_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"creator_s1_spump_vault", creator_profile.key().as_ref()],
        bump,
        token::mint = spump_mint,
        token::authority = creator_profile
    )]
    pub creator_s1_spump_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = protocol_burn_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub protocol_burn_spump_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_revenue_spump_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_revenue_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_revenue_spump_ata: Account<'info, TokenAccount>,

    #[account(address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

fn calculate_dynamic_tax_bps(
    current_supply: u64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
) -> Result<u16> {
    require!(
        max_exit_tax_bps <= 10_000
            && min_exit_tax_bps <= 10_000
            && max_exit_tax_bps >= min_exit_tax_bps,
        StreamPumpError::InvalidTaxConfig
    );

    if tax_decay_threshold_supply == 0 || current_supply >= tax_decay_threshold_supply {
        return Ok(min_exit_tax_bps);
    }

    let spread = (max_exit_tax_bps - min_exit_tax_bps) as u128;
    let remaining = (tax_decay_threshold_supply - current_supply) as u128;
    let threshold = tax_decay_threshold_supply as u128;

    let variable_component = spread
        .checked_mul(remaining)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(threshold)
        .ok_or(StreamPumpError::MathOverflow)?;

    let tax_bps_u128 = (min_exit_tax_bps as u128)
        .checked_add(variable_component)
        .ok_or(StreamPumpError::MathOverflow)?;

    u16::try_from(tax_bps_u128).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub(crate) fn handler(ctx: Context<SellS1Token>, args: SellS1TokenArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Active,
        StreamPumpError::InvalidCreatorStatus
    );

    let creator_profile = &ctx.accounts.creator_profile;
    let position = &ctx.accounts.s1_user_position;
    require!(
        position.internal_token_balance >= args.amount,
        StreamPumpError::InsufficientInternalTokenBalance
    );

    let gross_return = calculate_sell_return(creator_profile.s1_supply, args.amount)?;
    require!(
        creator_profile.s1_pool_spump >= gross_return,
        StreamPumpError::InsufficientS1PoolLiquidity
    );

    let tax_bps = calculate_dynamic_tax_bps(
        creator_profile.s1_supply,
        ctx.accounts.protocol_config.max_exit_tax_bps,
        ctx.accounts.protocol_config.min_exit_tax_bps,
        ctx.accounts.protocol_config.tax_decay_threshold_supply,
    )?;

    let tax_amount = amount_from_bps(gross_return, tax_bps)?;
    let net_return = checked_sub(gross_return, tax_amount)?;

    let protocol_burn_amount = tax_amount / 2;
    let creator_income_amount = checked_sub(tax_amount, protocol_burn_amount)?;

    let creator_authority = ctx.accounts.creator_profile.authority;
    let creator_bump = ctx.accounts.creator_profile.bump;
    let bump_bytes = [creator_bump];
    let signer_seeds: [&[u8]; 3] = [
        b"creator",
        creator_authority.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    if protocol_burn_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_s1_spump_vault.to_account_info(),
                    to: ctx.accounts.protocol_burn_spump_ata.to_account_info(),
                    authority: ctx.accounts.creator_profile.to_account_info(),
                },
                signer,
            ),
            protocol_burn_amount,
        )?;
    }

    if creator_income_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_s1_spump_vault.to_account_info(),
                    to: ctx.accounts.creator_revenue_spump_ata.to_account_info(),
                    authority: ctx.accounts.creator_profile.to_account_info(),
                },
                signer,
            ),
            creator_income_amount,
        )?;
    }

    if net_return > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_s1_spump_vault.to_account_info(),
                    to: ctx.accounts.user_spump_ata.to_account_info(),
                    authority: ctx.accounts.creator_profile.to_account_info(),
                },
                signer,
            ),
            net_return,
        )?;
    }

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
    creator_profile.s1_pool_spump = checked_sub(creator_profile.s1_pool_spump, gross_return)?;
    creator_profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
