// EN: Let the sponsor deposit USDC into an open campaign's escrow vault before the deadline.
// ZH: 允许赞助商在截止时间前，将 USDC 充值到处于开放状态的活动托管金库中。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CampaignEscrow, CampaignStatus},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SponsorDepositArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct SponsorDeposit<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"campaign", campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        constraint = campaign.sponsor == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = campaign.status == CampaignStatus::Open @ StreamPumpError::CampaignClosed
    )]
    pub campaign: Account<'info, CampaignEscrow>,
    #[account(
        mut,
        seeds = [b"campaign_vault", campaign.key().as_ref()],
        bump,
        constraint = campaign_vault.mint == campaign.usdc_mint @ StreamPumpError::InvalidMint,
        constraint = campaign_vault.key() == campaign.usdc_vault @ StreamPumpError::CampaignNotReady
    )]
    pub campaign_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == campaign.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<SponsorDeposit>, args: SponsorDepositArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);

    let now = Clock::get()?.unix_timestamp;
    require!(
        now <= ctx.accounts.campaign.deadline_ts,
        StreamPumpError::CampaignClosed
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                to: ctx.accounts.campaign_vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        args.amount,
    )?;

    let campaign = &mut ctx.accounts.campaign;
    campaign.total_deposited = checked_add(campaign.total_deposited, args.amount)?;

    Ok(())
}
