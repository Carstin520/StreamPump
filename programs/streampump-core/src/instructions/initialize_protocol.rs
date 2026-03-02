// EN: Initialize global protocol configuration (admin, oracle authority, core mints, and fee/duration params).
// ZH: 初始化协议全局配置（管理员、预言机权限、核心代币 mint、费率与活动时长参数）。
use anchor_lang::prelude::*;

use crate::{errors::StreamPumpError, state::ProtocolConfig};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolArgs {
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub spump_mint: Pubkey,
    pub min_sponsor_burn_bps: u16,
    pub default_predictor_pool_bps: u16,
    pub max_campaign_duration_seconds: i64,
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
        args.min_sponsor_burn_bps <= 10_000 && args.default_predictor_pool_bps <= 10_000,
        StreamPumpError::InvalidBasisPoints
    );
    require!(
        args.max_campaign_duration_seconds > 0,
        StreamPumpError::InvalidDeadline
    );

    let config = &mut ctx.accounts.protocol_config;
    config.admin = ctx.accounts.admin.key();
    config.oracle_authority = args.oracle_authority;
    config.usdc_mint = args.usdc_mint;
    config.spump_mint = args.spump_mint;
    config.min_sponsor_burn_bps = args.min_sponsor_burn_bps;
    config.default_predictor_pool_bps = args.default_predictor_pool_bps;
    config.max_campaign_duration_seconds = args.max_campaign_duration_seconds;
    config.bump = ctx.bumps.protocol_config;

    Ok(())
}
