// EN: S2 fan claims pro-rata USDC from the accepted S1 buyout offer.
// ZH: 粉丝在 S2 阶段按份额领取 S1 买断报价中的 USDC。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    events::S1BuyoutUsdcClaimed,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutOffer, S1BuyoutState, S1UserPosition,
    },
    utils::{calculate_remaining_pro_rata_share, checked_add, checked_sub},
};

#[derive(Accounts)]
pub struct ClaimS1BuyoutUsdc<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    #[account(
        mut,
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump = s1_buyout_state.bump,
        constraint = s1_buyout_state.creator == creator_profile.key() @ StreamPumpError::BuyoutStateMismatch
    )]
    pub s1_buyout_state: Account<'info, S1BuyoutState>,

    #[account(
        mut,
        seeds = [b"s1_position", user.key().as_ref(), creator_profile.key().as_ref()],
        bump = s1_user_position.bump,
        constraint = s1_user_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = s1_user_position.creator == creator_profile.key() @ StreamPumpError::S1PositionAccountMismatch
    )]
    pub s1_user_position: Account<'info, S1UserPosition>,

    #[account(
        seeds = [b"buyout_offer", buyout_offer.sponsor.as_ref(), creator_profile.key().as_ref()],
        bump = buyout_offer.bump,
        constraint = buyout_offer.creator == creator_profile.key() @ StreamPumpError::BuyoutOfferMismatch
    )]
    pub buyout_offer: Account<'info, S1BuyoutOffer>,

    #[account(
        mut,
        seeds = [b"offer_usdc_vault", buyout_offer.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = buyout_offer
    )]
    pub offer_usdc_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_usdc_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<ClaimS1BuyoutUsdc>) -> Result<()> {
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S2_Active,
        StreamPumpError::InvalidCreatorStatus
    );
    let creator_profile_key = ctx.accounts.creator_profile.key();
    let s1_user_position_key = ctx.accounts.s1_user_position.key();
    let s1_buyout_state_key = ctx.accounts.s1_buyout_state.key();

    let winning_sponsor = ctx
        .accounts
        .s1_buyout_state
        .winning_sponsor
        .ok_or(error!(StreamPumpError::WinningSponsorNotSelected))?;
    require_keys_eq!(
        winning_sponsor,
        ctx.accounts.buyout_offer.sponsor,
        StreamPumpError::BuyoutOfferMismatch
    );

    let position = &mut ctx.accounts.s1_user_position;
    require!(
        position.internal_token_balance > 0,
        StreamPumpError::InsufficientInternalTokenBalance
    );
    let position_balance = position.internal_token_balance;
    let early_position_balance = std::cmp::min(
        position.early_cohort_balance,
        position.internal_token_balance,
    );
    let regular_position_balance = checked_sub(position_balance, early_position_balance)?;

    let buyout_state = &mut ctx.accounts.s1_buyout_state;
    require!(
        buyout_state.claimable_s1_supply_remaining > 0,
        StreamPumpError::InvalidAmount
    );

    let early_usdc_share = if early_position_balance > 0 {
        calculate_remaining_pro_rata_share(
            early_position_balance,
            buyout_state.early_claimable_usdc_remaining,
            buyout_state.early_claimable_s1_supply_remaining,
        )?
    } else {
        0
    };
    let regular_usdc_share = if regular_position_balance > 0 {
        calculate_remaining_pro_rata_share(
            regular_position_balance,
            buyout_state.regular_claimable_usdc_remaining,
            buyout_state.regular_claimable_s1_supply_remaining,
        )?
    } else {
        0
    };
    let usdc_share = checked_add(early_usdc_share, regular_usdc_share)?;

    require!(
        ctx.accounts.offer_usdc_vault.amount >= usdc_share,
        StreamPumpError::InsufficientBuyoutUsdcLiquidity
    );

    let remaining_usdc;
    let remaining_supply;

    if usdc_share > 0 {
        let offer = &ctx.accounts.buyout_offer;
        let bump_bytes = [offer.bump];
        let signer_seeds: [&[u8]; 4] = [
            b"buyout_offer",
            offer.sponsor.as_ref(),
            offer.creator.as_ref(),
            bump_bytes.as_ref(),
        ];
        let signer: &[&[&[u8]]] = &[&signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.offer_usdc_vault.to_account_info(),
                    to: ctx.accounts.user_usdc_ata.to_account_info(),
                    authority: ctx.accounts.buyout_offer.to_account_info(),
                },
                signer,
            ),
            usdc_share,
        )?;

        remaining_usdc = checked_sub(buyout_state.claimable_usdc_remaining, usdc_share)?;
        remaining_supply =
            checked_sub(buyout_state.claimable_s1_supply_remaining, position_balance)?;
        buyout_state.claimable_usdc_remaining = remaining_usdc;
        buyout_state.claimable_s1_supply_remaining = remaining_supply;
        buyout_state.early_claimable_usdc_remaining = checked_sub(
            buyout_state.early_claimable_usdc_remaining,
            early_usdc_share,
        )?;
        buyout_state.early_claimable_s1_supply_remaining = checked_sub(
            buyout_state.early_claimable_s1_supply_remaining,
            early_position_balance,
        )?;
        buyout_state.regular_claimable_usdc_remaining = checked_sub(
            buyout_state.regular_claimable_usdc_remaining,
            regular_usdc_share,
        )?;
        buyout_state.regular_claimable_s1_supply_remaining = checked_sub(
            buyout_state.regular_claimable_s1_supply_remaining,
            regular_position_balance,
        )?;

        if remaining_supply == 0 && ctx.accounts.offer_usdc_vault.amount == 0 {
            token::close_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.offer_usdc_vault.to_account_info(),
                    destination: ctx.accounts.user.to_account_info(),
                    authority: ctx.accounts.buyout_offer.to_account_info(),
                },
                signer,
            ))?;
        }
    } else {
        remaining_supply =
            checked_sub(buyout_state.claimable_s1_supply_remaining, position_balance)?;
        buyout_state.claimable_s1_supply_remaining = remaining_supply;
        buyout_state.early_claimable_s1_supply_remaining = checked_sub(
            buyout_state.early_claimable_s1_supply_remaining,
            early_position_balance,
        )?;
        buyout_state.regular_claimable_s1_supply_remaining = checked_sub(
            buyout_state.regular_claimable_s1_supply_remaining,
            regular_position_balance,
        )?;
        remaining_usdc = buyout_state.claimable_usdc_remaining;
    }

    position.internal_token_balance = 0;
    position.early_cohort_balance = 0;
    position.spump_cost_basis = 0;

    emit!(S1BuyoutUsdcClaimed {
        user: ctx.accounts.user.key(),
        creator_profile: creator_profile_key,
        s1_user_position: s1_user_position_key,
        s1_buyout_state: s1_buyout_state_key,
        usdc_amount: usdc_share,
        remaining_usdc,
        remaining_supply,
    });

    Ok(())
}
