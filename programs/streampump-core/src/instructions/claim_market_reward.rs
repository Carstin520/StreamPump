// EN: After market resolution, let users reclaim their SPUMP stake and pro‑rata USDC rewards (or full refund if voided).
// ZH: 在市场结算后，允许用户取回自己的 SPUMP 本金并领取按比例分配的 USDC 奖励（或在市场作废时全额退回）。 
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{BetPosition, CampaignEscrow, TrafficMarket},
    utils::{checked_add, checked_sub},
};

#[derive(Accounts)]
pub struct ClaimMarketReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"campaign", campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, CampaignEscrow>,
    #[account(
        mut,
        seeds = [b"market", campaign.key().as_ref()],
        bump = market.bump,
        constraint = market.campaign == campaign.key() @ StreamPumpError::CampaignNotReady
    )]
    pub market: Account<'info, TrafficMarket>,
    /// CHECK: PDA signer for market vault token accounts.
    #[account(
        seeds = [b"market_vault_authority", market.key().as_ref()],
        bump = market.vault_authority_bump
    )]
    pub market_vault_authority: UncheckedAccount<'info>,
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
        seeds = [b"market_usdc_rewards_vault", market.key().as_ref()],
        bump,
        constraint = market_usdc_rewards_vault.key() == market.usdc_rewards_vault @ StreamPumpError::CampaignNotReady,
        constraint = market_usdc_rewards_vault.mint == market.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub market_usdc_rewards_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == market.spump_mint @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_usdc_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_usdc_ata.mint == market.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub user_usdc_ata: Account<'info, TokenAccount>,
    #[account(address = market.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,
    #[account(address = market.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"bet_position", market.key().as_ref(), user.key().as_ref()],
        bump = bet_position.bump,
        constraint = bet_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = bet_position.market == market.key() @ StreamPumpError::CampaignNotReady
    )]
    pub bet_position: Account<'info, BetPosition>,
    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<ClaimMarketReward>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.bet_position;

    require!(market.resolved, StreamPumpError::MarketNotResolved);
    require!(!position.claimed, StreamPumpError::PositionAlreadyClaimed);

    let market_key = market.key();
    let signer_seed: &[&[u8]] = &[
        b"market_vault_authority",
        market_key.as_ref(),
        &[market.vault_authority_bump],
    ];
    let signer: &[&[&[u8]]] = &[signer_seed];

    let principal_spump = if market.voided {
        checked_add(position.yes_stake, position.no_stake)?
    } else if market.outcome_yes {
        position.yes_stake
    } else {
        position.no_stake
    };

    if !market.voided {
        require!(principal_spump > 0, StreamPumpError::NotWinningPosition);
    }

    if principal_spump > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.market_spump_vault.to_account_info(),
                    to: ctx.accounts.user_spump_ata.to_account_info(),
                    authority: ctx.accounts.market_vault_authority.to_account_info(),
                },
                signer,
            ),
            principal_spump,
        )?;

        market.stakes_redeemed_total = checked_add(market.stakes_redeemed_total, principal_spump)?;
    }

    let mut usdc_reward = 0_u64;
    if !market.voided {
        let total_winning_stake = if market.outcome_yes {
            market.yes_total_stake
        } else {
            market.no_total_stake
        };

        if total_winning_stake > 0 {
            let raw_reward = ((market.rewards_usdc_total as u128)
                .checked_mul(principal_spump as u128)
                .ok_or(StreamPumpError::MathOverflow)?)
            .checked_div(total_winning_stake as u128)
            .ok_or(StreamPumpError::MathOverflow)?;

            usdc_reward =
                u64::try_from(raw_reward).map_err(|_| error!(StreamPumpError::MathOverflow))?;

            let remaining_rewards =
                checked_sub(market.rewards_usdc_total, market.rewards_usdc_distributed)?;
            if usdc_reward > remaining_rewards {
                usdc_reward = remaining_rewards;
            }
        }

        if usdc_reward > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.market_usdc_rewards_vault.to_account_info(),
                        to: ctx.accounts.user_usdc_ata.to_account_info(),
                        authority: ctx.accounts.market_vault_authority.to_account_info(),
                    },
                    signer,
                ),
                usdc_reward,
            )?;

            market.rewards_usdc_distributed =
                checked_add(market.rewards_usdc_distributed, usdc_reward)?;
        }
    }

    position.claimed = true;

    Ok(())
}
