// EN: Oracle reports finalized view count and resolves proposal outcome.
// ZH: 预言机上报最终播放量并裁决提案成功/失败。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{Proposal, ProposalStatus, ProtocolConfig},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitOracleReportArgs {
    /// Final validated view count for this proposal.
    pub actual_views: u64,
}

#[derive(Accounts)]
pub struct SubmitOracleReport<'info> {
    /// Oracle authority signer.
    pub oracle: Signer<'info>,

    /// Global protocol config used to verify oracle authority.
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Proposal to resolve after deadline.
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Funded @ StreamPumpError::ProposalNotFunded
    )]
    pub proposal: Account<'info, Proposal>,
}

/// Records oracle result after deadline and transitions proposal to success/failure resolution state.
pub(crate) fn handler(ctx: Context<SubmitOracleReport>, args: SubmitOracleReportArgs) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let now = Clock::get()?.unix_timestamp;
    let proposal = &mut ctx.accounts.proposal;
    require!(now >= proposal.deadline, StreamPumpError::ProposalNotExpired);

    proposal.actual_views = Some(args.actual_views);
    proposal.status = if args.actual_views >= proposal.target_views {
        ProposalStatus::Resolved_Success
    } else {
        ProposalStatus::Resolved_Fail
    };

    Ok(())
}
