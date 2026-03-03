// EN: Create a creator-owned proposal with dedicated USDC/SPUMP vault PDAs.
// ZH: 创建由创作者发起的提案，并初始化专用 USDC/SPUMP 金库 PDA。
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, Proposal, ProposalStatus, ProtocolConfig, MIN_PROPOSAL_CREATOR_LEVEL},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateProposalArgs {
    /// Oracle verification target: proposal is successful when actual views >= target views.
    pub target_views: u64,
    /// Unix timestamp after which new endorsements/sponsor funding are disallowed.
    pub deadline: i64,
}

#[derive(Accounts)]
#[instruction(args: CreateProposalArgs)]
pub struct CreateProposal<'info> {
    /// Creator signing the transaction and paying rent for new accounts.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Global protocol configuration containing canonical SPUMP/USDC mint addresses.
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Creator profile PDA. Must belong to `creator` and be level-gated.
    #[account(
        seeds = [b"creator", creator.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority == creator.key() @ StreamPumpError::Unauthorized,
        constraint = creator_profile.authority != Pubkey::default() @ StreamPumpError::CreatorNotRegistered,
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// Proposal state PDA.
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal", creator.key().as_ref(), &args.deadline.to_le_bytes()],
        bump,
        space = 8 + Proposal::INIT_SPACE
    )]
    pub proposal: Account<'info, Proposal>,

    /// Proposal-owned USDC vault PDA.
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = proposal
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    /// Proposal-owned SPUMP vault PDA.
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal_spump_vault", proposal.key().as_ref()],
        bump,
        token::mint = spump_mint,
        token::authority = proposal
    )]
    pub spump_vault: Account<'info, TokenAccount>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Initializes a proposal in `Open` status with zeroed stake/funding trackers and vault bumps.
pub(crate) fn handler(ctx: Context<CreateProposal>, args: CreateProposalArgs) -> Result<()> {
    require!(args.target_views > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.level >= MIN_PROPOSAL_CREATOR_LEVEL,
        StreamPumpError::InsufficientCreatorLevel
    );

    let now = Clock::get()?.unix_timestamp;
    require!(args.deadline > now, StreamPumpError::InvalidDeadline);
    require!(
        args.deadline
            .checked_sub(now)
            .ok_or(StreamPumpError::MathOverflow)?
            <= ctx.accounts.protocol_config.max_proposal_duration_seconds,
        StreamPumpError::InvalidDeadline
    );

    let proposal = &mut ctx.accounts.proposal;
    proposal.creator = ctx.accounts.creator.key();
    proposal.sponsor = None;
    proposal.target_views = args.target_views;
    proposal.deadline = args.deadline;
    proposal.status = ProposalStatus::Open;
    proposal.usdc_vault_bump = ctx.bumps.usdc_vault;
    proposal.spump_vault_bump = ctx.bumps.spump_vault;
    proposal.total_spump_staked = 0;
    proposal.sponsor_usdc_deposited = 0;
    proposal.actual_views = None;
    proposal.settled_at = 0;
    proposal.bump = ctx.bumps.proposal;

    Ok(())
}
