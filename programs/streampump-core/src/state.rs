use anchor_lang::prelude::*;

pub const MAX_HANDLE_LEN: usize = 32;
pub const MAX_CANONICAL_URL_LEN: usize = 240;
pub const MAX_ORGANIZATION_NAME_LEN: usize = 48;
pub const DEFAULT_CREATOR_LEVEL: u8 = 1;
pub const MIN_PROPOSAL_CREATOR_LEVEL: u8 = 2;
pub const DEFAULT_USER_LEVEL: u8 = 1;
pub const USER_ROLE_FAN: u16 = 1 << 0;
pub const USER_ROLE_CREATOR: u16 = 1 << 1;
pub const USER_ROLE_SPONSOR_OPERATOR: u16 = 1 << 2;
pub const USER_ROLE_MCN_OPERATOR: u16 = 1 << 3;
pub const VALID_USER_ROLE_MASK: u16 =
    USER_ROLE_FAN | USER_ROLE_CREATOR | USER_ROLE_SPONSOR_OPERATOR | USER_ROLE_MCN_OPERATOR;

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

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ProposalMetricType {
    Views = 0,
    Clicks = 1,
    Saves = 2,
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ProposalContentKind {
    ShortVideo = 0,
    ImageCarousel = 1,
    MixedMediaNote = 2,
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum UserMissionType {
    DailySession5Min = 0,
    Like10Posts = 1,
    Follow3Creators = 2,
    Share1Post = 3,
    PublishFirstPost = 4,
    CompleteProfile = 5,
    SponsorCampaignReview = 6,
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrganizationType {
    CreatorOpc = 0,
    SponsorBrand = 1,
    McnAgency = 2,
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrganizationMemberRole {
    Owner = 0,
    Admin = 1,
    Finance = 2,
    CampaignOperator = 3,
    TalentManager = 4,
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
pub struct UserProfile {
    pub authority: Pubkey,
    pub level: u8,
    pub role_flags: u16,
    pub xp: u64,
    pub last_daily_claim_at: i64,
    pub daily_claim_streak: u16,
    pub total_spump_earned: u64,
    pub last_reward_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl UserProfile {
    pub const INIT_SPACE: usize = 32 + 1 + 2 + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 1;
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
    /// Xiaohongshu-like content type: short video, image set, or mixed media note.
    pub content_kind: ProposalContentKind,
    /// Canonical content-package digest. For mixed posts this should hash a manifest
    /// that includes ordered media digests plus the note text digest.
    pub content_hash: [u8; 32],
    /// Optional on-chain content anchor reference when the creator has anchored the post.
    pub content_anchor: Option<Pubkey>,

    // Track 1: Fixed Base Pay (Creator Only)
    pub track1_base_usdc: u64,
    pub track1_claimed: bool,

    // Track 2: Performance Deal (Creator + Fans)
    pub track2_metric_type: ProposalMetricType,
    pub track2_target_value: u64,
    pub track2_min_achievement_bps: u16,
    pub track2_usdc_deposited: u64,
    pub track2_actual_value: Option<u64>,
    pub track2_settled_at: i64,
    /// Number of unique endorsers that ever joined Track 2.
    pub track2_endorser_count: u32,
    /// Number of endorsement positions still pending post-settlement execution.
    pub track2_unsettled_endorser_count: u32,
    /// Remaining SPUMP stake basis used for exact batched payout distribution.
    pub track2_unsettled_spump: u64,

    // Track 3: CPS Sales (Creator Only)
    pub track3_usdc_deposited: u64,
    pub track3_cps_payout: Option<u64>,
    pub track3_delay_days: u16,
    pub track3_settled_at: i64,

    // General
    pub deadline: i64,
    pub status: ProposalStatus,
    pub usdc_vault_bump: u8,
    pub total_spump_staked: u64,
    pub bump: u8,
}

impl Proposal {
    pub const INIT_SPACE: usize =
        32 + 33 + 1 + 32 + 33 + 8 + 1 + 1 + 8 + 2 + 8 + 9 + 8 + 4 + 4 + 8 + 8 + 9 + 2 + 8
            + 8 + 1 + 1 + 8 + 1;
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
    /// Remaining USDC claimable by S1 holders after graduation.
    pub claimable_usdc_remaining: u64,
    /// Remaining virtual S1 supply still entitled to the buyout proceeds.
    pub claimable_s1_supply_remaining: u64,
    pub rage_quit_deadline: i64,
    pub bump: u8,
}

impl S1BuyoutState {
    pub const INIT_SPACE: usize = 32 + 33 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct S1BuyoutOffer {
    pub sponsor: Pubkey,
    pub creator: Pubkey,
    pub usdc_amount: u64,
    pub created_at: i64,
    pub sponsor_cancel_after: i64,
    pub bump: u8,
}

impl S1BuyoutOffer {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 8 + 8 + 1;
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

#[account]
pub struct UserRewardReceipt {
    pub user_profile: Pubkey,
    pub user: Pubkey,
    pub mission_type: UserMissionType,
    pub reward_amount: u64,
    pub xp_gain: u64,
    pub previous_level: u8,
    pub new_level: u8,
    pub report_id: [u8; 32],
    pub report_digest: [u8; 32],
    pub observed_at: i64,
    pub claimed_at: i64,
    pub bump: u8,
}

impl UserRewardReceipt {
    pub const INIT_SPACE: usize = 32 + 32 + 1 + 8 + 8 + 1 + 1 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct Organization {
    pub owner: Pubkey,
    pub organization_type: OrganizationType,
    pub organization_seed: [u8; 32],
    pub display_name: String,
    pub payout_usdc_ata: Pubkey,
    pub metadata_digest: [u8; 32],
    pub member_count: u16,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl Organization {
    pub const INIT_SPACE: usize =
        32 + 1 + 32 + 4 + MAX_ORGANIZATION_NAME_LEN + 32 + 32 + 2 + 8 + 8 + 1;
}

#[account]
pub struct OrganizationMembership {
    pub organization: Pubkey,
    pub user: Pubkey,
    pub role: OrganizationMemberRole,
    pub active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl OrganizationMembership {
    pub const INIT_SPACE: usize = 32 + 32 + 1 + 1 + 8 + 8 + 1;
}
