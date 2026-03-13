// EN: Oracle-authorized settlement for S2 Track 1 fixed base pay.
//     Creator can claim the guaranteed base USDC once oracle verifies content
//     publication. This instruction is one-time (`track1_claimed == false`).
//
// ZH: S2 Track1 固定保底的预言机授权结算。
//     预言机确认内容已发布后，Creator 可领取固定保底 USDC，且只能领取一次
//     （`track1_claimed == false`）。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, Proposal, ProposalStatus, ProtocolConfig},
};

#[derive(Accounts)]
pub struct SettleTrack1Base<'info> {
    /// EN: Oracle signer. Must match protocol-configured oracle authority.
    /// ZH: 预言机签名者，必须匹配协议配置中的 oracle_authority。
    pub oracle: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: Proposal account. Track1 base claim is valid on funded/resolved proposals,
    ///     but not on open/cancelled/voided states.
    /// ZH: 提案账户。Track1 保底可在 funded/resolved 状态领取，
    ///     但 open/cancelled/voided 不允许。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.status != ProposalStatus::Open @ StreamPumpError::ProposalNotFunded,
        constraint = proposal.status != ProposalStatus::Cancelled @ StreamPumpError::ProposalNotActive,
        constraint = proposal.status != ProposalStatus::Voided @ StreamPumpError::ProposalNotActive
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: Proposal-owned USDC vault.
    /// ZH: 提案拥有的 USDC 金库。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    /// EN: Creator profile used to verify payout destination.
    /// ZH: Creator 档案，用于校验收款地址。
    #[account(
        constraint = creator_profile.authority == proposal.creator @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// EN: Creator USDC ATA receiving fixed base pay.
    /// ZH: 接收固定保底的 Creator USDC ATA。
    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.owner == proposal.creator @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<SettleTrack1Base>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let proposal = &mut ctx.accounts.proposal;
    require!(
        !proposal.track1_claimed,
        StreamPumpError::ProposalAlreadySettled
    );

    let deadline_bytes = proposal.deadline.to_le_bytes();
    let proposal_bump_bytes = [proposal.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"proposal",
        proposal.creator.as_ref(),
        deadline_bytes.as_ref(),
        proposal_bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    if proposal.track1_base_usdc > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                    to: ctx.accounts.creator_usdc_ata.to_account_info(),
                    authority: proposal.to_account_info(),
                },
                signer,
            ),
            proposal.track1_base_usdc,
        )?;
    }

    proposal.track1_claimed = true;
    Ok(())
}
