// ────────────────────────────────────────────────────────────────────────────────
// endorse_proposal.rs
// EN: Endorser burns SPUMP to back a creator's proposal (Track 2 only).
//     The actual SPUMP tokens are burned via Token-2022 Burn CPI — no vault holds
//     them. The burned amount is recorded as a virtual stake in:
//     - `EndorsementPosition.staked_amount` (per-user)
//     - `Proposal.total_spump_staked` (aggregate)
//     On settlement execution, the protocol mints back SPUMP according to the outcome
//     (see claim_endorsement.rs).
//
// ZH: Endorser 销毁 SPUMP 来支持创作者的提案（仅限 Track2）。
//     实际的 SPUMP 代币通过 Token-2022 Burn CPI 销毁——没有金库持有它们。
//     销毁金额以虚拟质押形式记录在：
//     - `EndorsementPosition.staked_amount`（每用户）
//     - `Proposal.total_spump_staked`（聚合）
//     执行结算时，协议根据结果铸回 SPUMP（见 claim_endorsement.rs）。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Burn, Mint, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    events::EndorsementCreated,
    state::{EndorsementPosition, Proposal, ProposalStatus, ProtocolConfig},
    utils::{amount_from_bps, checked_add},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EndorseProposalArgs {
    /// EN: SPUMP amount to burn as endorsement stake.
    /// ZH: 作为背书质押销毁的 SPUMP 数量。
    pub amount: u64,
}

#[derive(Accounts)]
pub struct EndorseProposal<'info> {
    /// EN: User staking (burning) SPUMP as an endorser.
    /// ZH: 以 Endorser 身份质押（销毁）SPUMP 的用户。
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: Proposal PDA. Must be Funded and not past deadline.
    /// ZH: 提案 PDA，必须处于 Funded 状态且未过截止时间。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes(), &proposal.nonce.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: Per-user endorsement position PDA on this proposal.
    /// ZH: 该用户在此提案上的背书仓位 PDA。
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"endorsement", user.key().as_ref(), proposal.key().as_ref()],
        bump,
        space = 8 + EndorsementPosition::INIT_SPACE
    )]
    pub endorsement_position: Account<'info, EndorsementPosition>,

    /// EN: User source token account holding SPUMP (Token-2022).
    /// ZH: 用户持有 SPUMP 的来源代币账户（Token-2022）。
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    /// EN: Token-2022 SPUMP mint — must match protocol config.
    /// ZH: Token-2022 SPUMP mint——必须匹配协议配置。
    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

/// EN: Burns SPUMP from the user and updates both proposal and user position trackers.
/// ZH: 销毁用户的 SPUMP 并更新提案和用户仓位记录。
pub(crate) fn handler(ctx: Context<EndorseProposal>, args: EndorseProposalArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);

    let proposal_key = ctx.accounts.proposal.key();
    let now = Clock::get()?.unix_timestamp;
    {
        let proposal = &ctx.accounts.proposal;
        // EN: Endorsements are only accepted while the proposal is Funded and before deadline.
        // ZH: 只有在提案处于 Funded 状态且未过截止时间时才接受背书。
        require!(
            proposal.status == ProposalStatus::Funded,
            StreamPumpError::ProposalNotFunded
        );
        require!(
            proposal.track2_target_value > 0 && proposal.track2_usdc_deposited > 0,
            StreamPumpError::ProposalTrackDisabled
        );
        require!(now < proposal.deadline, StreamPumpError::ProposalExpired);
    }

    // EN: Initialize or update the endorsement position.
    // ZH: 初始化或更新背书仓位。
    let position = &mut ctx.accounts.endorsement_position;
    let is_new_position = position.user == Pubkey::default();
    if is_new_position {
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

    // EN: Validate caps before burning SPUMP.
    // ZH: 在销毁 SPUMP 之前校验上限。
    {
        let proposal = &ctx.accounts.proposal;
        if proposal.max_endorsement_spump > 0 {
            require!(
                proposal
                    .total_spump_staked
                    .checked_add(args.amount)
                    .ok_or(StreamPumpError::MathOverflow)?
                    <= proposal.max_endorsement_spump,
                StreamPumpError::EndorsementCapExceeded
            );

            if ctx.accounts.protocol_config.max_endorsement_per_user_bps > 0 {
                let max_per_user = amount_from_bps(
                    proposal.max_endorsement_spump,
                    ctx.accounts.protocol_config.max_endorsement_per_user_bps,
                )?;
                let effective_user_total = if is_new_position {
                    args.amount
                } else {
                    position
                        .staked_amount
                        .checked_add(args.amount)
                        .ok_or(StreamPumpError::MathOverflow)?
                };
                require!(
                    effective_user_total <= max_per_user,
                    StreamPumpError::EndorsementPerUserCapExceeded
                );
            }
        } else if ctx.accounts.protocol_config.max_endorsement_hard_ceiling > 0 {
            require!(
                proposal
                    .total_spump_staked
                    .checked_add(args.amount)
                    .ok_or(StreamPumpError::MathOverflow)?
                    <= ctx.accounts.protocol_config.max_endorsement_hard_ceiling,
                StreamPumpError::EndorsementCapExceeded
            );
        }
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

    // EN: Update virtual stake ledger (both per-user and aggregate).
    // ZH: 更新虚拟质押账本（用户级和聚合级）。
    position.staked_amount = checked_add(position.staked_amount, args.amount)?;
    let proposal = &mut ctx.accounts.proposal;
    if is_new_position {
        proposal.track2_endorser_count = proposal
            .track2_endorser_count
            .checked_add(1)
            .ok_or(StreamPumpError::MathOverflow)?;
    }
    proposal.total_spump_staked = checked_add(proposal.total_spump_staked, args.amount)?;

    emit!(EndorsementCreated {
        proposal: proposal_key,
        user: ctx.accounts.user.key(),
        amount: args.amount,
        total_staked: proposal.total_spump_staked,
        endorser_count: proposal.track2_endorser_count,
    });

    Ok(())
}
