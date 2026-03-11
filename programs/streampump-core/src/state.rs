use anchor_lang::prelude::*;

pub const MAX_HANDLE_LEN: usize = 32;
pub const MAX_CANONICAL_URL_LEN: usize = 240;
pub const DEFAULT_CREATOR_LEVEL: u8 = 1;
pub const MIN_PROPOSAL_CREATOR_LEVEL: u8 = 2;

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ProposalStatus {
    Open = 0,
    Funded = 1,
    Resolved_Success = 2,
    Resolved_Fail = 3,
    Cancelled = 4,
    Voided = 5,
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CreatorStatus {
    S1_Active = 0,
    S1_Auction_Pending = 1,
    S1_Execution_Pending = 2,
    S2_Active = 3,
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CreatorUpgradeMetric {
    Followers = 0,
    ValidViews = 1,
}

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    /// Token-2022 SPUMP mint (NonTransferable utility token).
    pub spump_mint: Pubkey,
    /// Bump for protocol mint authority PDA used to mint SPUMP refunds/rewards.
    pub spump_mint_bump: u8,
    pub max_proposal_duration_seconds: i64,
    pub max_exit_tax_bps: u16,
    pub min_exit_tax_bps: u16,
    pub tax_decay_threshold_supply: u64,
    pub s2_min_followers: u64,
    pub s2_min_valid_views: u64,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 32 + 1 + 8 + 2 + 2 + 8 + 8 + 8 + 1;
}

#[account]
pub struct CreatorProfile {
    pub authority: Pubkey,
    pub handle: String,
    pub payout_usdc_ata: Pubkey,
    pub level: u8,
    pub status: CreatorStatus,
    /// Virtual S1 internal token supply; backing SPUMP is burned on buy.
    pub s1_supply: u64,
    pub last_upgrade_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl CreatorProfile {
    pub const INIT_SPACE: usize = 32 + 4 + MAX_HANDLE_LEN + 32 + 1 + 1 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct ContentHashAnchor {
    pub creator_profile: Pubkey,
    pub authority: Pubkey,
    pub canonical_url: String,
    pub url_digest: [u8; 32],
    pub content_digest: [u8; 32],
    pub anchored_at: i64,
    pub bump: u8,
}

impl ContentHashAnchor {
    pub const INIT_SPACE: usize = 32 + 32 + 4 + MAX_CANONICAL_URL_LEN + 32 + 32 + 8 + 1;
}

#[account]
pub struct Proposal {
    pub creator: Pubkey,
    pub sponsor: Option<Pubkey>,
    pub target_views: u64,
    pub deadline: i64,
    pub status: ProposalStatus,
    pub usdc_vault_bump: u8,
    /// Virtual SPUMP stake ledger; actual SPUMP is burned at endorsement time.
    pub total_spump_staked: u64,
    pub sponsor_usdc_deposited: u64,
    pub actual_views: Option<u64>,
    pub settled_at: i64,
    pub bump: u8,
}

impl Proposal {
    pub const INIT_SPACE: usize = 32 + 33 + 8 + 8 + 1 + 1 + 8 + 8 + 9 + 8 + 1;
}

#[account]
pub struct EndorsementPosition {
    pub user: Pubkey,
    pub proposal: Pubkey,
    pub staked_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl EndorsementPosition {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 1 + 1;
}

#[account]
pub struct S1UserPosition {
    pub user: Pubkey,
    pub creator: Pubkey,
    pub internal_token_balance: u64,
    pub spump_cost_basis: u64,
    pub bump: u8,
}

impl S1UserPosition {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct S1BuyoutState {
    pub creator: Pubkey,
    pub winning_sponsor: Option<Pubkey>,
    pub usdc_deposited: u64,
    pub rage_quit_deadline: i64,
    pub bump: u8,
}

impl S1BuyoutState {
    pub const INIT_SPACE: usize = 32 + 33 + 8 + 8 + 1;
}

#[account]
pub struct S1BuyoutOffer {
    pub sponsor: Pubkey,
    pub creator: Pubkey,
    pub usdc_amount: u64,
    pub bump: u8,
}

impl S1BuyoutOffer {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 1 + 8;
}

#[account]
pub struct UpgradeReceipt {
    pub creator_profile: Pubkey,
    pub upgraded_by: Pubkey,
    pub previous_level: u8,
    pub new_level: u8,
    pub metric_type: CreatorUpgradeMetric,
    pub metric_value: u64,
    pub report_id: [u8; 32],
    pub report_digest: [u8; 32],
    pub observed_at: i64,
    pub upgraded_at: i64,
    pub bump: u8,
}

impl UpgradeReceipt {
    pub const INIT_SPACE: usize = 32 + 32 + 1 + 1 + 1 + 8 + 32 + 32 + 8 + 8 + 1;
}
