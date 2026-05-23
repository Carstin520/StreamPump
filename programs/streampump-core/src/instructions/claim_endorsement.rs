// ────────────────────────────────────────────────────────────────────────────────
// claim_endorsement.rs
// EN: Permissionless settlement execution for an endorsement position.
//     After Track 2 is settled, anyone can execute settlement for an endorser:
//     - Resolved_Success: 100% SPUMP principal minted back + pro-rata share
//       of the Track 2 fan pool (20% of achieved budget).
//     - Resolved_Fail: 95% SPUMP minted back; 5% permanently unissued (deflation).
//     - Cancelled/Voided: 100% SPUMP principal minted back.
//     - Open but expired and unfunded: 100% SPUMP principal minted back.
//     SPUMP is minted (not transferred from a vault) because endorsement burns
//     SPUMP on entry. The protocol_config PDA is the mint authority.
//
// ZH: 背书仓位的免签执行结算。
//     Track2 结算完成后，任何人都可以为 Endorser 执行结算：
//     - 成功：100% SPUMP 本金铸回 + 按比例分享 Track2 粉丝池（达成预算的 20%）。
//     - 失败：95% SPUMP 铸回；5% 永久不铸造（通缩）。
//     - 取消/作废：100% SPUMP 本金铸回。
//     - 仍为 Open 但已过期且未获注资：100% SPUMP 本金铸回。
//     SPUMP 通过 mint 而非从 vault 转出——因为背书时已经将 SPUMP 销毁。
//     protocol_config PDA 是 SPUMP 的 mint authority。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer},
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount as InterfaceTokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    events::EndorsementSettled,
    state::{EndorsementPosition, Proposal, ProposalStatus, ProtocolConfig},
    utils::{amount_from_bps, checked_sub},
};

/// EN: Slash percentage for failed endorsements: 5% (500 bps).
///     The slashed 5% is never re-minted, creating permanent supply deflation.
/// ZH: 失败背书的罚没比例：5%（500 基点）。
///     被罚没的 5% 永远不会被重新铸造，实现永久通缩。
pub const FAILED_SLASH_BPS: u16 = 500;

#[derive(Accounts)]
pub struct ClaimEndorsement<'info> {
    /// CHECK: Settlement is permissionless; funds only flow to ATAs owned by this pubkey.
    pub user: UncheckedAccount<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    /// EN: Proposal being claimed against. Resolved Track 2 claims require settlement first;
    ///     expired unfunded proposals can refund principal directly.
    /// ZH: 要领取的提案。已决议的 Track2 必须先完成结算；
    ///     已过期但未注资的提案可直接退还本金。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,

    /// EN: User endorsement position PDA — tracks staked amount and claim status.
    /// ZH: 用户背书仓位 PDA——追踪质押金额和领取状态。
    #[account(
        mut,
        seeds = [b"endorsement", user.key().as_ref(), proposal.key().as_ref()],
        bump = endorsement_position.bump,
        constraint = endorsement_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = endorsement_position.proposal == proposal.key() @ StreamPumpError::ProposalAccountMismatch
    )]
    pub endorsement_position: Box<Account<'info, EndorsementPosition>>,

    /// EN: User SPUMP ATA — receives minted SPUMP principal/refund (Token-2022).
    /// ZH: 用户 SPUMP 关联代币账户——接收铸造返还的 SPUMP 本金（Token-2022）。
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: Box<InterfaceAccount<'info, InterfaceTokenAccount>>,

    /// EN: Token-2022 SPUMP mint — protocol_config PDA is its mint authority.
    /// ZH: Token-2022 SPUMP mint——protocol_config PDA 是其铸造权限。
    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

    /// EN: User USDC ATA — receives Track 2 success rewards.
    /// ZH: 用户 USDC 关联代币账户——接收 Track2 成功奖励。
    #[account(
        mut,
        constraint = user_usdc_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// EN: Proposal USDC vault PDA — holds the Track 2 fan pool after settlement.
    /// ZH: 提案 USDC 金库 PDA——结算后持有 Track2 粉丝池。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Box<Account<'info, TokenAccount>>,

    pub usdc_token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<ClaimEndorsement>) -> Result<()> {
    let proposal_status = ctx.accounts.proposal.status;
    let track2_settled_at = ctx.accounts.proposal.track2_settled_at;
    let now = Clock::get()?.unix_timestamp;
    let expired_open_refund =
        matches!(proposal_status, ProposalStatus::Open) && now >= ctx.accounts.proposal.deadline;

    let staked_amount = {
        let position = &ctx.accounts.endorsement_position;
        // EN: Each position can only be settled once.
        // ZH: 每个仓位只能结算一次。
        require!(!position.claimed, StreamPumpError::PositionAlreadyClaimed);
        require!(position.staked_amount > 0, StreamPumpError::InvalidAmount);
        position.staked_amount
    };

    // EN: For resolved outcomes, Track 2 must be settled before claims.
    // ZH: 对于已决议的结果，Track2 必须在领取前完成结算。
    if matches!(
        proposal_status,
        ProposalStatus::Resolved_Success | ProposalStatus::Resolved_Fail
    ) {
        require!(track2_settled_at > 0, StreamPumpError::ProposalNotSettled);
    }

    // EN: Build PDA signers for both proposal (USDC vault) and protocol (SPUMP mint).
    // ZH: 构造提案 PDA 签名（USDC 金库转出）和协议 PDA 签名（SPUMP 铸造）。
    let spump_refund;
    let mut usdc_reward = 0u64;
    let proposal_creator = ctx.accounts.proposal.creator;
    let deadline_bytes = ctx.accounts.proposal.deadline.to_le_bytes();
    let proposal_bump_bytes = [ctx.accounts.proposal.bump];
    let proposal_account_info = ctx.accounts.proposal.to_account_info();
    let proposal_signer_seeds: [&[u8]; 4] = [
        b"proposal",
        proposal_creator.as_ref(),
        deadline_bytes.as_ref(),
        proposal_bump_bytes.as_ref(),
    ];
    let proposal_signer: &[&[&[u8]]] = &[&proposal_signer_seeds];

    let protocol_bump_bytes = [ctx.accounts.protocol_config.bump];
    let protocol_signer_seeds: [&[u8]; 2] = [b"protocol_config", protocol_bump_bytes.as_ref()];
    let protocol_signer: &[&[&[u8]]] = &[&protocol_signer_seeds];

    match proposal_status {
        ProposalStatus::Resolved_Success => {
            // ────────────────────────────────────────────────────────────────
            // EN: SUCCESS PATH:
            //     1. Mint 100% SPUMP principal back to user.
            //     2. Calculate pro-rata USDC reward from the Track 2 fan pool:
            //        reward = staked_amount × fan_pool / total_spump_staked
            //     3. Transfer USDC reward from proposal vault to user.
            //
            // ZH: 成功路径：
            //     1. 向用户铸回 100% SPUMP 本金。
            //     2. 按比例计算 Track2 粉丝池的 USDC 奖励：
            //        奖励 = 质押量 × 粉丝池 / 总质押量
            //     3. 从提案金库向用户转入 USDC 奖励。
            // ────────────────────────────────────────────────────────────────
            token_interface::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.spump_token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.spump_mint.to_account_info(),
                        to: ctx.accounts.user_spump_ata.to_account_info(),
                        authority: ctx.accounts.protocol_config.to_account_info(),
                    },
                    protocol_signer,
                ),
                staked_amount,
            )?;
            spump_refund = staked_amount;

            let proposal = &mut ctx.accounts.proposal;
            require!(
                proposal.track2_unsettled_endorser_count > 0,
                StreamPumpError::InvalidAmount
            );

            usdc_reward = if proposal.track2_unsettled_endorser_count == 1 {
                proposal.track2_usdc_deposited
            } else if proposal.track2_initial_spump_staked == 0
                || proposal.track2_initial_fan_pool == 0
                || proposal.track2_usdc_deposited == 0
            {
                0
            } else {
                let numerator = (staked_amount as u128)
                    .checked_mul(proposal.track2_initial_fan_pool as u128)
                    .ok_or(StreamPumpError::MathOverflow)?;
                let quotient = numerator
                    .checked_div(proposal.track2_initial_spump_staked as u128)
                    .ok_or(StreamPumpError::MathOverflow)?;
                let reward =
                    u64::try_from(quotient).map_err(|_| error!(StreamPumpError::MathOverflow))?;
                std::cmp::min(reward, proposal.track2_usdc_deposited)
            };

            if usdc_reward > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.usdc_token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                            to: ctx.accounts.user_usdc_ata.to_account_info(),
                            authority: proposal_account_info.clone(),
                        },
                        proposal_signer,
                    ),
                    usdc_reward,
                )?;
            }

            proposal.track2_usdc_deposited =
                checked_sub(proposal.track2_usdc_deposited, usdc_reward)?;
            proposal.track2_unsettled_spump =
                checked_sub(proposal.track2_unsettled_spump, staked_amount)?;
            proposal.track2_unsettled_endorser_count = proposal
                .track2_unsettled_endorser_count
                .checked_sub(1)
                .ok_or(StreamPumpError::MathOverflow)?;
        }
        ProposalStatus::Resolved_Fail => {
            // ────────────────────────────────────────────────────────────────
            // EN: FAIL PATH:
            //     Mint only 95% SPUMP back. The remaining 5% is never minted,
            //     achieving permanent supply deflation without needing a
            //     burn/treasury ATA.
            //
            // ZH: 失败路径：
            //     只铸回 95% SPUMP。剩余 5% 永远不会被铸造，
            //     无需 burn/treasury ATA 即实现永久通缩。
            // ────────────────────────────────────────────────────────────────
            let slash_amount = amount_from_bps(staked_amount, FAILED_SLASH_BPS)?;
            let refund_amount = checked_sub(staked_amount, slash_amount)?;
            spump_refund = refund_amount;

            if refund_amount > 0 {
                token_interface::mint_to(
                    CpiContext::new_with_signer(
                        ctx.accounts.spump_token_program.to_account_info(),
                        MintTo {
                            mint: ctx.accounts.spump_mint.to_account_info(),
                            to: ctx.accounts.user_spump_ata.to_account_info(),
                            authority: ctx.accounts.protocol_config.to_account_info(),
                        },
                        protocol_signer,
                    ),
                    refund_amount,
                )?;
            }

            let proposal = &mut ctx.accounts.proposal;
            if proposal.track2_unsettled_endorser_count > 0 {
                proposal.track2_unsettled_endorser_count = proposal
                    .track2_unsettled_endorser_count
                    .checked_sub(1)
                    .ok_or(StreamPumpError::MathOverflow)?;
            }
            if proposal.track2_unsettled_spump > 0 {
                proposal.track2_unsettled_spump =
                    checked_sub(proposal.track2_unsettled_spump, staked_amount)?;
            }
        }
        ProposalStatus::Cancelled | ProposalStatus::Voided => {
            // EN: CANCEL/VOID PATH: Mint 100% SPUMP principal back (neutral).
            // ZH: 取消/作废路径：铸回 100% SPUMP 本金（中性操作）。
            token_interface::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.spump_token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.spump_mint.to_account_info(),
                        to: ctx.accounts.user_spump_ata.to_account_info(),
                        authority: ctx.accounts.protocol_config.to_account_info(),
                    },
                    protocol_signer,
                ),
                staked_amount,
            )?;
            spump_refund = staked_amount;

            let proposal = &mut ctx.accounts.proposal;
            if proposal.track2_unsettled_endorser_count > 0 {
                proposal.track2_unsettled_endorser_count = proposal
                    .track2_unsettled_endorser_count
                    .checked_sub(1)
                    .ok_or(StreamPumpError::MathOverflow)?;
            }
            if proposal.track2_unsettled_spump > 0 {
                proposal.track2_unsettled_spump =
                    checked_sub(proposal.track2_unsettled_spump, staked_amount)?;
            }
        }
        ProposalStatus::Open if expired_open_refund => {
            // EN: EXPIRED-OPEN PATH: the proposal never reached settlement,
            //     but the deadline has passed so endorsements must be refundable.
            // ZH: 已过期的 Open 路径：提案未进入结算，但截止时间已过，
            //     背书本金必须可退。
            token_interface::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.spump_token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.spump_mint.to_account_info(),
                        to: ctx.accounts.user_spump_ata.to_account_info(),
                        authority: ctx.accounts.protocol_config.to_account_info(),
                    },
                    protocol_signer,
                ),
                staked_amount,
            )?;
            spump_refund = staked_amount;
        }
        _ => return err!(StreamPumpError::ProposalNotClaimable),
    }

    ctx.accounts.endorsement_position.claimed = true;

    emit!(EndorsementSettled {
        proposal: ctx.accounts.proposal.key(),
        user: ctx.accounts.user.key(),
        staked_amount,
        spump_refund,
        usdc_reward,
        status: proposal_status as u8,
        claimed: ctx.accounts.endorsement_position.claimed,
    });

    Ok(())
}
