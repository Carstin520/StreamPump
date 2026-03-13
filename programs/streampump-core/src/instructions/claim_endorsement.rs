// ────────────────────────────────────────────────────────────────────────────────
// claim_endorsement.rs
// EN: Endorser pull-claim for SPUMP principal and conditional Track 2 USDC rewards.
//     After Track 2 is settled, endorsers can claim:
//     - Resolved_Success: 100% SPUMP principal minted back + pro-rata share
//       of the Track 2 fan pool (20% of achieved budget).
//     - Resolved_Fail: 95% SPUMP minted back; 5% permanently unissued (deflation).
//     - Cancelled/Voided: 100% SPUMP principal minted back.
//     SPUMP is minted (not transferred from a vault) because endorsement burns
//     SPUMP on entry. The protocol_config PDA is the mint authority.
//
// ZH: Endorser 按需领取 SPUMP 本金及条件性 Track2 USDC 奖励。
//     Track2 结算完成后，Endorser 可领取：
//     - 成功：100% SPUMP 本金铸回 + 按比例分享 Track2 粉丝池（达成预算的 20%）。
//     - 失败：95% SPUMP 铸回；5% 永久不铸造（通缩）。
//     - 取消/作废：100% SPUMP 本金铸回。
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
    /// EN: Endorser claiming funds.
    /// ZH: 领取资金的 Endorser。
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: Proposal being claimed against. Track 2 must be settled first.
    /// ZH: 要领取的提案。Track2 必须先完成结算。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: User endorsement position PDA — tracks staked amount and claim status.
    /// ZH: 用户背书仓位 PDA——追踪质押金额和领取状态。
    #[account(
        mut,
        seeds = [b"endorsement", user.key().as_ref(), proposal.key().as_ref()],
        bump = endorsement_position.bump,
        constraint = endorsement_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = endorsement_position.proposal == proposal.key() @ StreamPumpError::ProposalAccountMismatch
    )]
    pub endorsement_position: Account<'info, EndorsementPosition>,

    /// EN: User SPUMP ATA — receives minted SPUMP principal/refund (Token-2022).
    /// ZH: 用户 SPUMP 关联代币账户——接收铸造返还的 SPUMP 本金（Token-2022）。
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, InterfaceTokenAccount>,

    /// EN: Token-2022 SPUMP mint — protocol_config PDA is its mint authority.
    /// ZH: Token-2022 SPUMP mint——protocol_config PDA 是其铸造权限。
    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

    /// EN: User USDC ATA — receives Track 2 success rewards.
    /// ZH: 用户 USDC 关联代币账户——接收 Track2 成功奖励。
    #[account(
        mut,
        constraint = user_usdc_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    /// EN: Proposal USDC vault PDA — holds the Track 2 fan pool after settlement.
    /// ZH: 提案 USDC 金库 PDA——结算后持有 Track2 粉丝池。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    pub usdc_token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<ClaimEndorsement>) -> Result<()> {
    let proposal_status = ctx.accounts.proposal.status;
    let track2_settled_at = ctx.accounts.proposal.track2_settled_at;

    let position = &mut ctx.accounts.endorsement_position;
    // EN: Each position can only be claimed once.
    // ZH: 每个仓位只能领取一次。
    require!(!position.claimed, StreamPumpError::PositionAlreadyClaimed);
    require!(position.staked_amount > 0, StreamPumpError::InvalidAmount);

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
    let deadline_bytes = ctx.accounts.proposal.deadline.to_le_bytes();
    let proposal_bump_bytes = [ctx.accounts.proposal.bump];
    let proposal_signer_seeds: [&[u8]; 4] = [
        b"proposal",
        ctx.accounts.proposal.creator.as_ref(),
        deadline_bytes.as_ref(),
        proposal_bump_bytes.as_ref(),
    ];
    let proposal_signer: &[&[&[u8]]] = &[&proposal_signer_seeds];

    let protocol_bump_bytes = [ctx.accounts.protocol_config.bump];
    let protocol_signer_seeds: [&[u8]; 2] = [b"protocol_config", protocol_bump_bytes.as_ref()];
    let protocol_signer: &[&[&[u8]]] = &[&protocol_signer_seeds];

    let staked_amount = position.staked_amount;

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

            let usdc_reward = if ctx.accounts.proposal.total_spump_staked == 0
                || ctx.accounts.proposal.track2_usdc_deposited == 0
            {
                0
            } else {
                let numerator = (staked_amount as u128)
                    .checked_mul(ctx.accounts.proposal.track2_usdc_deposited as u128)
                    .ok_or(StreamPumpError::MathOverflow)?;
                let quotient = numerator
                    .checked_div(ctx.accounts.proposal.total_spump_staked as u128)
                    .ok_or(StreamPumpError::MathOverflow)?;
                u64::try_from(quotient).map_err(|_| error!(StreamPumpError::MathOverflow))?
            };

            if usdc_reward > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.usdc_token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                            to: ctx.accounts.user_usdc_ata.to_account_info(),
                            authority: ctx.accounts.proposal.to_account_info(),
                        },
                        proposal_signer,
                    ),
                    usdc_reward,
                )?;
            }
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
        }
        _ => return err!(StreamPumpError::ProposalNotClaimable),
    }

    position.claimed = true;
    Ok(())
}
