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

    pub fn upgrade_creator(ctx: Context<UpgradeCreator>, args: UpgradeCreatorArgs) -> Result<()> {
        instructions::upgrade_creator::handler(ctx, args)
    }

    pub fn anchor_content_hash(
        ctx: Context<AnchorContentHash>,
        args: AnchorContentHashArgs,
    ) -> Result<()> {
        instructions::anchor_content_hash::handler(ctx, args)
    }

    pub fn buy_s1_token(ctx: Context<BuyS1Token>, args: BuyS1TokenArgs) -> Result<()> {
        instructions::buy_s1_token::handler(ctx, args)
    }

    pub fn sell_s1_token(ctx: Context<SellS1Token>, args: SellS1TokenArgs) -> Result<()> {
        instructions::sell_s1_token::handler(ctx, args)
    }

    pub fn init_s1_buyout(ctx: Context<InitS1Buyout>) -> Result<()> {
        instructions::init_s1_buyout::handler(ctx)
    }

    pub fn submit_buyout_offer(
        ctx: Context<SubmitBuyoutOffer>,
        args: SubmitBuyoutOfferArgs,
    ) -> Result<()> {
        instructions::submit_buyout_offer::handler(ctx, args)
    }

    pub fn accept_buyout_offer(ctx: Context<AcceptBuyoutOffer>) -> Result<()> {
        instructions::accept_buyout_offer::handler(ctx)
    }

    pub fn cancel_buyout_offer(ctx: Context<CancelBuyoutOffer>) -> Result<()> {
        instructions::cancel_buyout_offer::handler(ctx)
    }

    pub fn rage_quit_s1(ctx: Context<RageQuitS1>, args: RageQuitS1Args) -> Result<()> {
        instructions::rage_quit_s1::handler(ctx, args)
    }

    pub fn execute_s1_graduation(ctx: Context<ExecuteS1Graduation>) -> Result<()> {
        instructions::execute_s1_graduation::handler(ctx)
    }

    pub fn claim_s1_buyout_usdc(ctx: Context<ClaimS1BuyoutUsdc>) -> Result<()> {
        instructions::claim_s1_buyout_usdc::handler(ctx)
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

    pub fn sponsor_fund(ctx: Context<SponsorFund>, args: SponsorFundArgs) -> Result<()> {
        instructions::sponsor_fund::handler(ctx, args)
    }

    pub fn settle_track1_base(ctx: Context<SettleTrack1Base>) -> Result<()> {
        instructions::settle_track1_base::handler(ctx)
    }

    pub fn settle_track2(ctx: Context<SettleTrack2>, args: SettleTrack2Args) -> Result<()> {
        instructions::settle_track2::handler(ctx, args)
    }

    pub fn settle_track3_cps(
        ctx: Context<SettleTrack3Cps>,
        args: SettleTrack3CpsArgs,
    ) -> Result<()> {
        instructions::settle_track3_cps::handler(ctx, args)
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
