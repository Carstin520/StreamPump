use anchor_lang::{prelude::*, system_program};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus},
};

const ACCOUNT_DISCRIMINATOR_LEN: usize = 8;
const HOLDER_COUNTER_SPACE: usize = 12;
const CURRENT_CREATOR_PROFILE_ACCOUNT_LEN: usize =
    ACCOUNT_DISCRIMINATOR_LEN + CreatorProfile::INIT_SPACE;
const LEGACY_CREATOR_PROFILE_ACCOUNT_LEN: usize =
    CURRENT_CREATOR_PROFILE_ACCOUNT_LEN - HOLDER_COUNTER_SPACE;

#[derive(Accounts)]
pub struct MigrateLegacyCreatorProfile<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, crate::state::ProtocolConfig>,

    /// CHECK: manually length-checked and deserialized to support pre-counter profiles.
    #[account(mut)]
    pub creator_profile: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
struct LegacyCreatorProfile {
    authority: Pubkey,
    handle: String,
    payout_usdc_ata: Pubkey,
    level: u8,
    status: CreatorStatus,
    s1_supply: u64,
    s1_early_cohort_supply: u64,
    s1_rating_bps: u16,
    s1_graduation_target_supply: u64,
    pending_s1_rating_bps: u16,
    pending_s1_graduation_target_supply: u64,
    pending_rating_effective_at: i64,
    pending_rating_report_digest: [u8; 32],
    last_rating_update_at: i64,
    last_rating_report_digest: [u8; 32],
    last_upgrade_at: i64,
    created_at: i64,
    updated_at: i64,
    bump: u8,
}

fn parse_legacy_creator_profile(data: &[u8]) -> Result<LegacyCreatorProfile> {
    require!(
        data.len() == LEGACY_CREATOR_PROFILE_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyCreatorProfile
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(CreatorProfile::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyCreatorProfile
    );

    let mut reader = &data[ACCOUNT_DISCRIMINATOR_LEN..];
    LegacyCreatorProfile::deserialize(&mut reader)
        .map_err(|_| error!(StreamPumpError::InvalidLegacyCreatorProfile))
}

fn migrate_legacy_creator_profile(previous: LegacyCreatorProfile) -> CreatorProfile {
    CreatorProfile {
        authority: previous.authority,
        handle: previous.handle,
        payout_usdc_ata: previous.payout_usdc_ata,
        level: previous.level,
        status: previous.status,
        s1_supply: previous.s1_supply,
        s1_early_cohort_supply: previous.s1_early_cohort_supply,
        s1_eligible_holder_count: 0,
        s1_early_holder_count: 0,
        s1_regular_holder_count: 0,
        s1_rating_bps: previous.s1_rating_bps,
        s1_graduation_target_supply: previous.s1_graduation_target_supply,
        pending_s1_rating_bps: previous.pending_s1_rating_bps,
        pending_s1_graduation_target_supply: previous.pending_s1_graduation_target_supply,
        pending_rating_effective_at: previous.pending_rating_effective_at,
        pending_rating_report_digest: previous.pending_rating_report_digest,
        last_rating_update_at: previous.last_rating_update_at,
        last_rating_report_digest: previous.last_rating_report_digest,
        last_upgrade_at: previous.last_upgrade_at,
        created_at: previous.created_at,
        updated_at: previous.updated_at,
        bump: previous.bump,
    }
}

fn assert_legacy_creator_profile_migratable(previous: &LegacyCreatorProfile) -> Result<()> {
    require!(
        previous.s1_supply == 0 && previous.s1_early_cohort_supply == 0,
        StreamPumpError::LegacyCreatorProfileRequiresHolderBackfill
    );
    Ok(())
}

pub(crate) fn handler(ctx: Context<MigrateLegacyCreatorProfile>) -> Result<()> {
    let profile_info = ctx.accounts.creator_profile.to_account_info();
    require_keys_eq!(
        *profile_info.owner,
        crate::ID,
        StreamPumpError::InvalidLegacyCreatorProfile
    );

    if profile_info.data_len() == CURRENT_CREATOR_PROFILE_ACCOUNT_LEN {
        return err!(StreamPumpError::LegacyCreatorProfileAlreadyMigrated);
    }

    let previous = {
        let data = profile_info.try_borrow_data()?;
        parse_legacy_creator_profile(&data)?
    };
    let (expected_profile, expected_bump) =
        Pubkey::find_program_address(&[b"creator", previous.authority.as_ref()], &crate::ID);
    require_keys_eq!(
        profile_info.key(),
        expected_profile,
        StreamPumpError::InvalidLegacyCreatorProfile
    );
    require!(
        previous.bump == expected_bump,
        StreamPumpError::InvalidLegacyCreatorProfile
    );
    assert_legacy_creator_profile_migratable(&previous)?;

    let payer = ctx.accounts.payer.key();
    require!(
        payer == previous.authority
            || payer == ctx.accounts.protocol_config.admin
            || payer == ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let migrated = migrate_legacy_creator_profile(previous);
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(CURRENT_CREATOR_PROFILE_ACCOUNT_LEN);
    let current_lamports = profile_info.lamports();
    if current_lamports < required_lamports {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: profile_info.clone(),
                },
            ),
            required_lamports - current_lamports,
        )?;
    }

    profile_info.realloc(CURRENT_CREATOR_PROFILE_ACCOUNT_LEN, true)?;
    let mut data = profile_info.try_borrow_mut_data()?;
    data[..ACCOUNT_DISCRIMINATOR_LEN].copy_from_slice(CreatorProfile::DISCRIMINATOR);
    let mut writer = &mut data[ACCOUNT_DISCRIMINATOR_LEN..];
    migrated.serialize(&mut writer)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_legacy_creator_profile_migration_sets_holder_counters_to_zero() {
        let previous = LegacyCreatorProfile {
            authority: Pubkey::new_unique(),
            handle: "creator".to_string(),
            payout_usdc_ata: Pubkey::new_unique(),
            level: 1,
            status: CreatorStatus::S1_Active,
            s1_supply: 0,
            s1_early_cohort_supply: 0,
            s1_rating_bps: 10_000,
            s1_graduation_target_supply: 2_500,
            pending_s1_rating_bps: 0,
            pending_s1_graduation_target_supply: 0,
            pending_rating_effective_at: 0,
            pending_rating_report_digest: [0; 32],
            last_rating_update_at: 0,
            last_rating_report_digest: [1; 32],
            last_upgrade_at: 0,
            created_at: 10,
            updated_at: 20,
            bump: 254,
        };

        let migrated = migrate_legacy_creator_profile(previous.clone());
        assert_eq!(migrated.s1_eligible_holder_count, 0);
        assert_eq!(migrated.s1_early_holder_count, 0);
        assert_eq!(migrated.s1_regular_holder_count, 0);
        assert_eq!(migrated.s1_supply, previous.s1_supply);
        assert_eq!(
            migrated.s1_early_cohort_supply,
            previous.s1_early_cohort_supply
        );
    }

    #[test]
    fn active_legacy_creator_profile_requires_holder_counter_backfill() {
        let previous = LegacyCreatorProfile {
            authority: Pubkey::new_unique(),
            handle: "creator".to_string(),
            payout_usdc_ata: Pubkey::new_unique(),
            level: 1,
            status: CreatorStatus::S1_Active,
            s1_supply: 123,
            s1_early_cohort_supply: 45,
            s1_rating_bps: 10_000,
            s1_graduation_target_supply: 2_500,
            pending_s1_rating_bps: 0,
            pending_s1_graduation_target_supply: 0,
            pending_rating_effective_at: 0,
            pending_rating_report_digest: [0; 32],
            last_rating_update_at: 0,
            last_rating_report_digest: [1; 32],
            last_upgrade_at: 0,
            created_at: 10,
            updated_at: 20,
            bump: 254,
        };

        assert!(assert_legacy_creator_profile_migratable(&previous).is_err());
    }
}
