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

    pub fn upgrade_creator(
        ctx: Context<UpgradeCreator>,
        args: UpgradeCreatorArgs,
    ) -> Result<()> {
        instructions::upgrade_creator::handler(ctx, args)
    }

    pub fn anchor_content_hash(
        ctx: Context<AnchorContentHash>,
        args: AnchorContentHashArgs,
    ) -> Result<()> {
        instructions::anchor_content_hash::handler(ctx, args)
    }

    pub fn create_proposal(ctx: Context<CreateProposal>, args: CreateProposalArgs) -> Result<()> {
        instructions::create_proposal::handler(ctx, args)
    }

    pub fn endorse_proposal(
        ctx: Context<EndorseProposal>,
        args: EndorseProposalArgs,
    ) -> Result<()> {
        instructions::endorse_proposal::handler(ctx, args)
    }

    pub fn sponsor_fund(
        ctx: Context<SponsorFund>,
        args: SponsorFundArgs,
    ) -> Result<()> {
        instructions::sponsor_fund::handler(ctx, args)
    }

    pub fn submit_oracle_report(
        ctx: Context<SubmitOracleReport>,
        args: SubmitOracleReportArgs,
    ) -> Result<()> {
        instructions::submit_oracle_report::handler(ctx, args)
    }

    pub fn settle_proposal(ctx: Context<SettleProposal>) -> Result<()> {
        instructions::settle_proposal::handler(ctx)
    }

    pub fn claim_endorsement(ctx: Context<ClaimEndorsement>) -> Result<()> {
        instructions::claim_endorsement::handler(ctx)
    }

    pub fn cancel_proposal(ctx: Context<CancelProposal>) -> Result<()> {
        instructions::cancel_proposal::handler(ctx)
    }

    pub fn emergency_void(ctx: Context<EmergencyVoid>) -> Result<()> {
        instructions::emergency_void::handler(ctx)
    }
}
