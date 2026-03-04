// EN: Unselected sponsor withdraws escrowed USDC and closes their offer.
// ZH: 未中选赞助商取回托管 USDC 并关闭报价。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutOffer, S1BuyoutState},
};

#[derive(Accounts)]
pub struct CancelBuyoutOffer<'info> {
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
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump = s1_buyout_state.bump,
        constraint = s1_buyout_state.creator == creator_profile.key() @ StreamPumpError::BuyoutStateMismatch
    )]
    pub s1_buyout_state: Account<'info, S1BuyoutState>,

    #[account(
        mut,
        close = sponsor,
        seeds = [b"buyout_offer", sponsor.key().as_ref(), creator_profile.key().as_ref()],
        bump = buyout_offer.bump,
        constraint = buyout_offer.sponsor == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = buyout_offer.creator == creator_profile.key() @ StreamPumpError::BuyoutOfferMismatch
    )]
    pub buyout_offer: Account<'info, S1BuyoutOffer>,

    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"offer_usdc_vault", buyout_offer.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = buyout_offer
    )]
    pub offer_usdc_vault: Account<'info, TokenAccount>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<CancelBuyoutOffer>) -> Result<()> {
    require!(
        ctx.accounts.creator_profile.status != CreatorStatus::S1_Auction_Pending,
        StreamPumpError::InvalidCreatorStatus
    );

    if let Some(winning_sponsor) = ctx.accounts.s1_buyout_state.winning_sponsor {
        require!(
            winning_sponsor != ctx.accounts.sponsor.key(),
            StreamPumpError::WinningOfferCannotCancel
        );
    }

    let offer = &ctx.accounts.buyout_offer;
    let bump_bytes = [offer.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"buyout_offer",
        offer.sponsor.as_ref(),
        offer.creator.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    let vault_amount = ctx.accounts.offer_usdc_vault.amount;
    if vault_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.offer_usdc_vault.to_account_info(),
                    to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                    authority: ctx.accounts.buyout_offer.to_account_info(),
                },
                signer,
            ),
            vault_amount,
        )?;
    }

    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.offer_usdc_vault.to_account_info(),
            destination: ctx.accounts.sponsor.to_account_info(),
            authority: ctx.accounts.buyout_offer.to_account_info(),
        },
        signer,
    ))?;

    Ok(())
}
