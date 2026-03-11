// EN: Finalize S1 buyout after rage-quit window and graduate creator to S2.
// ZH: Rage Quit 窗口结束后完成 S1 买断并让创作者毕业到 S2。
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutState, MIN_PROPOSAL_CREATOR_LEVEL,
    },
    utils::calculate_sell_return,
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
        constraint = creator_revenue_spump_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_revenue_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_revenue_spump_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,
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

    // Virtual SPUMP locked in the curve equals the full sell return from current supply to zero.
    let remaining_virtual_spump = if creator_profile.s1_supply == 0 {
        0
    } else {
        calculate_sell_return(creator_profile.s1_supply, creator_profile.s1_supply)?
    };

    let creator_amount = remaining_virtual_spump / 2;

    if creator_amount > 0 {
        let bump_bytes = [ctx.accounts.protocol_config.bump];
        let signer_seeds: [&[u8]; 2] = [b"protocol_config", bump_bytes.as_ref()];
        let signer: &[&[&[u8]]] = &[&signer_seeds];

        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.spump_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.spump_mint.to_account_info(),
                    to: ctx.accounts.creator_revenue_spump_ata.to_account_info(),
                    authority: ctx.accounts.protocol_config.to_account_info(),
                },
                signer,
            ),
            creator_amount,
        )?;
    }

    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.status = CreatorStatus::S2_Active;
    if creator_profile.level < MIN_PROPOSAL_CREATOR_LEVEL {
        creator_profile.level = MIN_PROPOSAL_CREATOR_LEVEL;
        creator_profile.last_upgrade_at = now;
    }
    creator_profile.updated_at = now;

    Ok(())
}
