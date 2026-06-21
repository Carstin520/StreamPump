// EN: Admin-only S1 emission and guard parameter update.
// ZH: 管理员专用的 S1 发放与风控参数更新。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    events::ProtocolS1EmissionUpdated,
    state::{
        ProtocolConfig, DEFAULT_MAX_S1_DAILY_BUY_SPUMP, DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS,
        DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD, DEFAULT_S1_MIN_USER_XP,
        DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS,
    },
    utils::{validate_residual_destination, validate_reward_model},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateProtocolS1EmissionArgs {
    pub daily_spump_emission_multiplier_bps: u16,
    pub new_user_emission_bps: u16,
    pub new_user_emission_window_seconds: i64,
    pub s1_min_user_xp: u64,
    pub max_s1_daily_buy_spump: u64,
    pub s1_early_cohort_supply_threshold: u64,
    pub s1_early_cohort_buyout_cap_bps: u16,
    pub s1_rage_quit_window_seconds: i64,
    pub s1_buyout_creator_share_bps: u16,
    pub s1_buyout_reward_model: u8,
    pub s1_discovery_reward_cap_usdc: u64,
    pub s1_status_thankyou_usdc: u64,
    pub s1_buyout_residual_to: u8,
    pub s1_discovery_min_hold_seconds: i64,
    pub s1_discovery_claim_window_seconds: i64,
    pub track2_reward_cap_usdc: u64,
    pub track2_residual_to: u8,
}

#[derive(Accounts)]
pub struct UpdateProtocolS1Emission<'info> {
    pub admin: Signer<'info>,

    #[account(mut, seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

pub(crate) fn handler(
    ctx: Context<UpdateProtocolS1Emission>,
    args: UpdateProtocolS1EmissionArgs,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.protocol_config.admin,
        StreamPumpError::Unauthorized
    );
    require!(
        args.daily_spump_emission_multiplier_bps > 0
            && args.new_user_emission_bps > 0
            && args.new_user_emission_bps <= 10_000
            && args.new_user_emission_window_seconds >= 0,
        StreamPumpError::InvalidEmissionConfig
    );
    require!(
        args.s1_min_user_xp >= DEFAULT_S1_MIN_USER_XP
            && args.max_s1_daily_buy_spump >= DEFAULT_MAX_S1_DAILY_BUY_SPUMP
            && args.s1_early_cohort_supply_threshold >= DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD
            && args.s1_early_cohort_buyout_cap_bps > 0
            && args.s1_early_cohort_buyout_cap_bps <= DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS
            && args.s1_rage_quit_window_seconds > 0
            && args.s1_rage_quit_window_seconds <= DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS,
        StreamPumpError::InvalidS1GuardConfig
    );
    validate_reward_model(args.s1_buyout_reward_model)?;
    validate_residual_destination(args.s1_buyout_residual_to)?;
    validate_residual_destination(args.track2_residual_to)?;
    require!(
        args.s1_buyout_creator_share_bps <= 10_000
            && args.s1_discovery_reward_cap_usdc > 0
            && args.track2_reward_cap_usdc > 0
            && args.s1_discovery_min_hold_seconds >= 0
            && args.s1_discovery_claim_window_seconds > 0,
        StreamPumpError::InvalidS1GuardConfig
    );

    let config = &mut ctx.accounts.protocol_config;
    config.daily_spump_emission_multiplier_bps = args.daily_spump_emission_multiplier_bps;
    config.new_user_emission_bps = args.new_user_emission_bps;
    config.new_user_emission_window_seconds = args.new_user_emission_window_seconds;
    config.s1_min_user_xp = args.s1_min_user_xp;
    config.max_s1_daily_buy_spump = args.max_s1_daily_buy_spump;
    config.s1_early_cohort_supply_threshold = args.s1_early_cohort_supply_threshold;
    config.s1_early_cohort_buyout_cap_bps = args.s1_early_cohort_buyout_cap_bps;
    config.s1_rage_quit_window_seconds = args.s1_rage_quit_window_seconds;
    config.s1_buyout_creator_share_bps = args.s1_buyout_creator_share_bps;
    config.s1_buyout_reward_model = args.s1_buyout_reward_model;
    config.s1_discovery_reward_cap_usdc = args.s1_discovery_reward_cap_usdc;
    config.s1_status_thankyou_usdc = args.s1_status_thankyou_usdc;
    config.s1_buyout_residual_to = args.s1_buyout_residual_to;
    config.s1_discovery_min_hold_seconds = args.s1_discovery_min_hold_seconds;
    config.s1_discovery_claim_window_seconds = args.s1_discovery_claim_window_seconds;
    config.track2_reward_cap_usdc = args.track2_reward_cap_usdc;
    config.track2_residual_to = args.track2_residual_to;

    emit!(ProtocolS1EmissionUpdated {
        admin: ctx.accounts.admin.key(),
        daily_spump_emission_multiplier_bps: config.daily_spump_emission_multiplier_bps,
        new_user_emission_bps: config.new_user_emission_bps,
        new_user_emission_window_seconds: config.new_user_emission_window_seconds,
        s1_min_user_xp: config.s1_min_user_xp,
        max_s1_daily_buy_spump: config.max_s1_daily_buy_spump,
        s1_early_cohort_supply_threshold: config.s1_early_cohort_supply_threshold,
        s1_early_cohort_buyout_cap_bps: config.s1_early_cohort_buyout_cap_bps,
        s1_rage_quit_window_seconds: config.s1_rage_quit_window_seconds,
        s1_buyout_creator_share_bps: config.s1_buyout_creator_share_bps,
        s1_buyout_reward_model: config.s1_buyout_reward_model,
        s1_discovery_reward_cap_usdc: config.s1_discovery_reward_cap_usdc,
        s1_status_thankyou_usdc: config.s1_status_thankyou_usdc,
        s1_buyout_residual_to: config.s1_buyout_residual_to,
        s1_discovery_min_hold_seconds: config.s1_discovery_min_hold_seconds,
        s1_discovery_claim_window_seconds: config.s1_discovery_claim_window_seconds,
        track2_reward_cap_usdc: config.track2_reward_cap_usdc,
        track2_residual_to: config.track2_residual_to,
    });

    Ok(())
}
