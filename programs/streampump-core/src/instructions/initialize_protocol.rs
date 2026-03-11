// EN: Initialize global protocol configuration (admin, oracle authority, core mints, and fee/duration params).
// ZH: 初始化协议全局配置（管理员、预言机权限、核心代币 mint、费率与活动时长参数）。
use anchor_lang::prelude::*;

use crate::{errors::StreamPumpError, state::ProtocolConfig};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolArgs {
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub spump_mint: Pubkey,
    pub max_proposal_duration_seconds: i64,
    pub max_exit_tax_bps: u16,
    pub min_exit_tax_bps: u16,
    pub tax_decay_threshold_supply: u64,
    pub s2_min_followers: u64,
    pub s2_min_valid_views: u64,
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        seeds = [b"protocol_config"],
        bump,
        space = 8 + ProtocolConfig::INIT_SPACE
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<InitializeProtocol>,
    args: InitializeProtocolArgs,
) -> Result<()> {
    require!(
        args.max_proposal_duration_seconds > 0,
        StreamPumpError::InvalidDeadline
    );
    require!(
        args.max_exit_tax_bps <= 10_000
            && args.min_exit_tax_bps <= 10_000
            && args.max_exit_tax_bps >= args.min_exit_tax_bps
            && args.tax_decay_threshold_supply > 0,
        StreamPumpError::InvalidTaxConfig
    );

    let config = &mut ctx.accounts.protocol_config;
    config.admin = ctx.accounts.admin.key();
    config.oracle_authority = args.oracle_authority;
    config.usdc_mint = args.usdc_mint;
    config.spump_mint = args.spump_mint;
    config.spump_mint_bump = ctx.bumps.protocol_config;
    config.max_proposal_duration_seconds = args.max_proposal_duration_seconds;
    config.max_exit_tax_bps = args.max_exit_tax_bps;
    config.min_exit_tax_bps = args.min_exit_tax_bps;
    config.tax_decay_threshold_supply = args.tax_decay_threshold_supply;
    config.s2_min_followers = args.s2_min_followers;
    config.s2_min_valid_views = args.s2_min_valid_views;
    config.bump = ctx.bumps.protocol_config;

    Ok(())
}
