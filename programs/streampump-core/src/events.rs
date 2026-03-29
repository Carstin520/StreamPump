use anchor_lang::prelude::*;

#[event]
pub struct ProposalCreated {
    pub proposal: Pubkey,
    pub creator: Pubkey,
    pub payer: Pubkey,
    pub deadline: i64,
    pub content_kind: u8,
    pub content_hash: [u8; 32],
    pub content_anchor: Option<Pubkey>,
    pub track1_base_usdc: u64,
    pub track2_metric_type: u8,
    pub track2_target_value: u64,
    pub track2_min_achievement_bps: u16,
    pub track3_delay_days: u16,
    pub status: u8,
}

#[event]
pub struct ContentAnchored {
    pub content_anchor: Pubkey,
    pub creator_profile: Pubkey,
    pub authority: Pubkey,
    pub payer: Pubkey,
    pub url_digest: [u8; 32],
    pub content_digest: [u8; 32],
    pub anchored_at: i64,
}

#[event]
pub struct ProposalFunded {
    pub proposal: Pubkey,
    pub sponsor: Pubkey,
    pub track1_amount: u64,
    pub track2_amount: u64,
    pub track3_amount: u64,
    pub status: u8,
}

#[event]
pub struct S1BuyoutAuctionOpened {
    pub creator_profile: Pubkey,
    pub creator: Pubkey,
    pub status: u8,
    pub updated_at: i64,
}

#[event]
pub struct S1BuyoutOfferSubmitted {
    pub buyout_offer: Pubkey,
    pub creator_profile: Pubkey,
    pub sponsor: Pubkey,
    pub usdc_amount: u64,
    pub created_at: i64,
    pub sponsor_cancel_after: i64,
}

#[event]
pub struct S1BuyoutOfferAccepted {
    pub creator_profile: Pubkey,
    pub creator: Pubkey,
    pub buyout_offer: Pubkey,
    pub s1_buyout_state: Pubkey,
    pub sponsor: Pubkey,
    pub usdc_amount: u64,
    pub rage_quit_deadline: i64,
    pub status: u8,
}

#[event]
pub struct S1BuyoutOfferReclaimed {
    pub buyout_offer: Pubkey,
    pub creator_profile: Pubkey,
    pub sponsor: Pubkey,
    pub refund_amount: u64,
}

#[event]
pub struct S1BuyoutOfferCancelled {
    pub buyout_offer: Pubkey,
    pub creator_profile: Pubkey,
    pub sponsor: Pubkey,
    pub refund_amount: u64,
}

#[event]
pub struct Track1Settled {
    pub proposal: Pubkey,
    pub creator: Pubkey,
    pub creator_payout: u64,
    pub track1_claimed: bool,
}

#[event]
pub struct EndorsementSettled {
    pub proposal: Pubkey,
    pub user: Pubkey,
    pub staked_amount: u64,
    pub spump_refund: u64,
    pub usdc_reward: u64,
    pub status: u8,
    pub claimed: bool,
}

#[event]
pub struct Track2Settled {
    pub proposal: Pubkey,
    pub sponsor: Pubkey,
    pub creator: Pubkey,
    pub actual_value: u64,
    pub achieved_bps: u16,
    pub creator_payout: u64,
    pub sponsor_refund: u64,
    pub fan_pool_remaining: u64,
    pub status: u8,
    pub settled_at: i64,
}

#[event]
pub struct Track3Settled {
    pub proposal: Pubkey,
    pub sponsor: Pubkey,
    pub creator: Pubkey,
    pub approved_cps_payout: u64,
    pub sponsor_refund: u64,
    pub settled_at: i64,
}

#[event]
pub struct ProposalCancelled {
    pub proposal: Pubkey,
    pub creator: Pubkey,
    pub status: u8,
}

#[event]
pub struct ProposalVoided {
    pub proposal: Pubkey,
    pub admin: Pubkey,
    pub sponsor: Option<Pubkey>,
    pub sponsor_refund: u64,
    pub status: u8,
}

#[event]
pub struct UserProfileRegistered {
    pub authority: Pubkey,
    pub user_profile: Pubkey,
    pub role_flags: u16,
    pub level: u8,
    pub created: bool,
}
