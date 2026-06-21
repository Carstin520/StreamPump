// EN: S2 fan claims a capped, non-proportional S1 discovery reward from the
//     accepted buyout offer. The instruction name is retained for IDL/client
//     compatibility, but this is no longer a pro-rata buyout-share claim.
// ZH: 粉丝在 S2 阶段领取封顶、非按份额的 S1 发现奖励。为兼容 IDL/客户端，
//     指令名保留，但语义不再是按比例领取买断份额。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    events::S1BuyoutUsdcClaimed,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, ResidualDestination, S1BuyoutOffer,
        S1BuyoutState, S1UserPosition,
    },
    utils::{apply_s1_holder_counter_delta, calculate_s1_discovery_reward, checked_sub},
};

#[derive(Accounts)]
pub struct ClaimS1BuyoutUsdc<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        mut,
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
        mut,
        seeds = [b"s1_position", user.key().as_ref(), creator_profile.key().as_ref()],
        bump = s1_user_position.bump,
        constraint = s1_user_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = s1_user_position.creator == creator_profile.key() @ StreamPumpError::S1PositionAccountMismatch,
        constraint = s1_user_position.internal_token_balance > 0 @ StreamPumpError::InsufficientInternalTokenBalance
    )]
    pub s1_user_position: Box<Account<'info, S1UserPosition>>,

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
        constraint = user_usdc_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

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
    let now = Clock::get()?.unix_timestamp;
    if ctx
        .accounts
        .s1_buyout_state
        .discovery_min_hold_seconds_snapshot
        > 0
    {
        let eligible_at = position
            .first_bought_at
            .checked_add(
                ctx.accounts
                    .s1_buyout_state
                    .discovery_min_hold_seconds_snapshot,
            )
            .ok_or(StreamPumpError::MathOverflow)?;
        require!(now >= eligible_at, StreamPumpError::HoldDurationNotMet);
    }
    let is_early_holder = std::cmp::min(
        position.early_cohort_balance,
        position.internal_token_balance,
    ) > 0;
    let pre_balance = position.internal_token_balance;
    let pre_early_balance = position.early_cohort_balance;

    let buyout_state = &mut ctx.accounts.s1_buyout_state;
    require_counted_discovery_claimant(
        buyout_state.eligible_holder_count,
        buyout_state.early_holder_count,
        buyout_state.regular_holder_count,
        is_early_holder,
    )?;

    let (usdc_reward, capped) = calculate_s1_discovery_reward(
        buyout_state.reward_model_snapshot,
        buyout_state.discovery_pool_remaining,
        buyout_state.eligible_holder_count,
        buyout_state.early_holder_count,
        buyout_state.regular_holder_count,
        is_early_holder,
        buyout_state.discovery_reward_cap_usdc_snapshot,
        buyout_state.status_thankyou_usdc_snapshot,
    )?;

    require!(
        ctx.accounts.offer_usdc_vault.amount >= usdc_reward,
        StreamPumpError::InsufficientBuyoutUsdcLiquidity
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

    if usdc_reward > 0 {
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
            usdc_reward,
        )?;
    }

    buyout_state.discovery_pool_remaining =
        checked_sub(buyout_state.discovery_pool_remaining, usdc_reward)?;
    buyout_state.eligible_holder_count = buyout_state
        .eligible_holder_count
        .checked_sub(1)
        .ok_or(StreamPumpError::HolderCounterUnderflow)?;
    if is_early_holder {
        buyout_state.early_holder_count = buyout_state
            .early_holder_count
            .checked_sub(1)
            .ok_or(StreamPumpError::HolderCounterUnderflow)?;
    } else {
        buyout_state.regular_holder_count = buyout_state
            .regular_holder_count
            .checked_sub(1)
            .ok_or(StreamPumpError::HolderCounterUnderflow)?;
    }
    buyout_state.claimable_usdc_remaining = buyout_state.discovery_pool_remaining;
    buyout_state.claimable_s1_supply_remaining = buyout_state.eligible_holder_count as u64;
    buyout_state.early_claimable_s1_supply_remaining = buyout_state.early_holder_count as u64;
    buyout_state.regular_claimable_s1_supply_remaining = buyout_state.regular_holder_count as u64;

    let mut residual_transferred = 0_u64;
    if buyout_state.eligible_holder_count == 0 && buyout_state.discovery_pool_remaining > 0 {
        residual_transferred = buyout_state.discovery_pool_remaining;
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
            residual_transferred,
        )?;
        buyout_state.discovery_pool_remaining = 0;
        buyout_state.claimable_usdc_remaining = 0;
    }

    let creator_profile = &mut ctx.accounts.creator_profile;
    apply_s1_holder_counter_delta(
        creator_profile,
        pre_balance,
        pre_early_balance,
        0,
        0,
    )?;
    position.internal_token_balance = 0;
    position.early_cohort_balance = 0;
    position.spump_cost_basis = 0;

    ctx.accounts.offer_usdc_vault.reload()?;
    let mut vault_closed = false;
    if buyout_state.eligible_holder_count == 0
        && buyout_state.discovery_pool_remaining == 0
        && ctx.accounts.offer_usdc_vault.amount == 0
    {
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.offer_usdc_vault.to_account_info(),
                destination: ctx.accounts.sponsor.to_account_info(),
                authority: ctx.accounts.buyout_offer.to_account_info(),
            },
            signer,
        ))?;
        vault_closed = true;
    }

    emit!(S1BuyoutUsdcClaimed {
        user: ctx.accounts.user.key(),
        creator_profile: creator_profile_key,
        s1_user_position: s1_user_position_key,
        s1_buyout_state: s1_buyout_state_key,
        usdc_amount: usdc_reward,
        reward_model: buyout_state.reward_model_snapshot,
        capped,
        eligible: true,
        discovery_pool_remaining: buyout_state.discovery_pool_remaining,
        eligible_holder_count: buyout_state.eligible_holder_count,
        early_holder_count: buyout_state.early_holder_count,
        regular_holder_count: buyout_state.regular_holder_count,
        residual_transferred,
        residual_to: buyout_state.residual_to_snapshot,
        vault_closed,
    });

    Ok(())
}

fn require_counted_discovery_claimant(
    eligible_holder_count: u32,
    early_holder_count: u32,
    regular_holder_count: u32,
    is_early_holder: bool,
) -> Result<()> {
    if eligible_holder_count == 0 {
        return err!(StreamPumpError::IneligibleForDiscoveryReward);
    }
    if is_early_holder {
        require!(
            early_holder_count > 0,
            StreamPumpError::IneligibleForDiscoveryReward
        );
    } else {
        require!(
            regular_holder_count > 0,
            StreamPumpError::IneligibleForDiscoveryReward
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::require_counted_discovery_claimant;
    use crate::errors::StreamPumpError;
    use anchor_lang::error::Error;

    fn assert_ineligible(result: anchor_lang::Result<()>) {
        let err = result.unwrap_err();
        match err {
            Error::AnchorError(anchor_error) => {
                assert_eq!(
                    anchor_error.error_name,
                    "IneligibleForDiscoveryReward"
                );
            }
            other => panic!("unexpected error type: {other:?}"),
        }
    }

    #[test]
    fn counted_claimant_guard_rejects_corrupted_zero_counts_before_mutation() {
        let original_balance = 25_u64;
        let original_early_balance = 25_u64;

        assert_ineligible(require_counted_discovery_claimant(0, 0, 0, true));

        assert_eq!(original_balance, 25);
        assert_eq!(original_early_balance, 25);
    }

    #[test]
    fn counted_claimant_guard_rejects_missing_bucket_counts() {
        assert_ineligible(require_counted_discovery_claimant(1, 0, 1, true));
        assert_ineligible(require_counted_discovery_claimant(1, 1, 0, false));
    }

    #[test]
    fn counted_claimant_guard_allows_matching_bucket_counts() {
        require_counted_discovery_claimant(2, 1, 1, true).unwrap();
        require_counted_discovery_claimant(2, 1, 1, false).unwrap();
        let _ = StreamPumpError::IneligibleForDiscoveryReward;
    }
}
