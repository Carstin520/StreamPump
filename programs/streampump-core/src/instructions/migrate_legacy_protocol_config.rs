// EN: One-time devnet migration for the legacy 174-byte protocol_config account.
// ZH: 针对旧版 174 字节 protocol_config 账户的一次性 devnet 迁移。
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
        ProtocolConfig, DEFAULT_MAX_S1_DAILY_BUY_SPUMP, DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS,
        DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD, DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
        DEFAULT_S1_MIN_USER_XP, DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS,
        DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS, MAX_S1_RATING_BPS,
        MAX_S1_RATING_DAILY_DELTA_BPS, MIN_S1_RATING_BPS,
    },
    utils::SPUMP_DECIMALS,
};

const ACCOUNT_DISCRIMINATOR_LEN: usize = 8;
const LEGACY_PROTOCOL_CONFIG_ACCOUNT_LEN: usize = 174;
const CURRENT_PROTOCOL_CONFIG_ACCOUNT_LEN: usize =
    ACCOUNT_DISCRIMINATOR_LEN + ProtocolConfig::INIT_SPACE;

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
    require!(
        current_len == LEGACY_PROTOCOL_CONFIG_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyProtocolConfig
    );

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
    require_keys_eq!(
        ctx.accounts.spump_mint.key(),
        legacy.spump_mint,
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

    let migrated = ProtocolConfig {
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
        bump: legacy.bump,
    };

    let mut data = protocol_config_info.try_borrow_mut_data()?;
    data[..ACCOUNT_DISCRIMINATOR_LEN].copy_from_slice(ProtocolConfig::DISCRIMINATOR);
    let mut writer = &mut data[ACCOUNT_DISCRIMINATOR_LEN..];
    migrated.serialize(&mut writer)?;

    Ok(())
}
