use anchor_lang::prelude::*;

#[error_code]
pub enum StreamPumpError {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized signer")]
    Unauthorized,
    #[msg("Invalid handle")]
    InvalidHandle,
    #[msg("String exceeds configured limit")]
    StringTooLong,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Proposal has not expired yet")]
    ProposalNotExpired,
    #[msg("Position already claimed")]
    PositionAlreadyClaimed,
    #[msg("URL digest mismatch")]
    UrlDigestMismatch,
    #[msg("Creator profile not initialized")]
    CreatorNotRegistered,
    #[msg("Creator level is below the minimum required threshold")]
    InsufficientCreatorLevel,
    #[msg("Creator is not in required lifecycle status")]
    InvalidCreatorStatus,
    #[msg("S1 position account mismatch")]
    S1PositionAccountMismatch,
    #[msg("Insufficient internal S1 token balance")]
    InsufficientInternalTokenBalance,
    #[msg("Insufficient S1 SPUMP pool liquidity")]
    InsufficientS1PoolLiquidity,
    #[msg("S1 buyout offer account mismatch")]
    BuyoutOfferMismatch,
    #[msg("S1 buyout state account mismatch")]
    BuyoutStateMismatch,
    #[msg("Winning sponsor has not been selected")]
    WinningSponsorNotSelected,
    #[msg("Winning offer cannot be cancelled")]
    WinningOfferCannotCancel,
    #[msg("Rage quit window is not active")]
    RageQuitWindowNotActive,
    #[msg("Rage quit window is still open")]
    RageQuitWindowStillOpen,
    #[msg("Insufficient USDC liquidity in buyout vault")]
    InsufficientBuyoutUsdcLiquidity,
    #[msg("Invalid exit tax configuration")]
    InvalidTaxConfig,
    #[msg("Invalid SPUMP emission configuration")]
    InvalidEmissionConfig,
    #[msg("Invalid S1 creator rating configuration")]
    InvalidCreatorRatingConfig,
    #[msg("Invalid S1 anti-arbitrage guard configuration")]
    InvalidS1GuardConfig,
    #[msg("Creator S1 rating update is too soon")]
    CreatorRatingUpdateTooSoon,
    #[msg("Creator S1 rating change exceeds configured daily cap")]
    CreatorRatingChangeTooLarge,
    #[msg("Creator level upgrade must increase current level")]
    CreatorLevelNotIncreasing,
    #[msg("Invalid creator level value")]
    InvalidCreatorLevel,
    #[msg("Upgrade condition is not met")]
    UpgradeConditionNotMet,
    #[msg("Upgrade observation timestamp is invalid")]
    InvalidObservedAt,
    #[msg("Report digest must not be empty")]
    InvalidReportDigest,
    #[msg("Proposal must be in Open status")]
    ProposalNotOpen,
    #[msg("Proposal is not active for this action")]
    ProposalNotActive,
    #[msg("Proposal has expired")]
    ProposalExpired,
    #[msg("Proposal must be funded before oracle resolution")]
    ProposalNotFunded,
    #[msg("Proposal is not resolved")]
    ProposalNotResolved,
    #[msg("Proposal has already been settled")]
    ProposalAlreadySettled,
    #[msg("Proposal is not settled")]
    ProposalNotSettled,
    #[msg("Proposal cannot be claimed in current state")]
    ProposalNotClaimable,
    #[msg("Proposal sponsor is not set")]
    SponsorNotSet,
    #[msg("Endorsement/proposal account mismatch")]
    ProposalAccountMismatch,
    #[msg("Invalid mint account")]
    InvalidMint,
    #[msg("Invalid payout account")]
    InvalidPayoutAccount,
    #[msg("Buyout offer is still locked")]
    BuyoutOfferStillLocked,
    #[msg("Buyout offer has expired")]
    BuyoutOfferExpired,
    #[msg("Proposal content must provide content hash or content anchor")]
    InvalidContentBinding,
    #[msg("Missing content anchor account")]
    MissingContentAnchorAccount,
    #[msg("Content anchor account mismatch")]
    ContentAnchorMismatch,
    #[msg("Content hash does not match anchored content")]
    ContentHashMismatch,
    #[msg("Invalid role flags")]
    InvalidRoleFlags,
    #[msg("User profile not initialized")]
    UserNotRegistered,
    #[msg("User activity score is below the minimum required for S1")]
    InsufficientUserActivityScore,
    #[msg("User is not eligible to participate in S1")]
    UserNotEligibleForS1,
    #[msg("S1 daily buy limit exceeded for this creator")]
    S1DailyBuyLimitExceeded,
    #[msg("Daily reward already claimed for current day")]
    DailyRewardAlreadyClaimed,
    #[msg("User level must increase")]
    UserLevelNotIncreasing,
    #[msg("Invalid organization name")]
    InvalidOrganizationName,
    #[msg("Invalid organization seed")]
    InvalidOrganizationSeed,
    #[msg("SPUMP mint must use the configured decimals")]
    InvalidSpumpMintDecimals,
    #[msg("SPUMP mint must include the NonTransferable extension")]
    MissingSpumpNonTransferableExtension,
    #[msg("SPUMP mint authority must be the protocol config PDA")]
    InvalidSpumpMintAuthority,
    #[msg("Legacy protocol config has already been migrated")]
    LegacyProtocolConfigAlreadyMigrated,
    #[msg("Invalid legacy protocol config account")]
    InvalidLegacyProtocolConfig,
}
