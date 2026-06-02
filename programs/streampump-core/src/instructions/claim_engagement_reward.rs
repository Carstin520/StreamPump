// EN: Oracle-authorized task reward for off-chain engagement actions.
// ZH: 由预言机授权的任务奖励，用于承接链下互动行为。
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{ProtocolConfig, UserMissionType, UserProfile, UserRewardReceipt},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ClaimEngagementRewardArgs {
    pub mission_type: UserMissionType,
    pub reward_amount: u64,
    pub xp_gain: u64,
    pub new_level: Option<u8>,
    pub report_id: [u8; 32],
    pub report_digest: [u8; 32],
    pub observed_at: i64,
}

#[derive(Accounts)]
#[instruction(args: ClaimEngagementRewardArgs)]
pub struct ClaimEngagementReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub oracle: Signer<'info>,

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
        init,
        payer = oracle,
        seeds = [
            b"user_reward_receipt",
            user_profile.key().as_ref(),
            args.report_id.as_ref()
        ],
        bump,
        space = 8 + UserRewardReceipt::INIT_SPACE
    )]
    pub reward_receipt: Account<'info, UserRewardReceipt>,

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

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<ClaimEngagementReward>,
    args: ClaimEngagementRewardArgs,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
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

    let user_profile = &mut ctx.accounts.user_profile;
    let previous_level = user_profile.level;
    let mut resulting_level = previous_level;

    if let Some(new_level) = args.new_level {
        require!(
            new_level > previous_level,
            StreamPumpError::UserLevelNotIncreasing
        );
        resulting_level = new_level;
        user_profile.level = new_level;
    }

    require!(
        args.reward_amount > 0 || args.xp_gain > 0 || resulting_level != previous_level,
        StreamPumpError::InvalidAmount
    );

    if args.reward_amount > 0 {
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
            args.reward_amount,
        )?;

        user_profile.total_spump_earned =
            checked_add(user_profile.total_spump_earned, args.reward_amount)?;
    }

    user_profile.xp = checked_add(user_profile.xp, args.xp_gain)?;
    user_profile.activity_score = checked_add(user_profile.activity_score, args.xp_gain)?;
    user_profile.last_reward_at = now;
    user_profile.updated_at = now;

    let reward_receipt = &mut ctx.accounts.reward_receipt;
    reward_receipt.user_profile = user_profile.key();
    reward_receipt.user = ctx.accounts.user.key();
    reward_receipt.mission_type = args.mission_type;
    reward_receipt.reward_amount = args.reward_amount;
    reward_receipt.xp_gain = args.xp_gain;
    reward_receipt.previous_level = previous_level;
    reward_receipt.new_level = user_profile.level;
    reward_receipt.report_id = args.report_id;
    reward_receipt.report_digest = args.report_digest;
    reward_receipt.observed_at = args.observed_at;
    reward_receipt.claimed_at = now;
    reward_receipt.bump = ctx.bumps.reward_receipt;

    Ok(())
}
