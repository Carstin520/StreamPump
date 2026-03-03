// EN: Admin emergency action to void a proposal (fraud/TOS violation flow).
// ZH: 管理员紧急作废提案（欺诈/违规场景）。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{Proposal, ProposalStatus, ProtocolConfig},
};

#[derive(Accounts)]
pub struct EmergencyVoid<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
}

/// Forces proposal into `Voided` state. Sponsor/user refunds can be processed via later claim/refund flows.
pub(crate) fn handler(ctx: Context<EmergencyVoid>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.protocol_config.admin,
        StreamPumpError::Unauthorized
    );

    ctx.accounts.proposal.status = ProposalStatus::Voided;
    Ok(())
}
