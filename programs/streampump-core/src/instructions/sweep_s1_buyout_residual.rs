use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    events::S1BuyoutResidualSwept,
    state::{
        CreatorProfile, ProtocolConfig, ResidualDestination, S1BuyoutOffer, S1BuyoutState,
    },
};

#[derive(Accounts)]
pub struct SweepS1BuyoutResidual<'info> {
    #[account(mut)]
    pub sweeper: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Box<Account<'info, CreatorProfile>>,

    #[account(
        mut,
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump = s1_buyout_state.bump,
        constraint = s1_buyout_state.creator == creator_profile.key() @ StreamPumpError::BuyoutStateMismatch
    )]
    pub s1_buyout_state: Box<Account<'info, S1BuyoutState>>,

    #[account(
        seeds = [b"buyout_offer", buyout_offer.sponsor.as_ref(), creator_profile.key().as_ref()],
        bump = buyout_offer.bump,
        constraint = buyout_offer.creator == creator_profile.key() @ StreamPumpError::BuyoutOfferMismatch
    )]
    pub buyout_offer: Box<Account<'info, S1BuyoutOffer>>,

    #[account(
        mut,
        seeds = [b"offer_usdc_vault", buyout_offer.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = buyout_offer
    )]
    pub offer_usdc_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == buyout_offer.sponsor @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: sponsor wallet receives closed vault rent.
    #[account(mut, address = buyout_offer.sponsor @ StreamPumpError::Unauthorized)]
    pub sponsor: UncheckedAccount<'info>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<SweepS1BuyoutResidual>) -> Result<()> {
    let sweeper = ctx.accounts.sweeper.key();
    require!(
        sweeper == ctx.accounts.protocol_config.oracle_authority
            || sweeper == ctx.accounts.protocol_config.admin,
        StreamPumpError::Unauthorized
    );

    let buyout_state = &mut ctx.accounts.s1_buyout_state;
    require!(buyout_state.creator_paid, StreamPumpError::InvalidCreatorStatus);
    require!(buyout_state.graduated_at > 0, StreamPumpError::InvalidCreatorStatus);
    let window_close_at = buyout_state
        .graduated_at
        .checked_add(ctx.accounts.protocol_config.s1_discovery_claim_window_seconds)
        .ok_or(StreamPumpError::MathOverflow)?;
    let now = Clock::get()?.unix_timestamp;
    require!(now >= window_close_at, StreamPumpError::ClaimWindowStillOpen);

    ctx.accounts.offer_usdc_vault.reload()?;
    let residual_amount = ctx.accounts.offer_usdc_vault.amount;
    require!(
        residual_amount > 0 || buyout_state.discovery_pool_remaining > 0,
        StreamPumpError::BuyoutResidualAlreadySwept
    );

    let offer = &ctx.accounts.buyout_offer;
    let bump_bytes = [offer.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"buyout_offer",
        offer.sponsor.as_ref(),
        offer.creator.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    if residual_amount > 0 {
        let residual_to = if buyout_state.residual_to_snapshot == ResidualDestination::Sponsor as u8
        {
            ctx.accounts.sponsor_usdc_ata.to_account_info()
        } else if buyout_state.residual_to_snapshot == ResidualDestination::Creator as u8 {
            ctx.accounts.creator_usdc_ata.to_account_info()
        } else {
            return err!(StreamPumpError::InvalidResidualDestination);
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.offer_usdc_vault.to_account_info(),
                    to: residual_to,
                    authority: ctx.accounts.buyout_offer.to_account_info(),
                },
                signer,
            ),
            residual_amount,
        )?;
    }

    buyout_state.discovery_pool_remaining = 0;
    buyout_state.claimable_usdc_remaining = 0;
    buyout_state.eligible_holder_count = 0;
    buyout_state.early_holder_count = 0;
    buyout_state.regular_holder_count = 0;
    buyout_state.claimable_s1_supply_remaining = 0;
    buyout_state.early_claimable_s1_supply_remaining = 0;
    buyout_state.regular_claimable_s1_supply_remaining = 0;

    ctx.accounts.offer_usdc_vault.reload()?;
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.offer_usdc_vault.to_account_info(),
            destination: ctx.accounts.sponsor.to_account_info(),
            authority: ctx.accounts.buyout_offer.to_account_info(),
        },
        signer,
    ))?;

    emit!(S1BuyoutResidualSwept {
        creator_profile: ctx.accounts.creator_profile.key(),
        s1_buyout_state: buyout_state.key(),
        buyout_offer: ctx.accounts.buyout_offer.key(),
        residual_amount,
        residual_to: buyout_state.residual_to_snapshot,
        swept_by: sweeper,
        closed: true,
    });

    Ok(())
}
