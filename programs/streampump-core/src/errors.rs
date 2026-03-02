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
    #[msg("Invalid basis points value")]
    InvalidBasisPoints,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Invalid market close time")]
    InvalidMarketClose,
    #[msg("Campaign is not open")]
    CampaignClosed,
    #[msg("Campaign is not ready for this action")]
    CampaignNotReady,
    #[msg("Oracle report has already been submitted")]
    OracleAlreadyReported,
    #[msg("Oracle report is required before settlement")]
    OracleReportRequired,
    #[msg("Campaign has not expired yet")]
    CampaignNotExpired,
    #[msg("Market has already resolved")]
    MarketResolved,
    #[msg("Market is not resolved")]
    MarketNotResolved,
    #[msg("Market is closed for new bets")]
    MarketClosed,
    #[msg("Bet position already claimed")]
    PositionAlreadyClaimed,
    #[msg("No winning position for this user")]
    NotWinningPosition,
    #[msg("URL digest mismatch")]
    UrlDigestMismatch,
    #[msg("Creator profile not initialized")]
    CreatorNotRegistered,
    #[msg("Invalid mint account")]
    InvalidMint,
    #[msg("Invalid payout account")]
    InvalidPayoutAccount,
    #[msg("Burn amount must be greater than zero")]
    BurnAmountTooLow,
}
