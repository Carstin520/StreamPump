// EN: Self-claim daily SPUMP allowance based on user level.
// ZH: 用户根据等级，自助领取每日固定 SPUMP 发放。
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{ProtocolConfig, UserProfile},
    utils::{checked_add, daily_spump_amount_for_level},
};

#[derive(Accounts)]
pub struct ClaimDailySpump<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.authority == user.key() @ StreamPumpError::Unauthorized
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<ClaimDailySpump>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let current_day = now.div_euclid(86_400);

    let user_profile = &mut ctx.accounts.user_profile;
    if user_profile.last_daily_claim_at > 0 {
        let last_day = user_profile.last_daily_claim_at.div_euclid(86_400);
        require!(
            current_day > last_day,
            StreamPumpError::DailyRewardAlreadyClaimed
        );

        if current_day == last_day + 1 {
            user_profile.daily_claim_streak = user_profile
                .daily_claim_streak
                .checked_add(1)
                .ok_or(StreamPumpError::MathOverflow)?;
        } else {
            user_profile.daily_claim_streak = 1;
        }
    } else {
        user_profile.daily_claim_streak = 1;
    }

    let reward_amount = daily_spump_amount_for_level(user_profile.level)?;

    let bump_bytes = [ctx.accounts.protocol_config.bump];
    let signer_seeds: [&[u8]; 2] = [b"protocol_config", bump_bytes.as_ref()];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    token_interface::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.spump_token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.spump_mint.to_account_info(),
                to: ctx.accounts.user_spump_ata.to_account_info(),
                authority: ctx.accounts.protocol_config.to_account_info(),
            },
            signer,
        ),
        reward_amount,
    )?;

    user_profile.last_daily_claim_at = now;
    user_profile.last_reward_at = now;
    user_profile.total_spump_earned =
        checked_add(user_profile.total_spump_earned, reward_amount)?;
    user_profile.updated_at = now;

    Ok(())
}
