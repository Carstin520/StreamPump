// EN: Stake SPUMP on a proposal as a single-sided endorsement position.
// ZH: 用户以单边方式质押 SPUMP 支持提案。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{EndorsementPosition, Proposal, ProposalStatus},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EndorseProposalArgs {
    /// SPUMP amount to stake into the proposal vault.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct EndorseProposal<'info> {
    /// User staking SPUMP as an endorser.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Proposal PDA. Must still be active for endorsements.
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// Per-user endorsement position on a proposal.
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"endorsement", user.key().as_ref(), proposal.key().as_ref()],
        bump,
        space = 8 + EndorsementPosition::INIT_SPACE
    )]
    pub endorsement_position: Account<'info, EndorsementPosition>,

    /// User source token account holding SPUMP.
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == proposal_spump_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: Account<'info, TokenAccount>,

    /// Proposal SPUMP vault PDA.
    #[account(
        mut,
        seeds = [b"proposal_spump_vault", proposal.key().as_ref()],
        bump = proposal.spump_vault_bump,
        token::authority = proposal
    )]
    pub proposal_spump_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Transfers SPUMP to the proposal vault and updates both proposal and user position trackers.
pub(crate) fn handler(ctx: Context<EndorseProposal>, args: EndorseProposalArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);

    let proposal_key = ctx.accounts.proposal.key();
    let now = Clock::get()?.unix_timestamp;
    {
        let proposal = &ctx.accounts.proposal;
        require!(
            matches!(proposal.status, ProposalStatus::Open | ProposalStatus::Funded),
            StreamPumpError::ProposalNotActive
        );
        require!(now < proposal.deadline, StreamPumpError::ProposalExpired);
    }

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_spump_ata.to_account_info(),
                to: ctx.accounts.proposal_spump_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        args.amount,
    )?;

    let position = &mut ctx.accounts.endorsement_position;
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.proposal = proposal_key;
        position.staked_amount = 0;
        position.claimed = false;
        position.bump = ctx.bumps.endorsement_position;
    }

    require_keys_eq!(
        position.user,
        ctx.accounts.user.key(),
        StreamPumpError::Unauthorized
    );
    require_keys_eq!(
        position.proposal,
        proposal_key,
        StreamPumpError::ProposalAccountMismatch
    );

    position.staked_amount = checked_add(position.staked_amount, args.amount)?;
    let proposal = &mut ctx.accounts.proposal;
    proposal.total_spump_staked = checked_add(proposal.total_spump_staked, args.amount)?;

    Ok(())
}
