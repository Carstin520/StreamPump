// EN: Sponsor escrows USDC into a creator-specific S1 buyout offer.
// ZH: 赞助商向创作者的 S1 买断报价托管 USDC。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutOffer},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitBuyoutOfferArgs {
    pub usdc_amount: u64,
}

#[derive(Accounts)]
pub struct SubmitBuyoutOffer<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority != Pubkey::default() @ StreamPumpError::CreatorNotRegistered
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    #[account(
        init,
        payer = sponsor,
        seeds = [b"buyout_offer", sponsor.key().as_ref(), creator_profile.key().as_ref()],
        bump,
        space = 8 + S1BuyoutOffer::INIT_SPACE
    )]
    pub buyout_offer: Account<'info, S1BuyoutOffer>,

    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = sponsor,
        seeds = [b"offer_usdc_vault", buyout_offer.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = buyout_offer
    )]
    pub offer_usdc_vault: Account<'info, TokenAccount>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub(crate) fn handler(ctx: Context<SubmitBuyoutOffer>, args: SubmitBuyoutOfferArgs) -> Result<()> {
    require!(args.usdc_amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Auction_Pending,
        StreamPumpError::InvalidCreatorStatus
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                to: ctx.accounts.offer_usdc_vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        args.usdc_amount,
    )?;

    let buyout_offer = &mut ctx.accounts.buyout_offer;
    buyout_offer.sponsor = ctx.accounts.sponsor.key();
    buyout_offer.creator = ctx.accounts.creator_profile.key();
    buyout_offer.usdc_amount = args.usdc_amount;
    buyout_offer.bump = ctx.bumps.buyout_offer;

    Ok(())
}
