import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

describe("streampump-core", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StreampumpCore as Program;

  it("initializes test harness", async () => {
    // TODO: Add v2 integration coverage for:
    // - initialize_protocol
    // - register_creator + anchor_content_hash
    // - create_campaign + sponsor_deposit + burn_spump_for_inventory
    // - place_bet + submit_oracle_report + settle_campaign + claim_market_reward
    console.log("Program ID:", program.programId.toBase58());
  });
});
