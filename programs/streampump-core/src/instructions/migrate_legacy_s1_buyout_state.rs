use anchor_lang::{prelude::*, system_program};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, ProtocolConfig, S1BuyoutState},
};

const ACCOUNT_DISCRIMINATOR_LEN: usize = 8;
const GRADUATED_AT_SPACE: usize = 8;
const CURRENT_S1_BUYOUT_STATE_ACCOUNT_LEN: usize =
    ACCOUNT_DISCRIMINATOR_LEN + S1BuyoutState::INIT_SPACE;
const LEGACY_S1_BUYOUT_STATE_ACCOUNT_LEN: usize =
    CURRENT_S1_BUYOUT_STATE_ACCOUNT_LEN - GRADUATED_AT_SPACE;

#[derive(Accounts)]
pub struct MigrateLegacyS1BuyoutState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(seeds = [b"creator", creator_profile.authority.as_ref()], bump = creator_profile.bump)]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// CHECK: manually length-checked and deserialized to support pre-graduated_at buyout states.
    #[account(mut)]
    pub s1_buyout_state: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
struct LegacyS1BuyoutState {
    creator: Pubkey,
    winning_sponsor: Option<Pubkey>,
    usdc_deposited: u64,
    creator_payout_usdc: u64,
    discovery_pool_usdc: u64,
    discovery_pool_remaining: u64,
    eligible_holder_count: u32,
    early_holder_count: u32,
    regular_holder_count: u32,
    reward_model_snapshot: u8,
    residual_to_snapshot: u8,
    discovery_reward_cap_usdc_snapshot: u64,
    status_thankyou_usdc_snapshot: u64,
    discovery_min_hold_seconds_snapshot: i64,
    creator_paid: bool,
    claimable_usdc_remaining: u64,
    claimable_s1_supply_remaining: u64,
    early_claimable_usdc_remaining: u64,
    early_claimable_s1_supply_remaining: u64,
    regular_claimable_usdc_remaining: u64,
    regular_claimable_s1_supply_remaining: u64,
    rage_quit_deadline: i64,
    bump: u8,
}

fn parse_legacy_s1_buyout_state(data: &[u8]) -> Result<LegacyS1BuyoutState> {
    require!(
        data.len() == LEGACY_S1_BUYOUT_STATE_ACCOUNT_LEN,
        StreamPumpError::InvalidLegacyS1BuyoutState
    );
    require!(
        data.get(..ACCOUNT_DISCRIMINATOR_LEN) == Some(S1BuyoutState::DISCRIMINATOR),
        StreamPumpError::InvalidLegacyS1BuyoutState
    );

    let mut reader = &data[ACCOUNT_DISCRIMINATOR_LEN..];
    LegacyS1BuyoutState::deserialize(&mut reader)
        .map_err(|_| error!(StreamPumpError::InvalidLegacyS1BuyoutState))
}

fn migrate_legacy_s1_buyout_state(previous: LegacyS1BuyoutState) -> S1BuyoutState {
    S1BuyoutState {
        creator: previous.creator,
        winning_sponsor: previous.winning_sponsor,
        usdc_deposited: previous.usdc_deposited,
        creator_payout_usdc: previous.creator_payout_usdc,
        discovery_pool_usdc: previous.discovery_pool_usdc,
        discovery_pool_remaining: previous.discovery_pool_remaining,
        eligible_holder_count: previous.eligible_holder_count,
        early_holder_count: previous.early_holder_count,
        regular_holder_count: previous.regular_holder_count,
        reward_model_snapshot: previous.reward_model_snapshot,
        residual_to_snapshot: previous.residual_to_snapshot,
        discovery_reward_cap_usdc_snapshot: previous.discovery_reward_cap_usdc_snapshot,
        status_thankyou_usdc_snapshot: previous.status_thankyou_usdc_snapshot,
        discovery_min_hold_seconds_snapshot: previous.discovery_min_hold_seconds_snapshot,
        creator_paid: previous.creator_paid,
        graduated_at: 0,
        claimable_usdc_remaining: previous.claimable_usdc_remaining,
        claimable_s1_supply_remaining: previous.claimable_s1_supply_remaining,
        early_claimable_usdc_remaining: previous.early_claimable_usdc_remaining,
        early_claimable_s1_supply_remaining: previous.early_claimable_s1_supply_remaining,
        regular_claimable_usdc_remaining: previous.regular_claimable_usdc_remaining,
        regular_claimable_s1_supply_remaining: previous.regular_claimable_s1_supply_remaining,
        rage_quit_deadline: previous.rage_quit_deadline,
        bump: previous.bump,
    }
}

pub(crate) fn handler(ctx: Context<MigrateLegacyS1BuyoutState>) -> Result<()> {
    let state_info = ctx.accounts.s1_buyout_state.to_account_info();
    require_keys_eq!(
        *state_info.owner,
        crate::ID,
        StreamPumpError::InvalidLegacyS1BuyoutState
    );

    if state_info.data_len() == CURRENT_S1_BUYOUT_STATE_ACCOUNT_LEN {
        return err!(StreamPumpError::LegacyS1BuyoutStateAlreadyMigrated);
    }

    let previous = {
        let data = state_info.try_borrow_data()?;
        parse_legacy_s1_buyout_state(&data)?
    };
    require_keys_eq!(
        previous.creator,
        ctx.accounts.creator_profile.key(),
        StreamPumpError::BuyoutStateMismatch
    );
    let (expected_state, expected_bump) =
        Pubkey::find_program_address(&[b"s1_buyout_state", previous.creator.as_ref()], &crate::ID);
    require_keys_eq!(
        state_info.key(),
        expected_state,
        StreamPumpError::InvalidLegacyS1BuyoutState
    );
    require!(
        previous.bump == expected_bump,
        StreamPumpError::InvalidLegacyS1BuyoutState
    );

    let payer = ctx.accounts.payer.key();
    require!(
        payer == ctx.accounts.creator_profile.authority
            || payer == ctx.accounts.protocol_config.admin
            || payer == ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let migrated = migrate_legacy_s1_buyout_state(previous);
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(CURRENT_S1_BUYOUT_STATE_ACCOUNT_LEN);
    let current_lamports = state_info.lamports();
    if current_lamports < required_lamports {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: state_info.clone(),
                },
            ),
            required_lamports - current_lamports,
        )?;
    }

    state_info.realloc(CURRENT_S1_BUYOUT_STATE_ACCOUNT_LEN, true)?;
    let mut data = state_info.try_borrow_mut_data()?;
    data[..ACCOUNT_DISCRIMINATOR_LEN].copy_from_slice(S1BuyoutState::DISCRIMINATOR);
    let mut writer = &mut data[ACCOUNT_DISCRIMINATOR_LEN..];
    migrated.serialize(&mut writer)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_s1_buyout_state_migration_sets_graduated_at_zero() {
        let previous = LegacyS1BuyoutState {
            creator: Pubkey::new_unique(),
            winning_sponsor: Some(Pubkey::new_unique()),
            usdc_deposited: 1_000,
            creator_payout_usdc: 800,
            discovery_pool_usdc: 200,
            discovery_pool_remaining: 100,
            eligible_holder_count: 2,
            early_holder_count: 1,
            regular_holder_count: 1,
            reward_model_snapshot: 1,
            residual_to_snapshot: 0,
            discovery_reward_cap_usdc_snapshot: 50,
            status_thankyou_usdc_snapshot: 10,
            discovery_min_hold_seconds_snapshot: 0,
            creator_paid: true,
            claimable_usdc_remaining: 100,
            claimable_s1_supply_remaining: 2,
            early_claimable_usdc_remaining: 0,
            early_claimable_s1_supply_remaining: 1,
            regular_claimable_usdc_remaining: 0,
            regular_claimable_s1_supply_remaining: 1,
            rage_quit_deadline: 99,
            bump: 254,
        };

        let migrated = migrate_legacy_s1_buyout_state(previous.clone());
        assert_eq!(migrated.graduated_at, 0);
        assert_eq!(
            migrated.discovery_pool_remaining,
            previous.discovery_pool_remaining
        );
        assert_eq!(migrated.eligible_holder_count, previous.eligible_holder_count);
    }
}
