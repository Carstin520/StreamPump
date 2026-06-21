use anchor_lang::prelude::*;

pub const MAX_HANDLE_LEN: usize = 32;
pub const MAX_CANONICAL_URL_LEN: usize = 240;
pub const MAX_ORGANIZATION_NAME_LEN: usize = 48;
pub const DEFAULT_CREATOR_LEVEL: u8 = 1;
pub const MIN_PROPOSAL_CREATOR_LEVEL: u8 = 2;
pub const DEFAULT_USER_LEVEL: u8 = 1;
pub const DEFAULT_S1_RATING_BPS: u16 = 10_000;
pub const MIN_S1_RATING_BPS: u16 = 5_000;
pub const MAX_S1_RATING_BPS: u16 = 20_000;
pub const MAX_S1_RATING_DAILY_DELTA_BPS: u16 = 1_000;
pub const DEFAULT_S1_GRADUATION_TARGET_SUPPLY: u64 = 2_500;
pub const S1_RATING_UPDATE_COOLDOWN_SECONDS: i64 = 86_400;
pub const DEFAULT_S1_RATING_EFFECTIVE_DELAY_SECONDS: i64 = 86_400;
pub const DEFAULT_NEW_USER_EMISSION_BPS: u16 = 2_500;
pub const DEFAULT_NEW_USER_EMISSION_WINDOW_SECONDS: i64 = 7 * 86_400;
pub const DEFAULT_S1_MIN_USER_XP: u64 = 10;
pub const DEFAULT_MAX_S1_DAILY_BUY_SPUMP: u64 = 15_000_000;
pub const DEFAULT_S1_EARLY_COHORT_SUPPLY_THRESHOLD: u64 = 500;
pub const DEFAULT_S1_EARLY_COHORT_BUYOUT_CAP_BPS: u16 = 2_000;
pub const DEFAULT_S1_RAGE_QUIT_WINDOW_SECONDS: i64 = 48 * 3_600;
pub const DEFAULT_MAX_ENDORSEMENT_HARD_CEILING: u64 = 1_000_000_000;
pub const DEFAULT_S1_BUYOUT_CREATOR_SHARE_BPS: u16 = 8_000;
pub const DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC: u64 = 100_000_000;
pub const DEFAULT_S1_STATUS_THANKYOU_USDC: u64 = 10_000_000;
pub const DEFAULT_S1_DISCOVERY_MIN_HOLD_SECONDS: i64 = 0;
pub const DEFAULT_S1_DISCOVERY_CLAIM_WINDOW_SECONDS: i64 = 2_592_000;
pub const DEFAULT_TRACK2_REWARD_CAP_USDC: u64 = 100_000_000;
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum S1BuyoutRewardModel {
    FlatEqual = 0,
    EarlinessTiered = 1,
    StatusPrimary = 2,
}

impl S1BuyoutRewardModel {
    pub const DEFAULT: u8 = S1BuyoutRewardModel::EarlinessTiered as u8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ResidualDestination {
    Creator = 0,
    Sponsor = 1,
}

impl ResidualDestination {
    pub const S1_DEFAULT: u8 = ResidualDestination::Creator as u8;
    pub const TRACK2_DEFAULT: u8 = ResidualDestination::Sponsor as u8;
}

#[allow(non_camel_case_types)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CreatorStatus {
    S1_Active = 0,
    S1_Auction_Pending = 1,
    S1_Execution_Pending = 2,
    S2_Active = 3,
    Suspended = 4,
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
    pub daily_spump_emission_multiplier_bps: u16,
    pub new_user_emission_bps: u16,
    pub new_user_emission_window_seconds: i64,
    pub s1_min_user_xp: u64,
    pub max_s1_daily_buy_spump: u64,
    pub s1_early_cohort_supply_threshold: u64,
    pub s1_early_cohort_buyout_cap_bps: u16,
    pub min_creator_rating_bps: u16,
    pub max_creator_rating_bps: u16,
    pub max_creator_rating_daily_delta_bps: u16,
    pub s1_rating_effective_delay_seconds: i64,
    pub default_s1_graduation_target_supply: u64,
    pub s1_rage_quit_window_seconds: i64,
    pub s2_min_followers: u64,
    pub s2_min_valid_views: u64,
    /// Protocol-level total endorsement ceiling for proposals with max_endorsement_spump == 0.
    /// 0 means truly uncapped by explicit admin intent.
    pub max_endorsement_hard_ceiling: u64,
    /// Maximum endorsement per user as basis points of proposal's max_endorsement_spump (e.g. 2000 = 20%).
    pub max_endorsement_per_user_bps: u16,
    /// S1 buyout USDC share paid directly to the creator at graduation.
    pub s1_buyout_creator_share_bps: u16,
    /// S1 discovery reward model: 0=FlatEqual, 1=EarlinessTiered, 2=StatusPrimary.
    pub s1_buyout_reward_model: u8,
    /// Maximum S1 discovery reward any one backer can receive, in raw USDC units.
    pub s1_discovery_reward_cap_usdc: u64,
    /// Fixed thank-you amount for StatusPrimary model, in raw USDC units.
    pub s1_status_thankyou_usdc: u64,
    /// Destination for unclaimed S1 discovery-pool residual: 0=creator, 1=sponsor.
    pub s1_buyout_residual_to: u8,
    /// Minimum seconds a backer must hold before qualifying for discovery reward.
    pub s1_discovery_min_hold_seconds: i64,
    /// Seconds after graduation before oracle/admin may sweep unclaimed discovery rewards.
    pub s1_discovery_claim_window_seconds: i64,
    /// Maximum Track2 fan reward any one endorser can receive, in raw USDC units.
    pub track2_reward_cap_usdc: u64,
    /// Destination for unclaimed Track2 fan-pool residual: 0=creator, 1=sponsor.
    pub track2_residual_to: u8,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const INIT_SPACE: usize = 32
        + 32
        + 32
        + 32
        + 1
        + 8
        + 2
        + 2
        + 8
        + 2
        + 2
        + 8
        + 8
        + 8
        + 8
        + 2
        + 2
        + 2
        + 2
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 2
        + 2
        + 1
        + 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 1
        + 1;
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
    /// Portion of current S1 supply bought before the configured early-cohort threshold.
    pub s1_early_cohort_supply: u64,
    /// Chain-maintained count of S1 positions with internal_token_balance > 0.
    pub s1_eligible_holder_count: u32,
    /// Chain-maintained count of eligible positions with any early-cohort balance.
    pub s1_early_holder_count: u32,
    /// Chain-maintained count of eligible positions without early-cohort balance.
    pub s1_regular_holder_count: u32,
    /// Creator quality/momentum multiplier in basis points. 10_000 = 1.0x.
    pub s1_rating_bps: u16,
    /// Supply target used by read models to estimate graduation/buyout progress.
    pub s1_graduation_target_supply: u64,
    /// Pending rating scheduled by oracle; 0 means no pending rating.
    pub pending_s1_rating_bps: u16,
    pub pending_s1_graduation_target_supply: u64,
    pub pending_rating_effective_at: i64,
    pub pending_rating_report_digest: [u8; 32],
    /// Last oracle rating update timestamp.
    pub last_rating_update_at: i64,
    /// Digest of the latest off-chain rating report.
    pub last_rating_report_digest: [u8; 32],
    pub last_upgrade_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl CreatorProfile {
    pub const INIT_SPACE: usize = 32
        + 4
        + MAX_HANDLE_LEN
        + 32
        + 1
        + 1
        + 8
        + 8
        + 4
        + 4
        + 4
        + 2
        + 8
        + 2
        + 8
        + 8
        + 32
        + 8
        + 32
        + 8
        + 8
        + 8
        + 1;
}

#[account]
pub struct UserProfile {
    pub authority: Pubkey,
    pub level: u8,
    pub role_flags: u16,
    pub xp: u64,
    pub activity_score: u64,
    pub last_daily_claim_at: i64,
    pub daily_claim_streak: u16,
    pub total_spump_earned: u64,
    pub last_reward_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl UserProfile {
    pub const INIT_SPACE: usize = 32 + 1 + 2 + 8 + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 1;
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
    /// Monotonically increasing version counter; starts at 1 for new anchors.
    pub version: u32,
}

impl ContentHashAnchor {
    pub const INIT_SPACE: usize = 32 + 32 + 4 + MAX_CANONICAL_URL_LEN + 32 + 32 + 8 + 1 + 4;
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
    /// Immutable Track 2 fan pool snapshot fixed at settlement time.
    pub track2_initial_fan_pool: u64,
    /// Immutable SPUMP stake snapshot fixed at settlement time.
    pub track2_initial_spump_staked: u64,
    /// Immutable per-user Track2 fan reward cap snapshot fixed at settlement time.
    pub track2_reward_cap_usdc: u64,
    /// Residual destination snapshot for remaining Track2 fan-pool USDC.
    pub track2_residual_to: u8,
    /// Track2 fan reward model snapshot; v1 uses FlatEqual.
    pub track2_reward_model_snapshot: u8,

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
    /// Nonce to allow multiple proposals with the same creator and deadline.
    pub nonce: u64,
    /// Maximum total SPUMP endorsement for this proposal (0 = uncapped).
    pub max_endorsement_spump: u64,
}

impl Proposal {
    pub const INIT_SPACE: usize = 32
        + 33
        + 1
        + 32
        + 33
        + 8
        + 1
        + 1
        + 8
        + 2
        + 8
        + 9
        + 8
        + 4
        + 4
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1
        + 1
        + 9
        + 2
        + 8
        + 8
        + 1
        + 1
        + 8
        + 1
        + 8
        + 8;
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
    pub early_cohort_balance: u64,
    pub spump_cost_basis: u64,
    pub first_bought_at: i64,
    pub last_buy_day: i64,
    pub daily_bought_spump: u64,
    pub bump: u8,
}

impl S1UserPosition {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct S1BuyoutState {
    pub creator: Pubkey,
    pub winning_sponsor: Option<Pubkey>,
    pub usdc_deposited: u64,
    /// USDC paid directly to the creator when graduation executes.
    pub creator_payout_usdc: u64,
    /// Total capped discovery reward pool reserved for qualified backers.
    pub discovery_pool_usdc: u64,
    /// Remaining discovery-pool USDC after capped, non-proportional claims.
    pub discovery_pool_remaining: u64,
    /// Remaining qualified backer count; this is a holder count, not stake/supply.
    pub eligible_holder_count: u32,
    /// Remaining qualified early-cohort holder count.
    pub early_holder_count: u32,
    /// Remaining qualified regular holder count.
    pub regular_holder_count: u32,
    /// Reward model snapshotted at acceptance/graduation.
    pub reward_model_snapshot: u8,
    /// Residual destination snapshotted for this buyout: 0=creator, 1=sponsor.
    pub residual_to_snapshot: u8,
    /// Per-user discovery reward cap snapshotted for this buyout.
    pub discovery_reward_cap_usdc_snapshot: u64,
    /// StatusPrimary thank-you amount snapshotted for this buyout.
    pub status_thankyou_usdc_snapshot: u64,
    /// Minimum hold duration snapshotted for this buyout.
    pub discovery_min_hold_seconds_snapshot: i64,
    /// True once the creator's direct USDC payout has been transferred.
    pub creator_paid: bool,
    /// Graduation timestamp used to enforce the discovery reward claim window.
    pub graduated_at: i64,
    /// Remaining USDC claimable by S1 holders after graduation.
    pub claimable_usdc_remaining: u64,
    /// Remaining virtual S1 supply still entitled to the buyout proceeds.
    pub claimable_s1_supply_remaining: u64,
    pub early_claimable_usdc_remaining: u64,
    pub early_claimable_s1_supply_remaining: u64,
    pub regular_claimable_usdc_remaining: u64,
    pub regular_claimable_s1_supply_remaining: u64,
    pub rage_quit_deadline: i64,
    pub bump: u8,
}

impl S1BuyoutState {
    pub const INIT_SPACE: usize = 32
        + 33
        + 8
        + 8
        + 8
        + 8
        + 4
        + 4
        + 4
        + 1
        + 1
        + 8
        + 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;
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
