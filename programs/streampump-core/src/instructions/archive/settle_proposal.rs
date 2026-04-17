// EN: Perform macro settlement for a resolved proposal before individual claims.
// ZH: 在个人领取前完成提案的全局资金结算。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, Proposal, ProposalStatus},
    utils::{amount_from_bps, checked_sub},
};

/// Creator payout ratio on successful proposals.
pub const CREATOR_SUCCESS_PAYOUT_BPS: u16 = 8_000;

#[derive(Accounts)]
pub struct SettleProposal<'info> {
    /// Any signer can crank settlement.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Resolved proposal pending macro settlement.
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// Proposal USDC vault PDA.
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    /// Creator profile to validate creator payout destination.
    #[account(
        constraint = creator_profile.authority == proposal.creator @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// Creator USDC ATA receiving success payout.
    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.owner == proposal.creator @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Account<'info, TokenAccount>,

    /// Sponsor USDC ATA receiving failure refund.
    #[account(
        mut,
        constraint = sponsor_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Executes macro payout routing:
/// - Success: creator receives configured cut; remainder stays for endorser USDC claims.
/// - Failure: sponsor USDC is refunded from proposal vault.
pub(crate) fn handler(ctx: Context<SettleProposal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let proposal = &mut ctx.accounts.proposal;

    require!(proposal.settled_at == 0, StreamPumpError::ProposalAlreadySettled);

    let deadline_bytes = proposal.deadline.to_le_bytes();
    let bump_bytes = [proposal.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"proposal",
        proposal.creator.as_ref(),
        deadline_bytes.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    match proposal.status {
        ProposalStatus::Resolved_Success => {
            let creator_payout = amount_from_bps(
                proposal.sponsor_usdc_deposited,
                CREATOR_SUCCESS_PAYOUT_BPS,
            )?;
            let endorser_reward_pool = checked_sub(proposal.sponsor_usdc_deposited, creator_payout)?;

            if creator_payout > 0 {
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
                    creator_payout,
                )?;
            }

            // Reuse this tracker as the fixed claim pool for endorser USDC pull-claims.
            proposal.sponsor_usdc_deposited = endorser_reward_pool;
        }
        ProposalStatus::Resolved_Fail | ProposalStatus::Voided => {
            let refund_amount = proposal.sponsor_usdc_deposited;
            if refund_amount > 0 {
                let sponsor = proposal
                    .sponsor
                    .ok_or(error!(StreamPumpError::SponsorNotSet))?;
                require_keys_eq!(
                    sponsor,
                    ctx.accounts.sponsor_usdc_ata.owner,
                    StreamPumpError::Unauthorized
                );

                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                            to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                            authority: proposal.to_account_info(),
                        },
                        signer,
                    ),
                    refund_amount,
                )?;
            }
            proposal.sponsor_usdc_deposited = 0;
        }
        _ => return err!(StreamPumpError::ProposalNotResolved),
    }

    proposal.settled_at = now;
    Ok(())
}
