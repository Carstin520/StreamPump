// EN: Initialize global protocol configuration (admin, oracle authority, core mints, and fee/duration params).
// ZH: 初始化协议全局配置（管理员、预言机权限、核心代币 mint、费率与活动时长参数）。
use anchor_lang::{prelude::*, solana_program::program_option::COption};
use anchor_spl::token_2022::{
    spl_token_2022::{
        extension::{
            non_transferable::NonTransferable, BaseStateWithExtensions, StateWithExtensions,
        },
        state::Mint as SplToken2022Mint,
    },
    ID as TOKEN_2022_PROGRAM_ID,
};

use crate::{
    errors::StreamPumpError,
    state::{
        ProtocolConfig, DEFAULT_MAX_S1_DAILY_BUY_AMOUNT, DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS,
        DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD, DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
        DEFAULT_S1_MIN_USER_XP, DEFAULT_S1_RATING_BPS, DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS,
        MAX_S1_RATING_BPS, MAX_S1_RATING_DAILY_DELTA_BPS, MIN_S1_RATING_BPS,
    },
    utils::SPUMP_DECIMALS,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolArgs {
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub spump_mint: Pubkey,
    pub max_proposal_duration_seconds: i64,
    pub max_exit_tax_bps: u16,
    pub min_exit_tax_bps: u16,
    pub tax_decay_threshold_supply: u64,
    pub daily_spump_emission_multiplier_bps: u16,
    pub new_user_emission_bps: u16,
    pub new_user_emission_window_seconds: i64,
    pub s1_min_user_xp: u64,
    pub max_s1_daily_buy_amount: u64,
    pub s1_early_cohort_supply_threshold: u64,
    pub s1_early_cohort_buyout_cap_bps: u16,
    pub min_creator_rating_bps: u16,
    pub max_creator_rating_bps: u16,
    pub max_creator_rating_daily_delta_bps: u16,
    pub s1_rating_effective_delay_seconds: i64,
    pub default_s1_graduation_target_supply: u64,
    pub s2_min_followers: u64,
    pub s2_min_valid_views: u64,
}

#[derive(Accounts)]
#[instruction(args: InitializeProtocolArgs)]
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
    #[account(address = args.spump_mint @ StreamPumpError::InvalidMint)]
    /// CHECK: validated in handler as Token-2022 mint with required extensions.
    pub spump_mint: UncheckedAccount<'info>,
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
    require!(
        args.daily_spump_emission_multiplier_bps > 0
            && args.new_user_emission_bps > 0
            && args.new_user_emission_bps <= 10_000
            && args.new_user_emission_window_seconds >= 0,
        StreamPumpError::InvalidEmissionConfig
    );
    require!(
        args.s1_min_user_xp >= DEFAULT_S1_MIN_USER_XP
            && args.max_s1_daily_buy_amount >= DEFAULT_MAX_S1_DAILY_BUY_AMOUNT
            && args.s1_early_cohort_supply_threshold >= DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD
            && args.s1_early_cohort_buyout_cap_bps > 0
            && args.s1_early_cohort_buyout_cap_bps <= DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS,
        StreamPumpError::InvalidS1GuardConfig
    );
    require!(
        args.min_creator_rating_bps > 0
            && args.max_creator_rating_bps >= args.min_creator_rating_bps
            && args.min_creator_rating_bps >= MIN_S1_RATING_BPS
            && args.max_creator_rating_bps <= MAX_S1_RATING_BPS
            && args.min_creator_rating_bps <= DEFAULT_S1_RATING_BPS
            && args.max_creator_rating_bps >= DEFAULT_S1_RATING_BPS
            && args.max_creator_rating_daily_delta_bps > 0
            && args.max_creator_rating_daily_delta_bps <= MAX_S1_RATING_DAILY_DELTA_BPS
            && args.s1_rating_effective_delay_seconds >= DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS
            && args.default_s1_graduation_target_supply >= DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
        StreamPumpError::InvalidCreatorRatingConfig
    );

    require_keys_eq!(
        *ctx.accounts.spump_mint.owner,
        TOKEN_2022_PROGRAM_ID,
        StreamPumpError::InvalidMint
    );

    let spump_mint_data = ctx.accounts.spump_mint.try_borrow_data()?;
    let spump_mint_state = StateWithExtensions::<SplToken2022Mint>::unpack(&spump_mint_data)
        .map_err(|_| error!(StreamPumpError::InvalidMint))?;
    require!(
        spump_mint_state.base.decimals == SPUMP_DECIMALS,
        StreamPumpError::InvalidSpumpMintDecimals
    );
    require!(
        spump_mint_state.get_extension::<NonTransferable>().is_ok(),
        StreamPumpError::MissingSpumpNonTransferableExtension
    );

    let mint_authority = match spump_mint_state.base.mint_authority {
        COption::Some(authority) => authority,
        COption::None => return err!(StreamPumpError::InvalidSpumpMintAuthority),
    };
    require_keys_eq!(
        mint_authority,
        ctx.accounts.protocol_config.key(),
        StreamPumpError::InvalidSpumpMintAuthority
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
    config.daily_spump_emission_multiplier_bps = args.daily_spump_emission_multiplier_bps;
    config.new_user_emission_bps = args.new_user_emission_bps;
    config.new_user_emission_window_seconds = args.new_user_emission_window_seconds;
    config.s1_min_user_xp = args.s1_min_user_xp;
    config.max_s1_daily_buy_amount = args.max_s1_daily_buy_amount;
    config.s1_early_cohort_supply_threshold = args.s1_early_cohort_supply_threshold;
    config.s1_early_cohort_buyout_cap_bps = args.s1_early_cohort_buyout_cap_bps;
    config.min_creator_rating_bps = args.min_creator_rating_bps;
    config.max_creator_rating_bps = args.max_creator_rating_bps;
    config.max_creator_rating_daily_delta_bps = args.max_creator_rating_daily_delta_bps;
    config.s1_rating_effective_delay_seconds = args.s1_rating_effective_delay_seconds;
    config.default_s1_graduation_target_supply = args.default_s1_graduation_target_supply;
    config.s2_min_followers = args.s2_min_followers;
    config.s2_min_valid_views = args.s2_min_valid_views;
    config.bump = ctx.bumps.protocol_config;

    Ok(())
}
