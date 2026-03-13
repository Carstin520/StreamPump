// ────────────────────────────────────────────────────────────────────────────────
// emergency_void.rs
// EN: Admin emergency action to void a proposal (fraud/TOS violation flow).
//     - Forces the proposal into `Voided` status.
//     - If a sponsor has funded the proposal, refunds the ENTIRE remaining USDC
//       vault balance back to the sponsor in a single transfer.
//     - Zeroes Track2/Track3 variable-budget fields and marks Track1 as claimed-disabled.
//     - If no sponsor exists, asserts vault is already empty.
//     After voiding, endorsers can claim 100% SPUMP principal back via
//     claim_endorsement (Cancel/Void path).
//
// ZH: 管理员紧急作废提案（欺诈/违规场景）。
//     - 强制将提案置为 `Voided` 状态。
//     - 如果有 Sponsor 注资，将金库内全部剩余 USDC 一次性退还给 Sponsor。
//     - 清零 Track2/Track3 预算字段，并禁用 Track1 保底领取。
//     - 如果没有 Sponsor，则断言金库余额为零。
//     作废后，Endorser 可通过 claim_endorsement 的取消/作废路径领回 100% SPUMP 本金。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{Proposal, ProposalStatus, ProtocolConfig},
};

#[derive(Accounts)]
pub struct EmergencyVoid<'info> {
    /// EN: Admin signer — must match `protocol_config.admin`.
    /// ZH: 管理员签名者——必须匹配 `protocol_config.admin`。
    pub admin: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: Proposal-owned USDC vault PDA. Emergency void refunds this balance to sponsor when set.
    /// ZH: 提案所有的 USDC 金库 PDA。紧急作废时将余额退还给 Sponsor。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    /// EN: Sponsor USDC account to receive emergency refund.
    /// ZH: 接收紧急退款的 Sponsor USDC 账户。
    #[account(
        mut,
        constraint = sponsor_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// EN: Forces proposal into `Voided` state and refunds any remaining USDC in vault back to sponsor.
/// ZH: 强制将提案置为 `Voided` 状态并将金库中所有剩余 USDC 退还给 Sponsor。
pub(crate) fn handler(ctx: Context<EmergencyVoid>) -> Result<()> {
    // EN: Only the protocol admin can void a proposal.
    // ZH: 只有协议管理员可以作废提案。
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.protocol_config.admin,
        StreamPumpError::Unauthorized
    );

    let proposal_creator = ctx.accounts.proposal.creator;
    let proposal_deadline_bytes = ctx.accounts.proposal.deadline.to_le_bytes();
    let proposal_bump_bytes = [ctx.accounts.proposal.bump];
    let sponsor = ctx.accounts.proposal.sponsor;

    if let Some(sponsor_key) = sponsor {
        // EN: Verify the sponsor_usdc_ata belongs to the correct sponsor.
        // ZH: 校验 sponsor_usdc_ata 是否属于正确的 Sponsor。
        require_keys_eq!(
            ctx.accounts.sponsor_usdc_ata.owner,
            sponsor_key,
            StreamPumpError::Unauthorized
        );

        // EN: Refund the entire vault balance (unclaimed Track1 base + Track2 pool + Track3 remainder).
        // ZH: 退还金库全部余额（未领取 Track1 保底 + Track2 池 + Track3 剩余）。
        let refund_amount = ctx.accounts.proposal_usdc_vault.amount;
        if refund_amount > 0 {
            let signer_seeds: [&[u8]; 4] = [
                b"proposal",
                proposal_creator.as_ref(),
                proposal_deadline_bytes.as_ref(),
                proposal_bump_bytes.as_ref(),
            ];
            let signer: &[&[&[u8]]] = &[&signer_seeds];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                        to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                        authority: ctx.accounts.proposal.to_account_info(),
                    },
                    signer,
                ),
                refund_amount,
            )?;
        }
    } else {
        // EN: No sponsor — vault should already be empty.
        // ZH: 没有 Sponsor——金库应该已为空。
        require!(
            ctx.accounts.proposal_usdc_vault.amount == 0,
            StreamPumpError::SponsorNotSet
        );
    }

    // EN: Zero out variable budgets, disable Track1 claim, and set Voided status.
    // ZH: 清零可变预算，禁用 Track1 领取，并将状态设为 Voided。
    ctx.accounts.proposal.track1_claimed = true;
    ctx.accounts.proposal.track2_usdc_deposited = 0;
    ctx.accounts.proposal.track3_usdc_deposited = 0;
    ctx.accounts.proposal.status = ProposalStatus::Voided;
    Ok(())
}
