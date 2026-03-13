// EN: Oracle-authorized creator level upgrade with immutable on-chain receipt.
// ZH: 由预言机权限执行创作者等级升级，并在链上记录不可篡改凭据。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, CreatorStatus, CreatorUpgradeMetric, ProtocolConfig, UpgradeReceipt,
        MIN_PROPOSAL_CREATOR_LEVEL,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpgradeCreatorArgs {
    /// Target level after upgrade. Must be strictly greater than current level.
    pub new_level: u8,
    /// Metric used by oracle to justify the upgrade.
    pub metric_type: CreatorUpgradeMetric,
    /// Metric value observed by oracle.
    pub metric_value: u64,
    /// Unique report id used to prevent replay upgrades.
    pub report_id: [u8; 32],
    /// Digest of off-chain report payload.
    pub report_digest: [u8; 32],
    /// Unix timestamp when metric snapshot was observed.
    pub observed_at: i64,
}

#[derive(Accounts)]
#[instruction(args: UpgradeCreatorArgs)]
pub struct UpgradeCreator<'info> {
    /// Oracle authority signer.
    #[account(mut)]
    pub oracle: Signer<'info>,

    /// Global config used for oracle auth and threshold checks.
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Target creator profile to upgrade.
    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority != Pubkey::default() @ StreamPumpError::CreatorNotRegistered
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// Immutable receipt to guarantee one-time report consumption.
    #[account(
        init,
        payer = oracle,
        seeds = [
            b"upgrade_receipt",
            creator_profile.key().as_ref(),
            args.report_id.as_ref()
        ],
        bump,
        space = 8 + UpgradeReceipt::INIT_SPACE
    )]
    pub upgrade_receipt: Account<'info, UpgradeReceipt>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<UpgradeCreator>, args: UpgradeCreatorArgs) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    require!(args.new_level > 0, StreamPumpError::InvalidCreatorLevel);
    require!(args.metric_value > 0, StreamPumpError::InvalidAmount);
    require!(
        args.report_digest != [0_u8; 32],
        StreamPumpError::InvalidReportDigest
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        args.observed_at > 0 && args.observed_at <= now,
        StreamPumpError::InvalidObservedAt
    );

    let profile = &mut ctx.accounts.creator_profile;
    require!(
        args.new_level > profile.level,
        StreamPumpError::CreatorLevelNotIncreasing
    );

    let required_threshold = match args.metric_type {
        CreatorUpgradeMetric::Followers => ctx.accounts.protocol_config.s2_min_followers,
        CreatorUpgradeMetric::ValidViews => ctx.accounts.protocol_config.s2_min_valid_views,
    };

    if args.new_level >= MIN_PROPOSAL_CREATOR_LEVEL && required_threshold > 0 {
        require!(
            args.metric_value >= required_threshold,
            StreamPumpError::UpgradeConditionNotMet
        );
    }

    let previous_level = profile.level;
    profile.level = args.new_level;
    if profile.level >= MIN_PROPOSAL_CREATOR_LEVEL {
        profile.status = CreatorStatus::S2_Active;
    }
    profile.last_upgrade_at = now;
    profile.updated_at = now;

    let receipt = &mut ctx.accounts.upgrade_receipt;
    receipt.creator_profile = profile.key();
    receipt.upgraded_by = ctx.accounts.oracle.key();
    receipt.previous_level = previous_level;
    receipt.new_level = args.new_level;
    receipt.metric_type = args.metric_type;
    receipt.metric_value = args.metric_value;
    receipt.report_id = args.report_id;
    receipt.report_digest = args.report_digest;
    receipt.observed_at = args.observed_at;
    receipt.upgraded_at = now;
    receipt.bump = ctx.bumps.upgrade_receipt;

    Ok(())
}
