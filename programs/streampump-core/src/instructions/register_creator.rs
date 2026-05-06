// EN: Register or update a creator profile, including handle and USDC payout account.
// ZH: 注册或更新创作者档案，包括展示昵称和 USDC 收款账户。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, DEFAULT_CREATOR_LEVEL,
        DEFAULT_S1_RATING_BPS, MAX_HANDLE_LEN,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterCreatorArgs {
    //创作者昵称
    pub handle: String,
    //创作者 USDC 收款账户
    pub payout_usdc_ata: Pubkey,
}

#[derive(Accounts)]
pub struct RegisterCreator<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"creator", authority.key().as_ref()],
        bump,
        space = 8 + CreatorProfile::INIT_SPACE
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<RegisterCreator>, args: RegisterCreatorArgs) -> Result<()> {
    require!(
        !args.handle.is_empty() && args.handle.len() <= MAX_HANDLE_LEN,
        StreamPumpError::InvalidHandle
    );

    let profile = &mut ctx.accounts.creator_profile;
    if profile.authority == Pubkey::default() {
        profile.authority = ctx.accounts.authority.key();
        profile.level = DEFAULT_CREATOR_LEVEL;
        profile.status = CreatorStatus::S1_Active;
        profile.s1_supply = 0;
        profile.s1_early_cohort_supply = 0;
        profile.s1_rating_bps = DEFAULT_S1_RATING_BPS;
        profile.s1_graduation_target_supply = ctx
            .accounts
            .protocol_config
            .default_s1_graduation_target_supply;
        profile.pending_s1_rating_bps = 0;
        profile.pending_s1_graduation_target_supply = 0;
        profile.pending_rating_effective_at = 0;
        profile.pending_rating_report_digest = [0_u8; 32];
        profile.last_rating_update_at = 0;
        profile.last_rating_report_digest = [0_u8; 32];
        profile.last_upgrade_at = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.creator_profile;
    }

    require_keys_eq!(
        profile.authority,
        ctx.accounts.authority.key(),
        StreamPumpError::Unauthorized
    );

    profile.handle = args.handle;
    profile.payout_usdc_ata = args.payout_usdc_ata;
    profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
