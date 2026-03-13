// EN: Oracle-driven delayed settlement for S2 Track 3 (CPS Sales pool).
//     Track 3 can only settle after return-window delay:
//     `deadline + track3_delay_days * 86400`.
//     Oracle provides the final approved CPS payout.
//     - Creator receives approved payout.
//     - Sponsor receives unused Track 3 budget refund.
//
// ZH: S2 Track3（CPS 销售池）预言机延迟结算。
//     Track3 必须在退换货窗口后结算：
//     `deadline + track3_delay_days * 86400`。
//     预言机输入最终批准 CPS 佣金：
//     - Creator 收到批准金额。
//     - Sponsor 收到未使用预算退款。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, Proposal, ProposalStatus, ProtocolConfig},
    utils::checked_sub,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SettleTrack3CpsArgs {
    /// EN: Final approved CPS payout after return-window reconciliation.
    /// ZH: 退换货窗口对账后的最终批准 CPS 佣金。
    pub approved_cps_payout: u64,
}

#[derive(Accounts)]
pub struct SettleTrack3Cps<'info> {
    /// EN: Oracle authority signer — must match protocol config.
    /// ZH: 预言机授权签名者——必须匹配协议配置。
    pub oracle: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: Proposal account; must be funded/resolved and not cancelled/voided.
    /// ZH: 提案账户；必须是 funded/resolved，且不能是 cancelled/voided。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.status != ProposalStatus::Open @ StreamPumpError::ProposalNotFunded,
        constraint = proposal.status != ProposalStatus::Cancelled @ StreamPumpError::ProposalNotActive,
        constraint = proposal.status != ProposalStatus::Voided @ StreamPumpError::ProposalNotActive
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: Proposal USDC vault PDA.
    /// ZH: 提案 USDC 金库 PDA。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    /// EN: Creator profile used to validate payout destination.
    /// ZH: Creator 档案，用于校验收款地址。
    #[account(
        constraint = creator_profile.authority == proposal.creator @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// EN: Creator USDC ATA receiving approved CPS payout.
    /// ZH: 接收 CPS 佣金的 Creator USDC ATA。
    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.owner == proposal.creator @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Account<'info, TokenAccount>,

    /// EN: Sponsor USDC ATA receiving unused budget refund.
    /// ZH: 接收未使用预算退款的 Sponsor USDC ATA。
    #[account(
        mut,
        constraint = sponsor_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<SettleTrack3Cps>, args: SettleTrack3CpsArgs) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let now = Clock::get()?.unix_timestamp;
    let proposal = &mut ctx.accounts.proposal;

    require!(
        proposal.track3_settled_at == 0,
        StreamPumpError::ProposalAlreadySettled
    );

    let delay_seconds = i64::from(proposal.track3_delay_days)
        .checked_mul(86_400)
        .ok_or(StreamPumpError::MathOverflow)?;
    let earliest_settle = proposal
        .deadline
        .checked_add(delay_seconds)
        .ok_or(StreamPumpError::MathOverflow)?;
    require!(now >= earliest_settle, StreamPumpError::ProposalNotExpired);

    require!(
        args.approved_cps_payout <= proposal.track3_usdc_deposited,
        StreamPumpError::InvalidAmount
    );

    let sponsor = proposal
        .sponsor
        .ok_or(error!(StreamPumpError::SponsorNotSet))?;
    require_keys_eq!(
        sponsor,
        ctx.accounts.sponsor_usdc_ata.owner,
        StreamPumpError::Unauthorized
    );

    let refund_amount = checked_sub(proposal.track3_usdc_deposited, args.approved_cps_payout)?;

    let deadline_bytes = proposal.deadline.to_le_bytes();
    let proposal_bump_bytes = [proposal.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"proposal",
        proposal.creator.as_ref(),
        deadline_bytes.as_ref(),
        proposal_bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    if args.approved_cps_payout > 0 {
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
            args.approved_cps_payout,
        )?;
    }

    if refund_amount > 0 {
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

    proposal.track3_cps_payout = Some(args.approved_cps_payout);
    proposal.track3_settled_at = now;

    Ok(())
}
