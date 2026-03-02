use anchor_lang::prelude::*;

pub const MAX_HANDLE_LEN: usize = 32;
pub const MAX_CANONICAL_URL_LEN: usize = 240;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CampaignStatus {
    Open = 0,
    Settled = 1,
    ExpiredRefunded = 2,
}

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub spump_mint: Pubkey,
    pub min_sponsor_burn_bps: u16,
    pub default_predictor_pool_bps: u16,
    pub max_campaign_duration_seconds: i64,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 32 + 2 + 2 + 8 + 1;
}

#[account]
pub struct CreatorProfile {
    pub authority: Pubkey,
    pub handle: String,
    pub payout_usdc_ata: Pubkey,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl CreatorProfile {
    pub const INIT_SPACE: usize = 32 + 4 + MAX_HANDLE_LEN + 32 + 8 + 8 + 1;
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
pub struct CampaignEscrow {
    pub sponsor: Pubkey,
    pub creator_profile: Pubkey,
    pub usdc_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub campaign_id: u64,
    pub target_view_count: u64,
    pub deadline_ts: i64,
    pub total_deposited: u64,
    pub predictor_pool_bps: u16,
    pub creator_success_payout_bps: u16,
    pub spump_burned_for_inventory: u64,
    pub oracle_reported: bool,
    pub oracle_final_views: u64,
    pub oracle_outcome_yes: bool,
    pub oracle_request_id: [u8; 32],
    pub oracle_report_digest: [u8; 32],
    pub oracle_reported_at: i64,
    pub settled_at: i64,
    pub market: Pubkey,
    pub status: CampaignStatus,
    pub vault_authority_bump: u8,
    pub bump: u8,
}

impl CampaignEscrow {
    pub const INIT_SPACE: usize = 320;
}

#[account]
pub struct TrafficMarket {
    pub campaign: Pubkey,
    pub spump_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub spump_stake_vault: Pubkey,
    pub usdc_rewards_vault: Pubkey,
    pub close_ts: i64,
    pub yes_total_stake: u64,
    pub no_total_stake: u64,
    pub rewards_usdc_total: u64,
    pub rewards_usdc_distributed: u64,
    pub stakes_redeemed_total: u64,
    pub resolved: bool,
    pub outcome_yes: bool,
    pub voided: bool,
    pub loser_burned: bool,
    pub vault_authority_bump: u8,
    pub bump: u8,
}

impl TrafficMarket {
    pub const INIT_SPACE: usize = 224;
}

#[account]
pub struct BetPosition {
    pub market: Pubkey,
    pub user: Pubkey,
    pub yes_stake: u64,
    pub no_stake: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl BetPosition {
    pub const INIT_SPACE: usize = 96;
}
