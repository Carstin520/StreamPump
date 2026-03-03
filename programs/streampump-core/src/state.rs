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
pub enum CreatorUpgradeMetric {
    Followers = 0,
    ValidViews = 1,
}

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub spump_mint: Pubkey,
    pub max_proposal_duration_seconds: i64,
    pub s2_min_followers: u64,
    pub s2_min_valid_views: u64,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct CreatorProfile {
    pub authority: Pubkey,
    pub handle: String,
    pub payout_usdc_ata: Pubkey,
    pub level: u8,
    pub last_upgrade_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl CreatorProfile {
    pub const INIT_SPACE: usize = 32 + 4 + MAX_HANDLE_LEN + 32 + 1 + 8 + 8 + 8 + 1;
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
    pub spump_vault_bump: u8,
    pub total_spump_staked: u64,
    pub sponsor_usdc_deposited: u64,
    pub actual_views: Option<u64>,
    pub settled_at: i64,
    pub bump: u8,
}

impl Proposal {
    pub const INIT_SPACE: usize = 32 + 33 + 8 + 8 + 1 + 1 + 1 + 8 + 8 + 9 + 8 + 1;
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
