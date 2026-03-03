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
    // - S1 gate: level=1 creator cannot create_proposal
    // - upgrade_creator (oracle) to level>=2
    // - create_proposal + endorse_proposal + sponsor_fund
    // - submit_oracle_report + settle_proposal + claim_endorsement
    // - cancel_proposal + emergency_void
    console.log("Program ID:", program.programId.toBase58());
  });
});
