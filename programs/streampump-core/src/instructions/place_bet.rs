// EN: Let users stake SPUMP on the YES/NO outcome of a campaign's traffic market.
// ZH: 允许用户在活动对应的流量预测市场中，用 SPUMP 押注“达标/不达标”结果。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{BetPosition, CampaignEscrow, CampaignStatus, TrafficMarket},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum BetSide {
    Yes = 0,
    No = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlaceBetArgs {
    pub amount: u64,
    pub side: BetSide,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"campaign", campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Open @ StreamPumpError::CampaignClosed
    )]
    pub campaign: Account<'info, CampaignEscrow>,
    #[account(
        mut,
        seeds = [b"market", campaign.key().as_ref()],
        bump = market.bump,
        constraint = market.campaign == campaign.key() @ StreamPumpError::CampaignNotReady
    )]
    pub market: Account<'info, TrafficMarket>,
    #[account(
        mut,
        seeds = [b"market_spump_vault", market.key().as_ref()],
        bump,
        constraint = market_spump_vault.key() == market.spump_stake_vault @ StreamPumpError::CampaignNotReady,
        constraint = market_spump_vault.mint == market.spump_mint @ StreamPumpError::InvalidMint
    )]
    pub market_spump_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == market.spump_mint @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: Account<'info, TokenAccount>,
    #[account(address = market.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"bet_position", market.key().as_ref(), user.key().as_ref()],
        bump,
        space = 8 + BetPosition::INIT_SPACE
    )]
    pub bet_position: Account<'info, BetPosition>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<PlaceBet>, args: PlaceBetArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);

    let now = Clock::get()?.unix_timestamp;
    require!(
        now <= ctx.accounts.market.close_ts && now <= ctx.accounts.campaign.deadline_ts,
        StreamPumpError::MarketClosed
    );
    require!(
        !ctx.accounts.market.resolved,
        StreamPumpError::MarketResolved
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_spump_ata.to_account_info(),
                to: ctx.accounts.market_spump_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        args.amount,
    )?;

    let position = &mut ctx.accounts.bet_position;
    if position.user == Pubkey::default() {
        position.market = ctx.accounts.market.key();
        position.user = ctx.accounts.user.key();
        position.yes_stake = 0;
        position.no_stake = 0;
        position.claimed = false;
        position.bump = ctx.bumps.bet_position;
    }

    require_keys_eq!(
        position.market,
        ctx.accounts.market.key(),
        StreamPumpError::CampaignNotReady
    );
    require_keys_eq!(
        position.user,
        ctx.accounts.user.key(),
        StreamPumpError::Unauthorized
    );

    let market = &mut ctx.accounts.market;
    match args.side {
        BetSide::Yes => {
            position.yes_stake = checked_add(position.yes_stake, args.amount)?;
            market.yes_total_stake = checked_add(market.yes_total_stake, args.amount)?;
        }
        BetSide::No => {
            position.no_stake = checked_add(position.no_stake, args.amount)?;
            market.no_total_stake = checked_add(market.no_total_stake, args.amount)?;
        }
    }

    Ok(())
}
