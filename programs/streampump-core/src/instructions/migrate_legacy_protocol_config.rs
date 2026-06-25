// EN: One-time devnet migration for legacy protocol_config account layouts.
// ZH: 针对旧版 protocol_config 账户布局的一次性 devnet 迁移。
use anchor_lang::{prelude::*, solana_program::program_option::COption, system_program};
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
        ProtocolConfig, DEFAULT_MAX_ENDORSEMENT_HARD_CEILING, DEFAULT_MAX_S1_DAILY_BUY_SPUMP,
        DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS, DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS,
        DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS, DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
        DEFAULT_S1_STATUS_THANKYOU_USDC, DEFAULT_TRACK2_REWARD_CAP_USDC, ResidualDestination,
        S1BuyoutRewardModel,
        DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS, DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD,
        DEFAULT_S1_GRADUATION_TARGET_SUPPLY, DEFAULT_S1_MIN_USER_XP,
        DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS, DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS,
        MAX_S1_RATING_BPS, MAX_S1_RATING_DAILY_DELTA_BPS, MIN_S1_RATING_BPS,
    },
    utils::SPUMP_DECIMALS,
};

const ACCOUNT_DISCRIMINATOR_LEN: usize = 8;
const LEGACY_PROTOCOL_CONFIG_ACCOUNT_LEN: usize = 174;
const CURRENT_PROTOCOL_CONFIG_ACCOUNT_LEN: usize =
    ACCOUNT_DISCRIMINATOR_LEN + ProtocolConfig::INIT_SPACE;
const CLAIM_WINDOW_PROTOCOL_CONFIG_SPACE: usize = 8;
const REWARD_CONFIG_PROTOCOL_CONFIG_SPACE: usize = 37;
const PRE_CLAIM_WINDOW_PROTOCOL_CONFIG_ACCOUNT_LEN: usize =
    CURRENT_PROTOCOL_CONFIG_ACCOUNT_LEN - CLAIM_WINDOW_PROTOCOL_CONFIG_SPACE;
const PRE_REWARD_CONFIG_PROTOCOL_CONFIG_ACCOUNT_LEN: usize =
    PRE_CLAIM_WINDOW_PROTOCOL_CONFIG_ACCOUNT_LEN - REWARD_CONFIG_PROTOCOL_CONFIG_SPACE;
const PRE_HARD_CEILING_PROTOCOL_CONFIG_ACCOUNT_LEN: usize =
    PRE_REWARD_CONFIG_PROTOCOL_CONFIG_ACCOUNT_LEN - 8;
const PRE_ENDORSEMENT_LIMIT_PROTOCOL_CONFIG_ACCOUNT_LEN: usize =
    PRE_HARD_CEILING_PROTOCOL_CONFIG_ACCOUNT_LEN - 2;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MigrateLegacyProtocolConfigArgs {
    pub new_oracle_authority: Pubkey,
}

#[derive(Accounts)]
pub struct MigrateLegacyProtocolConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: The legacy account is manually length-checked and deserialized.
    #[account(mut)]
    pub protocol_config: UncheckedAccount<'info>,

    /// CHECK: validated as the legacy configured Token-2022 SPUMP mint.
    pub spump_mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Clone, Copy)]
struct LegacyProtocolConfig {
    admin: Pubkey,
    usdc_mint: Pubkey,
    spump_mint: Pubkey,
    spump_mint_bump: u8,
    max_proposal_duration_seconds: i64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
    s2_min_followers: u64,
    s2_min_valid_views: u64,
    bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
struct PreviousProtocolConfig {
    admin: Pubkey,
    oracle_authority: Pubkey,
    usdc_mint: Pubkey,
    spump_mint: Pubkey,
    spump_mint_bump: u8,
    max_proposal_duration_seconds: i64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
    daily_spump_emission_multiplier_bps: u16,
    new_user_emission_bps: u16,
    new_user_emission_window_seconds: i64,
    s1_min_user_xp: u64,
    max_s1_daily_buy_spump: u64,
    s1_early_cohort_supply_threshold: u64,
    s1_early_cohort_buyout_cap_bps: u16,
    min_creator_rating_bps: u16,
    max_creator_rating_bps: u16,
    max_creator_rating_daily_delta_bps: u16,
    s1_rating_effective_delay_seconds: i64,
    default_s1_graduation_target_supply: u64,
    s1_rage_quit_window_seconds: i64,
    s2_min_followers: u64,
    s2_min_valid_views: u64,
    max_endorsement_per_user_bps: u16,
    bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
struct PreEndorsementLimitProtocolConfig {
    admin: Pubkey,
    oracle_authority: Pubkey,
    usdc_mint: Pubkey,
    spump_mint: Pubkey,
    spump_mint_bump: u8,
    max_proposal_duration_seconds: i64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
    daily_spump_emission_multiplier_bps: u16,
    new_user_emission_bps: u16,
    new_user_emission_window_seconds: i64,
    s1_min_user_xp: u64,
    max_s1_daily_buy_spump: u64,
    s1_early_cohort_supply_threshold: u64,
    s1_early_cohort_buyout_cap_bps: u16,
    min_creator_rating_bps: u16,
    max_creator_rating_bps: u16,
    max_creator_rating_daily_delta_bps: u16,
    s1_rating_effective_delay_seconds: i64,
    default_s1_graduation_target_supply: u64,
    s1_rage_quit_window_seconds: i64,
    s2_min_followers: u64,
    s2_min_valid_views: u64,
    bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
struct PreRewardConfigProtocolConfig {
    admin: Pubkey,
    oracle_authority: Pubkey,
    usdc_mint: Pubkey,
    spump_mint: Pubkey,
    spump_mint_bump: u8,
    max_proposal_duration_seconds: i64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
    daily_spump_emission_multiplier_bps: u16,
    new_user_emission_bps: u16,
    new_user_emission_window_seconds: i64,
    s1_min_user_xp: u64,
    max_s1_daily_buy_spump: u64,
    s1_early_cohort_supply_threshold: u64,
    s1_early_cohort_buyout_cap_bps: u16,
    min_creator_rating_bps: u16,
    max_creator_rating_bps: u16,
    max_creator_rating_daily_delta_bps: u16,
    s1_rating_effective_delay_seconds: i64,
    default_s1_graduation_target_supply: u64,
    s1_rage_quit_window_seconds: i64,
    s2_min_followers: u64,
    s2_min_valid_views: u64,
    max_endorsement_hard_ceiling: u64,
    max_endorsement_per_user_bps: u16,
    bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
struct PreClaimWindowProtocolConfig {
    admin: Pubkey,
    oracle_authority: Pubkey,
    usdc_mint: Pubkey,
    spump_mint: Pubkey,
    spump_mint_bump: u8,
    max_proposal_duration_seconds: i64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
    daily_spump_emission_multiplier_bps: u16,
    new_user_emission_bps: u16,
    new_user_emission_window_seconds: i64,
    s1_min_user_xp: u64,
    max_s1_daily_buy_spump: u64,
    s1_early_cohort_supply_threshold: u64,
    s1_early_cohort_buyout_cap_bps: u16,
    min_creator_rating_bps: u16,
    max_creator_rating_bps: u16,
    max_creator_rating_daily_delta_bps: u16,
    s1_rating_effective_delay_seconds: i64,
    default_s1_graduation_target_supply: u64,
    s1_rage_quit_window_seconds: i64,
    s2_min_followers: u64,
    s2_min_valid_views: u64,
    max_endorsement_hard_ceiling: u64,
    max_endorsement_per_user_bps: u16,
    s1_buyout_creator_share_bps: u16,
    s1_buyout_reward_model: u8,
    s1_discovery_reward_cap_usdc: u64,
    s1_status_thankyou_usdc: u64,
    s1_buyout_residual_to: u8,
    s1_discovery_min_hold_seconds: i64,
    track2_reward_cap_usdc: u64,
    track2_residual_to: u8,
    bump: u8,
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    let bytes: [u8; 32] = data
        .get(offset..offset + 32)
        .ok_or(error!(StreamPumpError::InvalidLegacyProtocolConfig))?
        .try_into()
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))?;
    Ok(Pubkey::new_from_array(bytes))
}

fn read_i64(data: &[u8], offset: usize) -> Result<i64> {
    let bytes: [u8; 8] = data
        .get(offset..offset + 8)
        .ok_or(error!(StreamPumpError::InvalidLegacyProtocolConfig))?
        .try_into()
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    let bytes: [u8; 8] = data
        .get(offset..offset + 8)
        .ok_or(error!(StreamPumpError::InvalidLegacyProtocolConfig))?
        .try_into()
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let bytes: [u8; 2] = data
        .get(offset..offset + 2)
        .ok_or(error!(StreamPumpError::InvalidLegacyProtocolConfig))?
        .try_into()
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_u8(data: &[u8], offset: usize) -> Result<u8> {
    data.get(offset)
        .copied()
        .ok_or(error!(StreamPumpError::InvalidLegacyProtocolConfig))
}

fn parse_legacy_protocol_config(data: &[u8]) -> Result<LegacyProtocolConfig> {
    require!(
        data.len() == LEGACY_PROTOCOL_CONFIG_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyProtocolConfig
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(ProtocolConfig::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyProtocolConfig
    );

    Ok(LegacyProtocolConfig {
        admin: read_pubkey(data, 8)?,
        usdc_mint: read_pubkey(data, 72)?,
        spump_mint: read_pubkey(data, 104)?,
        spump_mint_bump: read_u8(data, 136)?,
        max_proposal_duration_seconds: read_i64(data, 137)?,
        max_exit_tax_bps: read_u16(data, 145)?,
        min_exit_tax_bps: read_u16(data, 147)?,
        tax_decay_threshold_supply: read_u64(data, 149)?,
        s2_min_followers: read_u64(data, 157)?,
        s2_min_valid_views: read_u64(data, 165)?,
        bump: read_u8(data, 173)?,
    })
}

fn parse_previous_protocol_config(data: &[u8]) -> Result<PreviousProtocolConfig> {
    require!(
        data.len() == PRE_HARD_CEILING_PROTOCOL_CONFIG_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyProtocolConfig
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(ProtocolConfig::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyProtocolConfig
    );

    let mut reader = &data[ACCOUNT_DISCRIMINATOR_LEN..];
    PreviousProtocolConfig::deserialize(&mut reader)
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))
}

fn parse_pre_endorsement_limit_protocol_config(
    data: &[u8],
) -> Result<PreEndorsementLimitProtocolConfig> {
    require!(
        data.len() == PRE_ENDORSEMENT_LIMIT_PROTOCOL_CONFIG_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyProtocolConfig
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(ProtocolConfig::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyProtocolConfig
    );

    let mut reader = &data[ACCOUNT_DISCRIMINATOR_LEN..];
    PreEndorsementLimitProtocolConfig::deserialize(&mut reader)
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))
}

fn parse_pre_reward_config_protocol_config(
    data: &[u8],
) -> Result<PreRewardConfigProtocolConfig> {
    require!(
        data.len() == PRE_REWARD_CONFIG_PROTOCOL_CONFIG_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyProtocolConfig
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(ProtocolConfig::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyProtocolConfig
    );

    let mut reader = &data[ACCOUNT_DISCRIMINATOR_LEN..];
    PreRewardConfigProtocolConfig::deserialize(&mut reader)
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))
}

fn parse_pre_claim_window_protocol_config(data: &[u8]) -> Result<PreClaimWindowProtocolConfig> {
    require!(
        data.len() == PRE_CLAIM_WINDOW_PROTOCOL_CONFIG_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyProtocolConfig
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(ProtocolConfig::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyProtocolConfig
    );

    let mut reader = &data[ACCOUNT_DISCRIMINATOR_LEN..];
    PreClaimWindowProtocolConfig::deserialize(&mut reader)
        .map_err(|_| error!(StreamPumpError::InvalidLegacyProtocolConfig))
}

fn migrate_pre_reward_config(previous: PreRewardConfigProtocolConfig) -> ProtocolConfig {
    ProtocolConfig {
        admin: previous.admin,
        oracle_authority: previous.oracle_authority,
        usdc_mint: previous.usdc_mint,
        spump_mint: previous.spump_mint,
        spump_mint_bump: previous.spump_mint_bump,
        max_proposal_duration_seconds: previous.max_proposal_duration_seconds,
        max_exit_tax_bps: previous.max_exit_tax_bps,
        min_exit_tax_bps: previous.min_exit_tax_bps,
        tax_decay_threshold_supply: previous.tax_decay_threshold_supply,
        daily_spump_emission_multiplier_bps: previous.daily_spump_emission_multiplier_bps,
        new_user_emission_bps: previous.new_user_emission_bps,
        new_user_emission_window_seconds: previous.new_user_emission_window_seconds,
        s1_min_user_xp: previous.s1_min_user_xp,
        max_s1_daily_buy_spump: previous.max_s1_daily_buy_spump,
        s1_early_cohort_supply_threshold: previous.s1_early_cohort_supply_threshold,
        s1_early_cohort_buyout_cap_bps: previous.s1_early_cohort_buyout_cap_bps,
        min_creator_rating_bps: previous.min_creator_rating_bps,
        max_creator_rating_bps: previous.max_creator_rating_bps,
        max_creator_rating_daily_delta_bps: previous.max_creator_rating_daily_delta_bps,
        s1_rating_effective_delay_seconds: previous.s1_rating_effective_delay_seconds,
        default_s1_graduation_target_supply: previous.default_s1_graduation_target_supply,
        s1_rage_quit_window_seconds: previous.s1_rage_quit_window_seconds,
        s2_min_followers: previous.s2_min_followers,
        s2_min_valid_views: previous.s2_min_valid_views,
        max_endorsement_hard_ceiling: previous.max_endorsement_hard_ceiling,
        max_endorsement_per_user_bps: previous.max_endorsement_per_user_bps,
        s1_buyout_creator_share_bps: DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS,
        s1_buyout_reward_model: S1BuyoutRewardModel::DEFAULT,
        s1_discovery_reward_cap_usdc: DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
        s1_status_thankyou_usdc: DEFAULT_S1_STATUS_THANKYOU_USDC,
        s1_buyout_residual_to: ResidualDestination::S1_DEFAULT,
        s1_discovery_min_hold_seconds: DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS,
        s1_discovery_claim_window_seconds: DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS,
        track2_reward_cap_usdc: DEFAULT_TRACK2_REWARD_CAP_USDC,
        track2_residual_to: ResidualDestination::TRACK2_DEFAULT,
        bump: previous.bump,
    }
}

fn migrate_pre_claim_window_config(previous: PreClaimWindowProtocolConfig) -> ProtocolConfig {
    ProtocolConfig {
        admin: previous.admin,
        oracle_authority: previous.oracle_authority,
        usdc_mint: previous.usdc_mint,
        spump_mint: previous.spump_mint,
        spump_mint_bump: previous.spump_mint_bump,
        max_proposal_duration_seconds: previous.max_proposal_duration_seconds,
        max_exit_tax_bps: previous.max_exit_tax_bps,
        min_exit_tax_bps: previous.min_exit_tax_bps,
        tax_decay_threshold_supply: previous.tax_decay_threshold_supply,
        daily_spump_emission_multiplier_bps: previous.daily_spump_emission_multiplier_bps,
        new_user_emission_bps: previous.new_user_emission_bps,
        new_user_emission_window_seconds: previous.new_user_emission_window_seconds,
        s1_min_user_xp: previous.s1_min_user_xp,
        max_s1_daily_buy_spump: previous.max_s1_daily_buy_spump,
        s1_early_cohort_supply_threshold: previous.s1_early_cohort_supply_threshold,
        s1_early_cohort_buyout_cap_bps: previous.s1_early_cohort_buyout_cap_bps,
        min_creator_rating_bps: previous.min_creator_rating_bps,
        max_creator_rating_bps: previous.max_creator_rating_bps,
        max_creator_rating_daily_delta_bps: previous.max_creator_rating_daily_delta_bps,
        s1_rating_effective_delay_seconds: previous.s1_rating_effective_delay_seconds,
        default_s1_graduation_target_supply: previous.default_s1_graduation_target_supply,
        s1_rage_quit_window_seconds: previous.s1_rage_quit_window_seconds,
        s2_min_followers: previous.s2_min_followers,
        s2_min_valid_views: previous.s2_min_valid_views,
        max_endorsement_hard_ceiling: previous.max_endorsement_hard_ceiling,
        max_endorsement_per_user_bps: previous.max_endorsement_per_user_bps,
        s1_buyout_creator_share_bps: previous.s1_buyout_creator_share_bps,
        s1_buyout_reward_model: previous.s1_buyout_reward_model,
        s1_discovery_reward_cap_usdc: previous.s1_discovery_reward_cap_usdc,
        s1_status_thankyou_usdc: previous.s1_status_thankyou_usdc,
        s1_buyout_residual_to: previous.s1_buyout_residual_to,
        s1_discovery_min_hold_seconds: previous.s1_discovery_min_hold_seconds,
        s1_discovery_claim_window_seconds: DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS,
        track2_reward_cap_usdc: previous.track2_reward_cap_usdc,
        track2_residual_to: previous.track2_residual_to,
        bump: previous.bump,
    }
}

pub(crate) fn handler(
    ctx: Context<MigrateLegacyProtocolConfig>,
    args: MigrateLegacyProtocolConfigArgs,
) -> Result<()> {
    let protocol_config_info = ctx.accounts.protocol_config.to_account_info();
    require_keys_eq!(
        *protocol_config_info.owner,
        crate::ID,
        StreamPumpError::InvalidLegacyProtocolConfig
    );
    let (expected_protocol_config, expected_bump) =
        Pubkey::find_program_address(&[b"protocol_config"], &crate::ID);
    require_keys_eq!(
        protocol_config_info.key(),
        expected_protocol_config,
        StreamPumpError::InvalidLegacyProtocolConfig
    );

    let current_len = protocol_config_info.data_len();
    if current_len == CURRENT_PROTOCOL_CONFIG_ACCOUNT_LEN {
        return err!(StreamPumpError::LegacyProtocolConfigAlreadyMigrated);
    }

    let migrated = if current_len == PRE_CLAIM_WINDOW_PROTOCOL_CONFIG_ACCOUNT_LEN {
        let previous = {
            let data = protocol_config_info.try_borrow_data()?;
            parse_pre_claim_window_protocol_config(&data)?
        };
        require_keys_eq!(
            previous.admin,
            ctx.accounts.admin.key(),
            StreamPumpError::Unauthorized
        );
        require!(
            previous.bump == expected_bump && previous.spump_mint_bump == expected_bump,
            StreamPumpError::InvalidLegacyProtocolConfig
        );

        migrate_pre_claim_window_config(previous)
    } else if current_len == PRE_REWARD_CONFIG_PROTOCOL_CONFIG_ACCOUNT_LEN {
        let previous = {
            let data = protocol_config_info.try_borrow_data()?;
            parse_pre_reward_config_protocol_config(&data)?
        };
        require_keys_eq!(
            previous.admin,
            ctx.accounts.admin.key(),
            StreamPumpError::Unauthorized
        );
        require!(
            previous.bump == expected_bump && previous.spump_mint_bump == expected_bump,
            StreamPumpError::InvalidLegacyProtocolConfig
        );

        migrate_pre_reward_config(previous)
    } else if current_len == PRE_HARD_CEILING_PROTOCOL_CONFIG_ACCOUNT_LEN {
        let previous = {
            let data = protocol_config_info.try_borrow_data()?;
            parse_previous_protocol_config(&data)?
        };
        require_keys_eq!(
            previous.admin,
            ctx.accounts.admin.key(),
            StreamPumpError::Unauthorized
        );
        require!(
            previous.bump == expected_bump && previous.spump_mint_bump == expected_bump,
            StreamPumpError::InvalidLegacyProtocolConfig
        );

        ProtocolConfig {
            admin: previous.admin,
            oracle_authority: previous.oracle_authority,
            usdc_mint: previous.usdc_mint,
            spump_mint: previous.spump_mint,
            spump_mint_bump: previous.spump_mint_bump,
            max_proposal_duration_seconds: previous.max_proposal_duration_seconds,
            max_exit_tax_bps: previous.max_exit_tax_bps,
            min_exit_tax_bps: previous.min_exit_tax_bps,
            tax_decay_threshold_supply: previous.tax_decay_threshold_supply,
            daily_spump_emission_multiplier_bps: previous.daily_spump_emission_multiplier_bps,
            new_user_emission_bps: previous.new_user_emission_bps,
            new_user_emission_window_seconds: previous.new_user_emission_window_seconds,
            s1_min_user_xp: previous.s1_min_user_xp,
            max_s1_daily_buy_spump: previous.max_s1_daily_buy_spump,
            s1_early_cohort_supply_threshold: previous.s1_early_cohort_supply_threshold,
            s1_early_cohort_buyout_cap_bps: previous.s1_early_cohort_buyout_cap_bps,
            min_creator_rating_bps: previous.min_creator_rating_bps,
            max_creator_rating_bps: previous.max_creator_rating_bps,
            max_creator_rating_daily_delta_bps: previous.max_creator_rating_daily_delta_bps,
            s1_rating_effective_delay_seconds: previous.s1_rating_effective_delay_seconds,
            default_s1_graduation_target_supply: previous.default_s1_graduation_target_supply,
            s1_rage_quit_window_seconds: previous.s1_rage_quit_window_seconds,
            s2_min_followers: previous.s2_min_followers,
            s2_min_valid_views: previous.s2_min_valid_views,
            max_endorsement_hard_ceiling: DEFAULT_MAX_ENDORSEMENT_HARD_CEILING,
            max_endorsement_per_user_bps: previous.max_endorsement_per_user_bps,
            s1_buyout_creator_share_bps: DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS,
            s1_buyout_reward_model: S1BuyoutRewardModel::DEFAULT,
            s1_discovery_reward_cap_usdc: DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
            s1_status_thankyou_usdc: DEFAULT_S1_STATUS_THANKYOU_USDC,
            s1_buyout_residual_to: ResidualDestination::S1_DEFAULT,
            s1_discovery_min_hold_seconds: DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS,
            s1_discovery_claim_window_seconds: DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS,
            track2_reward_cap_usdc: DEFAULT_TRACK2_REWARD_CAP_USDC,
            track2_residual_to: ResidualDestination::TRACK2_DEFAULT,
            bump: previous.bump,
        }
    } else if current_len == PRE_ENDORSEMENT_LIMIT_PROTOCOL_CONFIG_ACCOUNT_LEN {
        let previous = {
            let data = protocol_config_info.try_borrow_data()?;
            parse_pre_endorsement_limit_protocol_config(&data)?
        };
        require_keys_eq!(
            previous.admin,
            ctx.accounts.admin.key(),
            StreamPumpError::Unauthorized
        );
        require!(
            previous.bump == expected_bump && previous.spump_mint_bump == expected_bump,
            StreamPumpError::InvalidLegacyProtocolConfig
        );

        ProtocolConfig {
            admin: previous.admin,
            oracle_authority: previous.oracle_authority,
            usdc_mint: previous.usdc_mint,
            spump_mint: previous.spump_mint,
            spump_mint_bump: previous.spump_mint_bump,
            max_proposal_duration_seconds: previous.max_proposal_duration_seconds,
            max_exit_tax_bps: previous.max_exit_tax_bps,
            min_exit_tax_bps: previous.min_exit_tax_bps,
            tax_decay_threshold_supply: previous.tax_decay_threshold_supply,
            daily_spump_emission_multiplier_bps: previous.daily_spump_emission_multiplier_bps,
            new_user_emission_bps: previous.new_user_emission_bps,
            new_user_emission_window_seconds: previous.new_user_emission_window_seconds,
            s1_min_user_xp: previous.s1_min_user_xp,
            max_s1_daily_buy_spump: previous.max_s1_daily_buy_spump,
            s1_early_cohort_supply_threshold: previous.s1_early_cohort_supply_threshold,
            s1_early_cohort_buyout_cap_bps: previous.s1_early_cohort_buyout_cap_bps,
            min_creator_rating_bps: previous.min_creator_rating_bps,
            max_creator_rating_bps: previous.max_creator_rating_bps,
            max_creator_rating_daily_delta_bps: previous.max_creator_rating_daily_delta_bps,
            s1_rating_effective_delay_seconds: previous.s1_rating_effective_delay_seconds,
            default_s1_graduation_target_supply: previous.default_s1_graduation_target_supply,
            s1_rage_quit_window_seconds: previous.s1_rage_quit_window_seconds,
            s2_min_followers: previous.s2_min_followers,
            s2_min_valid_views: previous.s2_min_valid_views,
            max_endorsement_hard_ceiling: DEFAULT_MAX_ENDORSEMENT_HARD_CEILING,
            max_endorsement_per_user_bps: 2_000,
            s1_buyout_creator_share_bps: DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS,
            s1_buyout_reward_model: S1BuyoutRewardModel::DEFAULT,
            s1_discovery_reward_cap_usdc: DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
            s1_status_thankyou_usdc: DEFAULT_S1_STATUS_THANKYOU_USDC,
            s1_buyout_residual_to: ResidualDestination::S1_DEFAULT,
            s1_discovery_min_hold_seconds: DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS,
            s1_discovery_claim_window_seconds: DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS,
            track2_reward_cap_usdc: DEFAULT_TRACK2_REWARD_CAP_USDC,
            track2_residual_to: ResidualDestination::TRACK2_DEFAULT,
            bump: previous.bump,
        }
    } else if current_len == LEGACY_PROTOCOL_CONFIG_ACCOUNT_LEN {
        let legacy = {
            let data = protocol_config_info.try_borrow_data()?;
            parse_legacy_protocol_config(&data)?
        };
        require_keys_eq!(
            legacy.admin,
            ctx.accounts.admin.key(),
            StreamPumpError::Unauthorized
        );
        require!(
            legacy.bump == expected_bump && legacy.spump_mint_bump == expected_bump,
            StreamPumpError::InvalidLegacyProtocolConfig
        );

        ProtocolConfig {
            admin: legacy.admin,
            oracle_authority: args.new_oracle_authority,
            usdc_mint: legacy.usdc_mint,
            spump_mint: legacy.spump_mint,
            spump_mint_bump: legacy.spump_mint_bump,
            max_proposal_duration_seconds: legacy.max_proposal_duration_seconds,
            max_exit_tax_bps: legacy.max_exit_tax_bps,
            min_exit_tax_bps: legacy.min_exit_tax_bps,
            tax_decay_threshold_supply: legacy.tax_decay_threshold_supply,
            daily_spump_emission_multiplier_bps: 50_000,
            new_user_emission_bps: 2_500,
            new_user_emission_window_seconds: 7 * 86_400,
            s1_min_user_xp: DEFAULT_S1_MIN_USER_XP,
            max_s1_daily_buy_spump: DEFAULT_MAX_S1_DAILY_BUY_SPUMP,
            s1_early_cohort_supply_threshold: DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD,
            s1_early_cohort_buyout_cap_bps: DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS,
            min_creator_rating_bps: MIN_S1_RATING_BPS,
            max_creator_rating_bps: MAX_S1_RATING_BPS,
            max_creator_rating_daily_delta_bps: MAX_S1_RATING_DAILY_DELTA_BPS,
            s1_rating_effective_delay_seconds: DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS,
            default_s1_graduation_target_supply: DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
            s1_rage_quit_window_seconds: DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS,
            s2_min_followers: legacy.s2_min_followers,
            s2_min_valid_views: legacy.s2_min_valid_views,
            max_endorsement_hard_ceiling: DEFAULT_MAX_ENDORSEMENT_HARD_CEILING,
            max_endorsement_per_user_bps: 2_000,
            s1_buyout_creator_share_bps: DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS,
            s1_buyout_reward_model: S1BuyoutRewardModel::DEFAULT,
            s1_discovery_reward_cap_usdc: DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
            s1_status_thankyou_usdc: DEFAULT_S1_STATUS_THANKYOU_USDC,
            s1_buyout_residual_to: ResidualDestination::S1_DEFAULT,
            s1_discovery_min_hold_seconds: DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS,
            s1_discovery_claim_window_seconds: DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS,
            track2_reward_cap_usdc: DEFAULT_TRACK2_REWARD_CAP_USDC,
            track2_residual_to: ResidualDestination::TRACK2_DEFAULT,
            bump: legacy.bump,
        }
    } else {
        return err!(StreamPumpError::InvalidLegacyProtocolConfig);
    };

    require_keys_eq!(
        ctx.accounts.spump_mint.key(),
        migrated.spump_mint,
        StreamPumpError::InvalidMint
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
        protocol_config_info.key(),
        StreamPumpError::InvalidSpumpMintAuthority
    );
    drop(spump_mint_data);

    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(CURRENT_PROTOCOL_CONFIG_ACCOUNT_LEN);
    let current_lamports = protocol_config_info.lamports();
    if current_lamports < required_lamports {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.admin.to_account_info(),
                    to: protocol_config_info.clone(),
                },
            ),
            required_lamports - current_lamports,
        )?;
    }

    protocol_config_info.realloc(CURRENT_PROTOCOL_CONFIG_ACCOUNT_LEN, true)?;

    let mut data = protocol_config_info.try_borrow_mut_data()?;
    data[..ACCOUNT_DISCRIMINATOR_LEN].copy_from_slice(ProtocolConfig::DISCRIMINATOR);
    let mut writer = &mut data[ACCOUNT_DISCRIMINATOR_LEN..];
    migrated.serialize(&mut writer)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pre_reward_config_migration_sets_reward_defaults() {
        let previous = PreRewardConfigProtocolConfig {
            admin: Pubkey::new_unique(),
            oracle_authority: Pubkey::new_unique(),
            usdc_mint: Pubkey::new_unique(),
            spump_mint: Pubkey::new_unique(),
            spump_mint_bump: 254,
            max_proposal_duration_seconds: 86_400,
            max_exit_tax_bps: 2_500,
            min_exit_tax_bps: 500,
            tax_decay_threshold_supply: 1_000_000,
            daily_spump_emission_multiplier_bps: 50_000,
            new_user_emission_bps: 2_500,
            new_user_emission_window_seconds: 604_800,
            s1_min_user_xp: 10,
            max_s1_daily_buy_spump: 15_000_000,
            s1_early_cohort_supply_threshold: 500,
            s1_early_cohort_buyout_cap_bps: 2_000,
            min_creator_rating_bps: MIN_S1_RATING_BPS,
            max_creator_rating_bps: MAX_S1_RATING_BPS,
            max_creator_rating_daily_delta_bps: MAX_S1_RATING_DAILY_DELTA_BPS,
            s1_rating_effective_delay_seconds: DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS,
            default_s1_graduation_target_supply: DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
            s1_rage_quit_window_seconds: DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS,
            s2_min_followers: 1_000,
            s2_min_valid_views: 10_000,
            max_endorsement_hard_ceiling: DEFAULT_MAX_ENDORSEMENT_HARD_CEILING,
            max_endorsement_per_user_bps: 2_000,
            bump: 254,
        };

        let mut data = Vec::with_capacity(PRE_REWARD_CONFIG_PROTOCOL_CONFIG_ACCOUNT_LEN);
        data.extend_from_slice(ProtocolConfig::DISCRIMINATOR);
        previous.serialize(&mut data).unwrap();
        assert_eq!(data.len(), PRE_REWARD_CONFIG_PROTOCOL_CONFIG_ACCOUNT_LEN);

        let parsed = parse_pre_reward_config_protocol_config(&data).unwrap();
        let migrated = migrate_pre_reward_config(parsed);

        assert_eq!(
            migrated.s1_buyout_creator_share_bps,
            DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS
        );
        assert_eq!(
            migrated.s1_buyout_reward_model,
            S1BuyoutRewardModel::DEFAULT
        );
        assert_eq!(
            migrated.s1_discovery_reward_cap_usdc,
            DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC
        );
        assert_eq!(
            migrated.s1_status_thankyou_usdc,
            DEFAULT_S1_STATUS_THANKYOU_USDC
        );
        assert_eq!(
            migrated.s1_buyout_residual_to,
            ResidualDestination::S1_DEFAULT
        );
        assert_eq!(
            migrated.s1_discovery_min_hold_seconds,
            DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS
        );
        assert_eq!(
            migrated.s1_discovery_claim_window_seconds,
            DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS
        );
        assert_eq!(
            migrated.track2_reward_cap_usdc,
            DEFAULT_TRACK2_REWARD_CAP_USDC
        );
        assert_eq!(
            migrated.track2_residual_to,
            ResidualDestination::TRACK2_DEFAULT
        );
        assert_eq!(migrated.admin, previous.admin);
        assert_eq!(
            migrated.max_endorsement_hard_ceiling,
            previous.max_endorsement_hard_ceiling
        );
    }

    #[test]
    fn parses_pre_endorsement_limit_protocol_config() {
        let previous = PreEndorsementLimitProtocolConfig {
            admin: Pubkey::new_unique(),
            oracle_authority: Pubkey::new_unique(),
            usdc_mint: Pubkey::new_unique(),
            spump_mint: Pubkey::new_unique(),
            spump_mint_bump: 254,
            max_proposal_duration_seconds: 86_400,
            max_exit_tax_bps: 2_500,
            min_exit_tax_bps: 500,
            tax_decay_threshold_supply: 1_000_000,
            daily_spump_emission_multiplier_bps: 50_000,
            new_user_emission_bps: 2_500,
            new_user_emission_window_seconds: 604_800,
            s1_min_user_xp: 10,
            max_s1_daily_buy_spump: 15_000_000,
            s1_early_cohort_supply_threshold: 500,
            s1_early_cohort_buyout_cap_bps: 2_000,
            min_creator_rating_bps: MIN_S1_RATING_BPS,
            max_creator_rating_bps: MAX_S1_RATING_BPS,
            max_creator_rating_daily_delta_bps: MAX_S1_RATING_DAILY_DELTA_BPS,
            s1_rating_effective_delay_seconds: DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS,
            default_s1_graduation_target_supply: DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
            s1_rage_quit_window_seconds: DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS,
            s2_min_followers: 1_000,
            s2_min_valid_views: 10_000,
            bump: 254,
        };

        let mut data = Vec::with_capacity(PRE_ENDORSEMENT_LIMIT_PROTOCOL_CONFIG_ACCOUNT_LEN);
        data.extend_from_slice(ProtocolConfig::DISCRIMINATOR);
        previous.serialize(&mut data).unwrap();
        assert_eq!(
            data.len(),
            PRE_ENDORSEMENT_LIMIT_PROTOCOL_CONFIG_ACCOUNT_LEN
        );

        let parsed = parse_pre_endorsement_limit_protocol_config(&data).unwrap();
        assert_eq!(parsed.admin, previous.admin);
        assert_eq!(parsed.oracle_authority, previous.oracle_authority);
        assert_eq!(parsed.bump, previous.bump);
    }
}
