// EN: Lock sponsor USDC into a proposal after traction is observed.
// ZH: 赞助方在观察到提案热度后，将 USDC 锁定至提案金库。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{Proposal, ProposalStatus},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SponsorFundArgs {
    /// USDC amount to lock into the proposal.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct SponsorFund<'info> {
    /// Sponsor paying USDC funding for this proposal.
    #[account(mut)]
    pub sponsor: Signer<'info>,

    /// Proposal to fund. Can only transition from Open -> Funded once.
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Open @ StreamPumpError::ProposalNotOpen
    )]
    pub proposal: Account<'info, Proposal>,

    /// Sponsor source USDC token account.
    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    /// Proposal-owned USDC vault PDA.
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Transfers sponsor USDC into proposal vault and marks proposal as funded.
pub(crate) fn handler(ctx: Context<SponsorFund>, args: SponsorFundArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);

    let proposal = &mut ctx.accounts.proposal;
    let now = Clock::get()?.unix_timestamp;
    require!(now < proposal.deadline, StreamPumpError::ProposalExpired);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                to: ctx.accounts.proposal_usdc_vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        args.amount,
    )?;

    proposal.sponsor_usdc_deposited = checked_add(proposal.sponsor_usdc_deposited, args.amount)?;
    proposal.sponsor = Some(ctx.accounts.sponsor.key());
    proposal.status = ProposalStatus::Funded;

    Ok(())
}
