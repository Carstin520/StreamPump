// EN: Atomically settle a campaign: route USDC to predictors, creator, and sponsor; burn losing SPUMP or refund if void.
// ZH: 原子性结算活动：将 USDC 在预测者、创作者和赞助商之间结算，并对输家 SPUMP 进行销毁或在作废时退款。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CampaignEscrow, CampaignStatus, CreatorProfile, ProtocolConfig, TrafficMarket},
    utils::{amount_from_bps, checked_add, checked_sub},
};

#[derive(Accounts)]
pub struct SettleCampaign<'info> {
    pub settler: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [b"campaign", campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Open @ StreamPumpError::CampaignClosed
    )]
    pub campaign: Account<'info, CampaignEscrow>,
    #[account(
        constraint = creator_profile.key() == campaign.creator_profile @ StreamPumpError::CampaignNotReady
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    /// CHECK: PDA signer for the campaign vault.
    #[account(
        seeds = [b"campaign_vault_authority", campaign.key().as_ref()],
        bump = campaign.vault_authority_bump
    )]
    pub campaign_vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"campaign_vault", campaign.key().as_ref()],
        bump,
        constraint = campaign_vault.key() == campaign.usdc_vault @ StreamPumpError::CampaignNotReady,
        constraint = campaign_vault.mint == campaign.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub campaign_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"market", campaign.key().as_ref()],
        bump = market.bump,
        constraint = market.key() == campaign.market @ StreamPumpError::CampaignNotReady
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
        constraint = market_usdc_rewards_vault.mint == campaign.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub market_usdc_rewards_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = sponsor_usdc_ata.owner == campaign.sponsor @ StreamPumpError::Unauthorized,
        constraint = sponsor_usdc_ata.mint == campaign.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == campaign.usdc_mint @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Account<'info, TokenAccount>,
    #[account(address = market.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<SettleCampaign>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let campaign_key = ctx.accounts.campaign.key();
    let market_key = ctx.accounts.market.key();

    let campaign_signer_seed: &[&[u8]] = &[
        b"campaign_vault_authority",
        campaign_key.as_ref(),
        &[ctx.accounts.campaign.vault_authority_bump],
    ];
    let campaign_signer: &[&[&[u8]]] = &[campaign_signer_seed];

    let market_signer_seed: &[&[u8]] = &[
        b"market_vault_authority",
        market_key.as_ref(),
        &[ctx.accounts.market.vault_authority_bump],
    ];
    let market_signer: &[&[&[u8]]] = &[market_signer_seed];

    let campaign = &mut ctx.accounts.campaign;
    let market = &mut ctx.accounts.market;

    require!(!market.resolved, StreamPumpError::MarketResolved);

    if !campaign.oracle_reported {
        require!(
            now > campaign.deadline_ts,
            StreamPumpError::OracleReportRequired
        );

        if campaign.total_deposited > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.campaign_vault.to_account_info(),
                        to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                        authority: ctx.accounts.campaign_vault_authority.to_account_info(),
                    },
                    campaign_signer,
                ),
                campaign.total_deposited,
            )?;
        }

        campaign.status = CampaignStatus::ExpiredRefunded;
        campaign.settled_at = now;

        market.resolved = true;
        market.voided = true;
        market.outcome_yes = false;
        market.loser_burned = false;

        return Ok(());
    }

    let predictor_pool = amount_from_bps(campaign.total_deposited, campaign.predictor_pool_bps)?;
    let creator_payout = if campaign.oracle_outcome_yes {
        amount_from_bps(
            campaign.total_deposited,
            campaign.creator_success_payout_bps,
        )?
    } else {
        0
    };

    let distributed = checked_add(predictor_pool, creator_payout)?;
    let sponsor_refund = checked_sub(campaign.total_deposited, distributed)?;

    if predictor_pool > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.campaign_vault.to_account_info(),
                    to: ctx.accounts.market_usdc_rewards_vault.to_account_info(),
                    authority: ctx.accounts.campaign_vault_authority.to_account_info(),
                },
                campaign_signer,
            ),
            predictor_pool,
        )?;
    }

    if creator_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.campaign_vault.to_account_info(),
                    to: ctx.accounts.creator_usdc_ata.to_account_info(),
                    authority: ctx.accounts.campaign_vault_authority.to_account_info(),
                },
                campaign_signer,
            ),
            creator_payout,
        )?;
    }

    if sponsor_refund > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.campaign_vault.to_account_info(),
                    to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                    authority: ctx.accounts.campaign_vault_authority.to_account_info(),
                },
                campaign_signer,
            ),
            sponsor_refund,
        )?;
    }

    market.rewards_usdc_total = checked_add(market.rewards_usdc_total, predictor_pool)?;
    market.resolved = true;
    market.outcome_yes = campaign.oracle_outcome_yes;
    market.voided = false;

    let losing_stake = if market.outcome_yes {
        market.no_total_stake
    } else {
        market.yes_total_stake
    };

    if losing_stake > 0 {
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.spump_mint.to_account_info(),
                    from: ctx.accounts.market_spump_vault.to_account_info(),
                    authority: ctx.accounts.market_vault_authority.to_account_info(),
                },
                market_signer,
            ),
            losing_stake,
        )?;
    }

    market.loser_burned = true;

    campaign.status = CampaignStatus::Settled;
    campaign.settled_at = now;

    Ok(())
}
