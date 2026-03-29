// EN: Register or update a protocol user profile used for SPUMP emissions and role modeling.
// ZH: 注册或更新协议用户档案，用于 SPUMP 发放与角色建模。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    events::UserProfileRegistered,
    state::{ProtocolConfig, UserProfile, DEFAULT_USER_LEVEL},
    utils::validate_role_flags,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterUserArgs {
    pub role_flags: u16,
}

#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"user_profile", authority.key().as_ref()],
        bump,
        space = 8 + UserProfile::INIT_SPACE
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<RegisterUser>, args: RegisterUserArgs) -> Result<()> {
    validate_role_flags(args.role_flags)?;

    let now = Clock::get()?.unix_timestamp;
    let user_profile = &mut ctx.accounts.user_profile;
    let created = user_profile.authority == Pubkey::default();
    if created {
        user_profile.authority = ctx.accounts.authority.key();
        user_profile.level = DEFAULT_USER_LEVEL;
        user_profile.role_flags = args.role_flags;
        user_profile.xp = 0;
        user_profile.last_daily_claim_at = 0;
        user_profile.daily_claim_streak = 0;
        user_profile.total_spump_earned = 0;
        user_profile.last_reward_at = 0;
        user_profile.created_at = now;
        user_profile.bump = ctx.bumps.user_profile;
    } else {
        require_keys_eq!(
            user_profile.authority,
            ctx.accounts.authority.key(),
            StreamPumpError::Unauthorized
        );
        user_profile.role_flags |= args.role_flags;
    }

    user_profile.updated_at = now;

    emit!(UserProfileRegistered {
        authority: ctx.accounts.authority.key(),
        user_profile: user_profile.key(),
        role_flags: user_profile.role_flags,
        level: user_profile.level,
        created,
    });

    Ok(())
}
