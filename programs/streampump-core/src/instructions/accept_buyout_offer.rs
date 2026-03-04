// EN: Creator accepts one offer and opens the 48h rage-quit window.
// ZH: 创作者接受一个报价并开启 48 小时 Rage Quit 窗口。
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutOffer, S1BuyoutState},
};

const RAGE_QUIT_WINDOW_SECONDS: i64 = 48 * 3600;

#[derive(Accounts)]
pub struct AcceptBuyoutOffer<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"creator", creator.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority == creator.key() @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    #[account(
        seeds = [b"buyout_offer", buyout_offer.sponsor.as_ref(), creator_profile.key().as_ref()],
        bump = buyout_offer.bump,
        constraint = buyout_offer.creator == creator_profile.key() @ StreamPumpError::BuyoutOfferMismatch
    )]
    pub buyout_offer: Account<'info, S1BuyoutOffer>,

    #[account(
        seeds = [b"offer_usdc_vault", buyout_offer.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = buyout_offer
    )]
    pub offer_usdc_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump,
        space = 8 + S1BuyoutState::INIT_SPACE
    )]
    pub s1_buyout_state: Account<'info, S1BuyoutState>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<AcceptBuyoutOffer>) -> Result<()> {
    let creator_profile = &mut ctx.accounts.creator_profile;
    require!(
        creator_profile.status == CreatorStatus::S1_Auction_Pending,
        StreamPumpError::InvalidCreatorStatus
    );

    let buyout_offer = &ctx.accounts.buyout_offer;
    require!(buyout_offer.usdc_amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.offer_usdc_vault.amount >= buyout_offer.usdc_amount,
        StreamPumpError::InsufficientBuyoutUsdcLiquidity
    );

    let now = Clock::get()?.unix_timestamp;
    let rage_quit_deadline = now
        .checked_add(RAGE_QUIT_WINDOW_SECONDS)
        .ok_or(StreamPumpError::MathOverflow)?;

    let buyout_state = &mut ctx.accounts.s1_buyout_state;
    buyout_state.creator = creator_profile.key();
    buyout_state.winning_sponsor = Some(buyout_offer.sponsor);
    buyout_state.usdc_deposited = buyout_offer.usdc_amount;
    buyout_state.rage_quit_deadline = rage_quit_deadline;
    buyout_state.bump = ctx.bumps.s1_buyout_state;

    creator_profile.status = CreatorStatus::S1_Execution_Pending;
    creator_profile.updated_at = now;

    Ok(())
}
