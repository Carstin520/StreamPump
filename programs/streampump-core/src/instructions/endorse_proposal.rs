// EN: Stake SPUMP on a proposal as a single-sided endorsement position.
// ZH: 用户以单边方式质押 SPUMP 支持提案。
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Burn, Mint, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{EndorsementPosition, Proposal, ProposalStatus, ProtocolConfig},
    utils::checked_add,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EndorseProposalArgs {
    /// SPUMP amount to stake (burn) as endorsement.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct EndorseProposal<'info> {
    /// User staking SPUMP as an endorser.
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Proposal PDA. Must still be active for endorsements.
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// Per-user endorsement position on a proposal.
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"endorsement", user.key().as_ref(), proposal.key().as_ref()],
        bump,
        space = 8 + EndorsementPosition::INIT_SPACE
    )]
    pub endorsement_position: Account<'info, EndorsementPosition>,

    /// User source token account holding SPUMP.
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

/// Burns SPUMP from the user and updates both proposal and user position trackers.
pub(crate) fn handler(ctx: Context<EndorseProposal>, args: EndorseProposalArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);

    let proposal_key = ctx.accounts.proposal.key();
    let now = Clock::get()?.unix_timestamp;
    {
        let proposal = &ctx.accounts.proposal;
        require!(
            matches!(proposal.status, ProposalStatus::Open | ProposalStatus::Funded),
            StreamPumpError::ProposalNotActive
        );
        require!(now < proposal.deadline, StreamPumpError::ProposalExpired);
    }

    token_interface::burn(
        CpiContext::new(
            ctx.accounts.spump_token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.spump_mint.to_account_info(),
                from: ctx.accounts.user_spump_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        args.amount,
    )?;

    let position = &mut ctx.accounts.endorsement_position;
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.proposal = proposal_key;
        position.staked_amount = 0;
        position.claimed = false;
        position.bump = ctx.bumps.endorsement_position;
    }

    require_keys_eq!(
        position.user,
        ctx.accounts.user.key(),
        StreamPumpError::Unauthorized
    );
    require_keys_eq!(
        position.proposal,
        proposal_key,
        StreamPumpError::ProposalAccountMismatch
    );

    position.staked_amount = checked_add(position.staked_amount, args.amount)?;
    let proposal = &mut ctx.accounts.proposal;
    proposal.total_spump_staked = checked_add(proposal.total_spump_staked, args.amount)?;

    Ok(())
}
