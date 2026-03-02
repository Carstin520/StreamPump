use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("7V3f6AQMtkP8dwF5EYici3QnqTPZqyVv5JBy6s2fBfZW");

#[program]
pub mod streampump_core {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        args: InitializeProtocolArgs,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, args)
    }

    pub fn register_creator(
        ctx: Context<RegisterCreator>,
        args: RegisterCreatorArgs,
    ) -> Result<()> {
        instructions::register_creator::handler(ctx, args)
    }

    pub fn anchor_content_hash(
        ctx: Context<AnchorContentHash>,
        args: AnchorContentHashArgs,
    ) -> Result<()> {
        instructions::anchor_content_hash::handler(ctx, args)
    }

    pub fn create_campaign(ctx: Context<CreateCampaign>, args: CreateCampaignArgs) -> Result<()> {
        instructions::create_campaign::handler(ctx, args)
    }

    pub fn sponsor_deposit(ctx: Context<SponsorDeposit>, args: SponsorDepositArgs) -> Result<()> {
        instructions::sponsor_deposit::handler(ctx, args)
    }

    pub fn burn_spump_for_inventory(
        ctx: Context<BurnSpumpForInventory>,
        args: BurnSpumpForInventoryArgs,
    ) -> Result<()> {
        instructions::burn_spump_for_inventory::handler(ctx, args)
    }

    pub fn place_bet(ctx: Context<PlaceBet>, args: PlaceBetArgs) -> Result<()> {
        instructions::place_bet::handler(ctx, args)
    }

    pub fn submit_oracle_report(
        ctx: Context<SubmitOracleReport>,
        args: SubmitOracleReportArgs,
    ) -> Result<()> {
        instructions::submit_oracle_report::handler(ctx, args)
    }

    pub fn settle_campaign(ctx: Context<SettleCampaign>) -> Result<()> {
        instructions::settle_campaign::handler(ctx)
    }

    pub fn claim_market_reward(ctx: Context<ClaimMarketReward>) -> Result<()> {
        instructions::claim_market_reward::handler(ctx)
    }
}
