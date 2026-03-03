// EN: Creator can cancel an unfunded/open proposal.
// ZH: 创作者可取消尚未获赞助资金的开放提案。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{Proposal, ProposalStatus},
};

#[derive(Accounts)]
pub struct CancelProposal<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.creator == creator.key() @ StreamPumpError::Unauthorized,
        constraint = proposal.status == ProposalStatus::Open @ StreamPumpError::ProposalNotOpen
    )]
    pub proposal: Account<'info, Proposal>,
}

/// Marks proposal as cancelled. Endorsers can later claim full SPUMP principal back.
pub(crate) fn handler(ctx: Context<CancelProposal>) -> Result<()> {
    ctx.accounts.proposal.status = ProposalStatus::Cancelled;
    Ok(())
}
