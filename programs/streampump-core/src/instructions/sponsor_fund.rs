// ────────────────────────────────────────────────────────────────────────────────
// sponsor_fund.rs
// EN: Sponsor deposits Track 1 + Track 2 + Track 3 USDC budget into proposal vault.
//     A single SPL transfer moves the combined amount into the proposal USDC vault.
//     The instruction records each track's budget separately on the proposal PDA
//     and transitions the proposal from `Open` → `Funded`.
//     Only one sponsor per proposal (first-come, first-served).
//
// ZH: Sponsor 将 Track1 + Track2 + Track3 USDC 预算注入提案金库。
//     通过一次 SPL transfer 将合计金额转入提案 USDC 金库。
//     指令在提案 PDA 上分别记录各 Track 的预算，并将提案状态从 `Open` 转为 `Funded`。
//     每个提案只有一个 Sponsor（先到先得）。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{Proposal, ProposalStatus},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SponsorFundArgs {
    /// EN: Track 1 budget (fixed creator base pay).
    /// ZH: Track1 预算（固定基础保底）。
    pub track1_amount: u64,
    /// EN: Track 2 budget (performance + fan pool).
    /// ZH: Track2 预算（效果池 + 粉丝池）。
    pub track2_amount: u64,
    /// EN: Track 3 budget (CPS sales long-tail).
    /// ZH: Track3 预算（CPS 长尾池）。
    pub track3_amount: u64,
}

#[derive(Accounts)]
pub struct SponsorFund<'info> {
    /// EN: Sponsor paying USDC funding for this proposal.
    /// ZH: 为此提案提供 USDC 资金的 Sponsor。
    #[account(mut)]
    pub sponsor: Signer<'info>,

    /// EN: Proposal to fund. Can only transition from Open → Funded once.
    /// ZH: 要注资的提案，只允许从 Open → Funded 转换一次。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Open @ StreamPumpError::ProposalNotOpen
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: Sponsor source USDC token account.
    /// ZH: Sponsor 的 USDC 来源代币账户。
    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    /// EN: Proposal-owned USDC vault PDA.
    /// ZH: 提案所有的 USDC 金库 PDA。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// EN: Transfers total USDC (track1 + track2 + track3) into proposal vault and records track budgets.
/// ZH: 将 USDC 总额（Track1 + Track2 + Track3）转入提案金库并记录预算。
pub(crate) fn handler(ctx: Context<SponsorFund>, args: SponsorFundArgs) -> Result<()> {
    // EN: At least one track must have a non-zero budget.
    // ZH: 至少一个 Track 必须有非零预算。
    let total_amount = checked_add(
        checked_add(args.track1_amount, args.track2_amount)?,
        args.track3_amount,
    )?;
    require!(total_amount > 0, StreamPumpError::InvalidAmount);

    let proposal = &mut ctx.accounts.proposal;
    let now = Clock::get()?.unix_timestamp;
    require!(now < proposal.deadline, StreamPumpError::ProposalExpired);
    require!(
        args.track1_amount == proposal.track1_base_usdc,
        StreamPumpError::InvalidAmount
    );

    // EN: Single transfer for the combined amount — reduces TX size and gas.
    // ZH: 合计金额一次转账——减少交易大小和费用。
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                to: ctx.accounts.proposal_usdc_vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        total_amount,
    )?;

    // EN: Record individual track budgets on the proposal PDA.
    // ZH: 在提案 PDA 上分别记录各 Track 预算。
    proposal.track2_usdc_deposited =
        checked_add(proposal.track2_usdc_deposited, args.track2_amount)?;
    proposal.track3_usdc_deposited =
        checked_add(proposal.track3_usdc_deposited, args.track3_amount)?;
    proposal.sponsor = Some(ctx.accounts.sponsor.key());
    proposal.status = ProposalStatus::Funded;

    Ok(())
}
