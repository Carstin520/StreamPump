// EN: Create a sponsor-funded campaign escrow and its paired traffic market/vaults.
// ZH: 创建由赞助商出资的活动托管账户以及对应的流量预测市场和资金金库。
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    errors::StreamPumpError,
    state::{CampaignEscrow, CampaignStatus, CreatorProfile, ProtocolConfig, TrafficMarket},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateCampaignArgs {
    pub campaign_id: u64,
    pub target_view_count: u64,
    pub deadline_ts: i64,
    pub market_close_ts: i64,
    pub predictor_pool_bps: u16,
    pub creator_success_payout_bps: u16,
}

#[derive(Accounts)]
#[instruction(args: CreateCampaignArgs)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        constraint = creator_profile.authority != Pubkey::default() @ StreamPumpError::CreatorNotRegistered
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(
        init,
        payer = sponsor,
        seeds = [b"campaign", sponsor.key().as_ref(), &args.campaign_id.to_le_bytes()],
        bump,
        space = 8 + CampaignEscrow::INIT_SPACE
    )]
    pub campaign: Account<'info, CampaignEscrow>,
    /// CHECK: PDA signer for the campaign USDC vault.
    #[account(
        seeds = [b"campaign_vault_authority", campaign.key().as_ref()],
        bump
    )]
    pub campaign_vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = sponsor,
        seeds = [b"campaign_vault", campaign.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = campaign_vault_authority
    )]
    pub campaign_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = sponsor,
        seeds = [b"market", campaign.key().as_ref()],
        bump,
        space = 8 + TrafficMarket::INIT_SPACE
    )]
    pub market: Account<'info, TrafficMarket>,
    /// CHECK: PDA signer for market vault token accounts.
    #[account(
        seeds = [b"market_vault_authority", market.key().as_ref()],
        bump
    )]
    pub market_vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = sponsor,
        seeds = [b"market_spump_vault", market.key().as_ref()],
        bump,
        token::mint = spump_mint,
        token::authority = market_vault_authority
    )]
    pub market_spump_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = sponsor,
        seeds = [b"market_usdc_rewards_vault", market.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = market_vault_authority
    )]
    pub market_usdc_rewards_vault: Account<'info, TokenAccount>,
    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<CreateCampaign>, args: CreateCampaignArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        args.predictor_pool_bps <= 10_000 && args.creator_success_payout_bps <= 10_000,
        StreamPumpError::InvalidBasisPoints
    );
    require!(
        (args.predictor_pool_bps as u32 + args.creator_success_payout_bps as u32) <= 10_000,
        StreamPumpError::InvalidBasisPoints
    );
    require!(args.deadline_ts > now, StreamPumpError::InvalidDeadline);
    require!(
        args.deadline_ts
            .checked_sub(now)
            .ok_or(StreamPumpError::MathOverflow)?
            <= ctx.accounts.protocol_config.max_campaign_duration_seconds,
        StreamPumpError::InvalidDeadline
    );
    require!(
        args.market_close_ts > now && args.market_close_ts <= args.deadline_ts,
        StreamPumpError::InvalidMarketClose
    );

    let campaign = &mut ctx.accounts.campaign;
    campaign.sponsor = ctx.accounts.sponsor.key();
    campaign.creator_profile = ctx.accounts.creator_profile.key();
    campaign.usdc_mint = ctx.accounts.usdc_mint.key();
    campaign.usdc_vault = ctx.accounts.campaign_vault.key();
    campaign.campaign_id = args.campaign_id;
    campaign.target_view_count = args.target_view_count;
    campaign.deadline_ts = args.deadline_ts;
    campaign.total_deposited = 0;
    campaign.predictor_pool_bps = args.predictor_pool_bps;
    campaign.creator_success_payout_bps = args.creator_success_payout_bps;
    campaign.spump_burned_for_inventory = 0;
    campaign.oracle_reported = false;
    campaign.oracle_final_views = 0;
    campaign.oracle_outcome_yes = false;
    campaign.oracle_request_id = [0; 32];
    campaign.oracle_report_digest = [0; 32];
    campaign.oracle_reported_at = 0;
    campaign.settled_at = 0;
    campaign.market = ctx.accounts.market.key();
    campaign.status = CampaignStatus::Open;
    campaign.vault_authority_bump = ctx.bumps.campaign_vault_authority;
    campaign.bump = ctx.bumps.campaign;

    let market = &mut ctx.accounts.market;
    market.campaign = campaign.key();
    market.spump_mint = ctx.accounts.spump_mint.key();
    market.usdc_mint = ctx.accounts.usdc_mint.key();
    market.spump_stake_vault = ctx.accounts.market_spump_vault.key();
    market.usdc_rewards_vault = ctx.accounts.market_usdc_rewards_vault.key();
    market.close_ts = args.market_close_ts;
    market.yes_total_stake = 0;
    market.no_total_stake = 0;
    market.rewards_usdc_total = 0;
    market.rewards_usdc_distributed = 0;
    market.stakes_redeemed_total = 0;
    market.resolved = false;
    market.outcome_yes = false;
    market.voided = false;
    market.loser_burned = false;
    market.vault_authority_bump = ctx.bumps.market_vault_authority;
    market.bump = ctx.bumps.market;

    Ok(())
}
