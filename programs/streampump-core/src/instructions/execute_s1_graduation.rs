// EN: Finalize S1 buyout after rage-quit window and graduate creator to S2.
// ZH: Rage Quit 窗口结束后完成 S1 买断并让创作者毕业到 S2。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutState, MIN_PROPOSAL_CREATOR_LEVEL,
    },
};

#[derive(Accounts)]
pub struct ExecuteS1Graduation<'info> {
    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
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
        seeds = [b"creator_s1_spump_vault", creator_profile.key().as_ref()],
        bump,
        token::mint = spump_mint,
        token::authority = creator_profile
    )]
    pub creator_s1_spump_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_revenue_spump_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_revenue_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_revenue_spump_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = protocol_burn_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub protocol_burn_spump_ata: Account<'info, TokenAccount>,

    #[account(address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<ExecuteS1Graduation>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let creator_profile = &ctx.accounts.creator_profile;
    require!(
        creator_profile.status == CreatorStatus::S1_Execution_Pending,
        StreamPumpError::InvalidCreatorStatus
    );
    require!(
        now >= ctx.accounts.s1_buyout_state.rage_quit_deadline,
        StreamPumpError::RageQuitWindowStillOpen
    );
    require!(
        ctx.accounts.s1_buyout_state.winning_sponsor.is_some(),
        StreamPumpError::WinningSponsorNotSelected
    );

    let remaining_spump = ctx.accounts.creator_s1_spump_vault.amount;
    let creator_amount = remaining_spump / 2;
    let burn_amount = remaining_spump
        .checked_sub(creator_amount)
        .ok_or(StreamPumpError::MathOverflow)?;

    let creator_authority = creator_profile.authority;
    let creator_bump = creator_profile.bump;
    let bump_bytes = [creator_bump];
    let signer_seeds: [&[u8]; 3] = [
        b"creator",
        creator_authority.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    if creator_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_s1_spump_vault.to_account_info(),
                    to: ctx.accounts.creator_revenue_spump_ata.to_account_info(),
                    authority: ctx.accounts.creator_profile.to_account_info(),
                },
                signer,
            ),
            creator_amount,
        )?;
    }

    if burn_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_s1_spump_vault.to_account_info(),
                    to: ctx.accounts.protocol_burn_spump_ata.to_account_info(),
                    authority: ctx.accounts.creator_profile.to_account_info(),
                },
                signer,
            ),
            burn_amount,
        )?;
    }

    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.status = CreatorStatus::S2_Active;
    if creator_profile.level < MIN_PROPOSAL_CREATOR_LEVEL {
        creator_profile.level = MIN_PROPOSAL_CREATOR_LEVEL;
        creator_profile.last_upgrade_at = now;
    }
    creator_profile.s1_pool_spump = 0;
    creator_profile.updated_at = now;

    Ok(())
}
