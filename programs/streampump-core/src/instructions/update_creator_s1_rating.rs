// EN: Oracle-authorized daily S1 creator rating update.
//     The rating adjusts the effective S1 bonding-curve slope and the creator's
//     graduation supply target. It is intentionally rate-limited to reduce
//     pre-update arbitrage around creator momentum changes.
//
// ZH: 由预言机授权的每日 S1 创作者评级更新。
//     评级会影响 S1 联合曲线的有效斜率和创作者毕业 supply 目标。
//     更新被刻意限频，以降低围绕创作者动量变化的抢跑套利。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    events::CreatorS1RatingUpdated,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
        S1_RATING_UPDATE_COOLDOWN_SECONDS,
    },
    utils::activate_pending_s1_rating,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateCreatorS1RatingArgs {
    pub rating_bps: u16,
    pub graduation_target_supply: u64,
    pub report_id: [u8; 32],
    pub report_digest: [u8; 32],
    pub observed_at: i64,
}

#[derive(Accounts)]
pub struct UpdateCreatorS1Rating<'info> {
    pub oracle: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority != Pubkey::default() @ StreamPumpError::CreatorNotRegistered
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
}

pub(crate) fn handler(
    ctx: Context<UpdateCreatorS1Rating>,
    args: UpdateCreatorS1RatingArgs,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );
    require!(
        args.rating_bps >= ctx.accounts.protocol_config.min_creator_rating_bps
            && args.rating_bps <= ctx.accounts.protocol_config.max_creator_rating_bps
            && args.graduation_target_supply >= DEFAULT_S1_GRADUATION_TARGET_SUPPLY,
        StreamPumpError::InvalidCreatorRatingConfig
    );
    require!(
        args.report_digest != [0_u8; 32],
        StreamPumpError::InvalidReportDigest
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        args.observed_at > 0 && args.observed_at <= now,
        StreamPumpError::InvalidObservedAt
    );

    let creator_profile = &mut ctx.accounts.creator_profile;
    activate_pending_s1_rating(creator_profile, now);
    require!(
        creator_profile.status == CreatorStatus::S1_Active,
        StreamPumpError::InvalidCreatorStatus
    );
    let previous_rating_bps = creator_profile.s1_rating_bps;
    let previous_graduation_target_supply = creator_profile.s1_graduation_target_supply;

    if creator_profile.last_rating_update_at > 0 {
        let next_allowed_at = creator_profile
            .last_rating_update_at
            .checked_add(S1_RATING_UPDATE_COOLDOWN_SECONDS)
            .ok_or(StreamPumpError::MathOverflow)?;
        require!(
            now >= next_allowed_at,
            StreamPumpError::CreatorRatingUpdateTooSoon
        );

        let delta = if args.rating_bps >= previous_rating_bps {
            args.rating_bps - previous_rating_bps
        } else {
            previous_rating_bps - args.rating_bps
        };
        require!(
            delta
                <= ctx
                    .accounts
                    .protocol_config
                    .max_creator_rating_daily_delta_bps,
            StreamPumpError::CreatorRatingChangeTooLarge
        );
    }

    let effective_at = now
        .checked_add(
            ctx.accounts
                .protocol_config
                .s1_rating_effective_delay_seconds,
        )
        .ok_or(StreamPumpError::MathOverflow)?;

    creator_profile.pending_s1_rating_bps = args.rating_bps;
    creator_profile.pending_s1_graduation_target_supply = args.graduation_target_supply;
    creator_profile.pending_rating_effective_at = effective_at;
    creator_profile.pending_rating_report_digest = args.report_digest;
    creator_profile.last_rating_update_at = now;
    creator_profile.updated_at = now;

    emit!(CreatorS1RatingUpdated {
        creator_profile: creator_profile.key(),
        creator: creator_profile.authority,
        previous_rating_bps,
        new_rating_bps: creator_profile.pending_s1_rating_bps,
        previous_graduation_target_supply,
        new_graduation_target_supply: creator_profile.pending_s1_graduation_target_supply,
        report_id: args.report_id,
        report_digest: args.report_digest,
        observed_at: args.observed_at,
        effective_at,
        updated_at: now,
    });

    Ok(())
}
