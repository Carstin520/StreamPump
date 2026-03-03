// EN: Endorser pull-claim for SPUMP principal and conditional USDC rewards.
// ZH: 用户按需领取 SPUMP 本金及条件性 USDC 奖励。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{EndorsementPosition, Proposal, ProposalStatus},
    utils::{amount_from_bps, checked_sub},
};

/// Slash percentage for failed endorsements: 5%.
pub const FAILED_SLASH_BPS: u16 = 500;

#[derive(Accounts)]
pub struct ClaimEndorsement<'info> {
    /// Endorser claiming funds.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Proposal being claimed against.
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// User endorsement position.
    #[account(
        mut,
        seeds = [b"endorsement", user.key().as_ref(), proposal.key().as_ref()],
        bump = endorsement_position.bump,
        constraint = endorsement_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = endorsement_position.proposal == proposal.key() @ StreamPumpError::ProposalAccountMismatch
    )]
    pub endorsement_position: Account<'info, EndorsementPosition>,

    /// User SPUMP ATA for principal/slash refunds.
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

    /// User USDC ATA for success rewards.
    #[account(
        mut,
        constraint = user_usdc_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    /// Proposal USDC vault PDA.
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    /// Protocol SPUMP burn/treasury ATA receiving failed slashes.
    #[account(
        mut,
        constraint = protocol_burn_spump_ata.mint == proposal_spump_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub protocol_burn_spump_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Claims user outcome based on proposal state:
/// - Resolved_Success: 100% SPUMP principal + proportional USDC pool share.
/// - Resolved_Fail: 95% SPUMP back, 5% SPUMP slash to protocol burn account.
/// - Cancelled/Voided: 100% SPUMP principal back.
pub(crate) fn handler(ctx: Context<ClaimEndorsement>) -> Result<()> {
    let proposal_status = ctx.accounts.proposal.status;
    let proposal_settled_at = ctx.accounts.proposal.settled_at;

    let position = &mut ctx.accounts.endorsement_position;
    require!(!position.claimed, StreamPumpError::PositionAlreadyClaimed);
    require!(position.staked_amount > 0, StreamPumpError::InvalidAmount);

    if matches!(
        proposal_status,
        ProposalStatus::Resolved_Success | ProposalStatus::Resolved_Fail
    ) {
        require!(proposal_settled_at > 0, StreamPumpError::ProposalNotSettled);
    }

    let deadline_bytes = ctx.accounts.proposal.deadline.to_le_bytes();
    let bump_bytes = [ctx.accounts.proposal.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"proposal",
        ctx.accounts.proposal.creator.as_ref(),
        deadline_bytes.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    let staked_amount = position.staked_amount;

    match proposal_status {
        ProposalStatus::Resolved_Success => {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.proposal_spump_vault.to_account_info(),
                        to: ctx.accounts.user_spump_ata.to_account_info(),
                        authority: ctx.accounts.proposal.to_account_info(),
                    },
                    signer,
                ),
                staked_amount,
            )?;

            let usdc_reward = if ctx.accounts.proposal.total_spump_staked == 0
                || ctx.accounts.proposal.sponsor_usdc_deposited == 0
            {
                0
            } else {
                let numerator = (staked_amount as u128)
                    .checked_mul(ctx.accounts.proposal.sponsor_usdc_deposited as u128)
                    .ok_or(StreamPumpError::MathOverflow)?;
                let quotient = numerator
                    .checked_div(ctx.accounts.proposal.total_spump_staked as u128)
                    .ok_or(StreamPumpError::MathOverflow)?;
                u64::try_from(quotient).map_err(|_| error!(StreamPumpError::MathOverflow))?
            };

            if usdc_reward > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                            to: ctx.accounts.user_usdc_ata.to_account_info(),
                            authority: ctx.accounts.proposal.to_account_info(),
                        },
                        signer,
                    ),
                    usdc_reward,
                )?;
            }
        }
        ProposalStatus::Resolved_Fail => {
            let slash_amount = amount_from_bps(staked_amount, FAILED_SLASH_BPS)?;
            let refund_amount = checked_sub(staked_amount, slash_amount)?;

            if refund_amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.proposal_spump_vault.to_account_info(),
                            to: ctx.accounts.user_spump_ata.to_account_info(),
                            authority: ctx.accounts.proposal.to_account_info(),
                        },
                        signer,
                    ),
                    refund_amount,
                )?;
            }

            if slash_amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.proposal_spump_vault.to_account_info(),
                            to: ctx.accounts.protocol_burn_spump_ata.to_account_info(),
                            authority: ctx.accounts.proposal.to_account_info(),
                        },
                        signer,
                    ),
                    slash_amount,
                )?;
            }
        }
        ProposalStatus::Cancelled | ProposalStatus::Voided => {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.proposal_spump_vault.to_account_info(),
                        to: ctx.accounts.user_spump_ata.to_account_info(),
                        authority: ctx.accounts.proposal.to_account_info(),
                    },
                    signer,
                ),
                staked_amount,
            )?;
        }
        _ => return err!(StreamPumpError::ProposalNotClaimable),
    }

    position.claimed = true;
    Ok(())
}
