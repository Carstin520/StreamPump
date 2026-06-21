use anchor_lang::prelude::*;
use solana_keccak_hasher::hash as keccak_hash;

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, OrganizationType, ResidualDestination, S1BuyoutRewardModel,
        DEFAULT_S1_RATING_BPS, USER_ROLE_CREATOR, USER_ROLE_MCN_OPERATOR,
        USER_ROLE_SPONSOR_OPERATOR, VALID_USER_ROLE_MASK,
    },
};

/// Linear bonding curve slope factor (k) for S1 internal token pricing.
pub const S1_BONDING_CURVE_K: u64 = 1_000;
/// Protocol-required SPUMP decimals.
pub const SPUMP_DECIMALS: u8 = 6;
/// One whole SPUMP in base units.
pub const ONE_SPUMP: u64 = 1_000_000;

/// Calculate the amount from a base amount and basis points (bps).
/// Formula: amount * bps / 10000
/// 根据基础金额和基点（bps）计算实际金额。公式：金额 * 基点 / 10000
pub fn amount_from_bps(amount: u64, bps: u16) -> Result<u64> {
    let numerator = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(StreamPumpError::MathOverflow)?;

    let scaled = numerator
        .checked_div(10_000)
        .ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(scaled).map_err(|_| error!(StreamPumpError::MathOverflow))
}

/// Safe addition with overflow check. Returns error if overflow occurs.
/// 带溢出检查的安全加法。如果发生溢出则返回错误。
pub fn checked_add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

/// Safe subtraction with underflow check. Returns error if underflow occurs.
/// 带下溢检查的安全减法。如果发生下溢则返回错误。
pub fn checked_sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

fn checked_inc_u32(value: u32) -> Result<u32> {
    value
        .checked_add(1)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

fn checked_dec_u32(value: u32) -> Result<u32> {
    value
        .checked_sub(1)
        .ok_or_else(|| error!(StreamPumpError::HolderCounterUnderflow))
}

fn holder_bucket(balance: u64, early_balance: u64) -> Option<bool> {
    if balance == 0 {
        None
    } else {
        Some(std::cmp::min(early_balance, balance) > 0)
    }
}

fn increment_holder_bucket(creator_profile: &mut CreatorProfile, is_early: bool) -> Result<()> {
    creator_profile.s1_eligible_holder_count =
        checked_inc_u32(creator_profile.s1_eligible_holder_count)?;
    if is_early {
        creator_profile.s1_early_holder_count =
            checked_inc_u32(creator_profile.s1_early_holder_count)?;
    } else {
        creator_profile.s1_regular_holder_count =
            checked_inc_u32(creator_profile.s1_regular_holder_count)?;
    }
    Ok(())
}

fn decrement_holder_bucket(creator_profile: &mut CreatorProfile, is_early: bool) -> Result<()> {
    creator_profile.s1_eligible_holder_count =
        checked_dec_u32(creator_profile.s1_eligible_holder_count)?;
    if is_early {
        creator_profile.s1_early_holder_count =
            checked_dec_u32(creator_profile.s1_early_holder_count)?;
    } else {
        creator_profile.s1_regular_holder_count =
            checked_dec_u32(creator_profile.s1_regular_holder_count)?;
    }
    Ok(())
}

pub fn apply_s1_holder_counter_delta(
    creator_profile: &mut CreatorProfile,
    pre_balance: u64,
    pre_early_balance: u64,
    post_balance: u64,
    post_early_balance: u64,
) -> Result<()> {
    let pre_bucket = holder_bucket(pre_balance, pre_early_balance);
    let post_bucket = holder_bucket(post_balance, post_early_balance);

    match (pre_bucket, post_bucket) {
        (None, None) => {}
        (None, Some(post_is_early)) => increment_holder_bucket(creator_profile, post_is_early)?,
        (Some(pre_is_early), None) => decrement_holder_bucket(creator_profile, pre_is_early)?,
        (Some(pre_is_early), Some(post_is_early)) if pre_is_early != post_is_early => {
            if pre_is_early {
                creator_profile.s1_early_holder_count =
                    checked_dec_u32(creator_profile.s1_early_holder_count)?;
                creator_profile.s1_regular_holder_count =
                    checked_inc_u32(creator_profile.s1_regular_holder_count)?;
            } else {
                creator_profile.s1_regular_holder_count =
                    checked_dec_u32(creator_profile.s1_regular_holder_count)?;
                creator_profile.s1_early_holder_count =
                    checked_inc_u32(creator_profile.s1_early_holder_count)?;
            }
        }
        (Some(_), Some(_)) => {}
    }

    Ok(())
}

pub fn validate_reward_model(model: u8) -> Result<()> {
    require!(
        model == S1BuyoutRewardModel::FlatEqual as u8
            || model == S1BuyoutRewardModel::EarlinessTiered as u8
            || model == S1BuyoutRewardModel::StatusPrimary as u8,
        StreamPumpError::InvalidRewardModel
    );
    Ok(())
}

pub fn validate_residual_destination(destination: u8) -> Result<()> {
    require!(
        destination == ResidualDestination::Creator as u8
            || destination == ResidualDestination::Sponsor as u8,
        StreamPumpError::InvalidResidualDestination
    );
    Ok(())
}

fn min_u64_from_u128(value: u128, cap: u64) -> Result<(u64, bool)> {
    let value_u64 = u64::try_from(value).map_err(|_| error!(StreamPumpError::MathOverflow))?;
    Ok((std::cmp::min(value_u64, cap), value_u64 > cap))
}

pub fn calculate_s1_discovery_reward(
    reward_model: u8,
    discovery_pool_remaining: u64,
    eligible_holder_count: u32,
    early_holder_count: u32,
    regular_holder_count: u32,
    is_early_holder: bool,
    reward_cap_usdc: u64,
    status_thankyou_usdc: u64,
) -> Result<(u64, bool)> {
    validate_reward_model(reward_model)?;
    require!(reward_cap_usdc > 0, StreamPumpError::RewardCapZero);
    if discovery_pool_remaining == 0 || eligible_holder_count == 0 {
        return Ok((0, false));
    }

    let unit = if reward_model == S1BuyoutRewardModel::StatusPrimary as u8 {
        status_thankyou_usdc
    } else if reward_model == S1BuyoutRewardModel::FlatEqual as u8 {
        let unit = (discovery_pool_remaining as u128)
            .checked_div(eligible_holder_count as u128)
            .ok_or(StreamPumpError::MathOverflow)?;
        u64::try_from(unit).map_err(|_| error!(StreamPumpError::MathOverflow))?
    } else {
        let early_weight = 2_u128;
        let regular_weight = 1_u128;
        let early_count = early_holder_count as u128;
        let regular_count = regular_holder_count as u128;
        let weighted_count = early_count
            .checked_mul(early_weight)
            .ok_or(StreamPumpError::MathOverflow)?
            .checked_add(
                regular_count
                    .checked_mul(regular_weight)
                    .ok_or(StreamPumpError::MathOverflow)?,
            )
            .ok_or(StreamPumpError::MathOverflow)?;
        if weighted_count == 0 {
            0
        } else {
            let claimant_weight = if is_early_holder {
                early_weight
            } else {
                regular_weight
            };
            let unit = (discovery_pool_remaining as u128)
                .checked_mul(claimant_weight)
                .ok_or(StreamPumpError::MathOverflow)?
                .checked_div(weighted_count)
                .ok_or(StreamPumpError::MathOverflow)?;
            u64::try_from(unit).map_err(|_| error!(StreamPumpError::MathOverflow))?
        }
    };

    let (capped_unit, capped_by_cap) = min_u64_from_u128(unit as u128, reward_cap_usdc)?;
    let payout = std::cmp::min(capped_unit, discovery_pool_remaining);
    Ok((payout, capped_by_cap || capped_unit > discovery_pool_remaining))
}

pub fn calculate_flat_reward(
    pool_remaining: u64,
    unsettled_count: u32,
    reward_cap_usdc: u64,
) -> Result<(u64, bool)> {
    require!(reward_cap_usdc > 0, StreamPumpError::RewardCapZero);
    if pool_remaining == 0 || unsettled_count == 0 {
        return Ok((0, false));
    }

    let unit = (pool_remaining as u128)
        .checked_div(unsettled_count as u128)
        .ok_or(StreamPumpError::MathOverflow)?;
    let (capped_unit, capped_by_cap) = min_u64_from_u128(unit, reward_cap_usdc)?;
    let payout = std::cmp::min(capped_unit, pool_remaining);
    Ok((payout, capped_by_cap || capped_unit > pool_remaining))
}

/// Compute Keccak-256 hash digest of input bytes, returning a 32-byte array.
/// Used for content/URL hashing in content anchoring.
/// 计算输入字节的 Keccak-256 哈希摘要，返回 32 字节数组。用于内容锚定中的内容/URL 哈希。
pub fn keccak_digest(input: &[u8]) -> [u8; 32] {
    keccak_hash(input).to_bytes()
}

fn effective_s1_curve_k(rating_bps: u16) -> Result<u128> {
    require!(rating_bps > 0, StreamPumpError::InvalidCreatorRatingConfig);
    let scaled = (S1_BONDING_CURVE_K as u128)
        .checked_mul(rating_bps as u128)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(StreamPumpError::MathOverflow)?;

    Ok(std::cmp::max(scaled, 1))
}

/// Calculates buy cost for S1 internal tokens using:
/// cost = effective_k/2 * ((S + dS)^2 - S^2)
pub fn calculate_buy_cost_with_rating(
    current_supply: u64,
    amount: u64,
    rating_bps: u16,
) -> Result<u64> {
    let start = current_supply as u128;
    let delta = amount as u128;
    let end = start
        .checked_add(delta)
        .ok_or(StreamPumpError::MathOverflow)?;

    let start_sq = start
        .checked_mul(start)
        .ok_or(StreamPumpError::MathOverflow)?;
    let end_sq = end.checked_mul(end).ok_or(StreamPumpError::MathOverflow)?;

    let diff = end_sq
        .checked_sub(start_sq)
        .ok_or(StreamPumpError::MathOverflow)?;
    let scaled = effective_s1_curve_k(rating_bps)?
        .checked_mul(diff)
        .ok_or(StreamPumpError::MathOverflow)?;
    let cost = scaled.checked_div(2).ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(cost).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub fn calculate_buy_cost(current_supply: u64, amount: u64) -> Result<u64> {
    calculate_buy_cost_with_rating(current_supply, amount, DEFAULT_S1_RATING_BPS)
}

/// Calculates gross sell return for S1 internal tokens using:
/// return = effective_k/2 * (S^2 - (S - dS)^2)
pub fn calculate_sell_return_with_rating(
    current_supply: u64,
    amount: u64,
    rating_bps: u16,
) -> Result<u64> {
    let start = current_supply as u128;
    let delta = amount as u128;
    let end = start
        .checked_sub(delta)
        .ok_or(StreamPumpError::InvalidAmount)?;

    let start_sq = start
        .checked_mul(start)
        .ok_or(StreamPumpError::MathOverflow)?;
    let end_sq = end.checked_mul(end).ok_or(StreamPumpError::MathOverflow)?;

    let diff = start_sq
        .checked_sub(end_sq)
        .ok_or(StreamPumpError::MathOverflow)?;
    let scaled = effective_s1_curve_k(rating_bps)?
        .checked_mul(diff)
        .ok_or(StreamPumpError::MathOverflow)?;
    let gross = scaled.checked_div(2).ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(gross).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub fn calculate_sell_return(current_supply: u64, amount: u64) -> Result<u64> {
    calculate_sell_return_with_rating(current_supply, amount, DEFAULT_S1_RATING_BPS)
}

pub fn validate_role_flags(role_flags: u16) -> Result<()> {
    require!(
        role_flags > 0 && role_flags & !VALID_USER_ROLE_MASK == 0,
        StreamPumpError::InvalidRoleFlags
    );
    Ok(())
}

pub fn daily_spump_amount_for_level(level: u8) -> Result<u64> {
    let multiplier: u64 = match level {
        0 | 1 => 1,
        2 => 2,
        3 => 3,
        4 => 5,
        _ => 8,
    };

    ONE_SPUMP
        .checked_mul(multiplier)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

pub fn apply_emission_multiplier(amount: u64, multiplier_bps: u16) -> Result<u64> {
    require!(multiplier_bps > 0, StreamPumpError::InvalidEmissionConfig);
    let scaled = (amount as u128)
        .checked_mul(multiplier_bps as u128)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(std::cmp::max(scaled, 1)).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub fn apply_new_user_emission_discount(
    amount: u64,
    user_created_at: i64,
    now: i64,
    window_seconds: i64,
    new_user_bps: u16,
) -> Result<u64> {
    require!(
        new_user_bps > 0 && new_user_bps <= 10_000 && window_seconds >= 0,
        StreamPumpError::InvalidEmissionConfig
    );

    let is_new_user = user_created_at > 0
        && window_seconds > 0
        && now
            < user_created_at
                .checked_add(window_seconds)
                .ok_or(StreamPumpError::MathOverflow)?;

    if is_new_user {
        return amount_from_bps(amount, new_user_bps);
    }

    Ok(amount)
}

pub fn activate_pending_s1_rating(creator_profile: &mut CreatorProfile, now: i64) {
    if creator_profile.pending_s1_rating_bps > 0
        && creator_profile.pending_rating_effective_at > 0
        && now >= creator_profile.pending_rating_effective_at
    {
        creator_profile.s1_rating_bps = creator_profile.pending_s1_rating_bps;
        creator_profile.s1_graduation_target_supply =
            creator_profile.pending_s1_graduation_target_supply;
        creator_profile.last_rating_report_digest = creator_profile.pending_rating_report_digest;
        creator_profile.pending_s1_rating_bps = 0;
        creator_profile.pending_s1_graduation_target_supply = 0;
        creator_profile.pending_rating_effective_at = 0;
        creator_profile.pending_rating_report_digest = [0_u8; 32];
    }
}

pub fn role_flag_for_organization_type(organization_type: OrganizationType) -> u16 {
    match organization_type {
        OrganizationType::CreatorOpc => USER_ROLE_CREATOR,
        OrganizationType::SponsorBrand => USER_ROLE_SPONSOR_OPERATOR,
        OrganizationType::McnAgency => USER_ROLE_MCN_OPERATOR,
    }
}

/// Calculates an exact pro-rata share against the remaining pool.
/// The final claimant sweeps the entire remainder to avoid stranded dust.
pub fn calculate_remaining_pro_rata_share(
    claimant_amount: u64,
    remaining_pool: u64,
    remaining_total: u64,
) -> Result<u64> {
    require!(
        claimant_amount > 0 && remaining_total > 0 && claimant_amount <= remaining_total,
        StreamPumpError::InvalidAmount
    );

    if claimant_amount == remaining_total {
        return Ok(remaining_pool);
    }

    let numerator = (claimant_amount as u128)
        .checked_mul(remaining_pool as u128)
        .ok_or(StreamPumpError::MathOverflow)?;
    let share = numerator
        .checked_div(remaining_total as u128)
        .ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(share).map_err(|_| error!(StreamPumpError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::calculate_remaining_pro_rata_share;

    #[test]
    fn pro_rata_share_rounds_down_before_final_claim() {
        let share = calculate_remaining_pro_rata_share(2, 100, 3).unwrap();
        assert_eq!(share, 66);
    }

    #[test]
    fn final_claimant_sweeps_remaining_dust() {
        let share = calculate_remaining_pro_rata_share(1, 34, 1).unwrap();
        assert_eq!(share, 34);
    }
}
