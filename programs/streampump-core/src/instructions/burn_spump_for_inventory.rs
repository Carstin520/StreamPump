// EN: Burn SPUMP from the sponsor to unlock a specified USDC ad spend amount for this campaign.
// ZH: 从赞助商账户销毁 SPUMP，用于为本次活动解锁对应额度的 USDC 广告投放预算。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::{
    errors::StreamPumpError,
    state::{CampaignEscrow, ProtocolConfig},
    utils::{amount_from_bps, checked_add},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BurnSpumpForInventoryArgs {
    pub usdc_spend_amount: u64,
}

#[derive(Accounts)]
pub struct BurnSpumpForInventory<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,
    #[account(
        seeds = [b"protocol_config"], 
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [b"campaign", campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        constraint = campaign.sponsor == sponsor.key() @ StreamPumpError::Unauthorized
    )]
    pub campaign: Account<'info, CampaignEscrow>,
    #[account(
        address = protocol_config.spump_mint @ StreamPumpError::InvalidMint
    )]
    pub spump_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = sponsor_spump_ata.owner == sponsor.key() @ StreamPumpError::Unauthorized,
        constraint = sponsor_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub sponsor_spump_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(
    ctx: Context<BurnSpumpForInventory>,
    args: BurnSpumpForInventoryArgs,
) -> Result<()> {
    require!(args.usdc_spend_amount > 0, StreamPumpError::InvalidAmount);

    let burn_amount = amount_from_bps(
        args.usdc_spend_amount,
        ctx.accounts.protocol_config.min_sponsor_burn_bps,
    )?;

    require!(burn_amount > 0, StreamPumpError::BurnAmountTooLow);

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.spump_mint.to_account_info(),
                from: ctx.accounts.sponsor_spump_ata.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        burn_amount,
    )?;

    let campaign = &mut ctx.accounts.campaign;
    campaign.spump_burned_for_inventory =
        checked_add(campaign.spump_burned_for_inventory, burn_amount)?;

    Ok(())
}
