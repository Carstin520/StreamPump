import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import {
  mapEventNameToInstructionName,
  mergeAnchorEventsWithInstructions,
  mapInstructionAccounts,
  normalizeIndexerJson,
  selectPrimaryEntityPda,
} from "../src/services/indexer";

describe("indexer helpers", () => {
  it("normalizes nested BigInt, PublicKey, and bytes into JSON-safe payloads", () => {
    const keypair = Keypair.generate();
    const normalized = normalizeIndexerJson({
      amount: 42n,
      authority: keypair.publicKey,
      digest: Uint8Array.from([1, 2, 3, 4]),
      nested: {
        values: [7n, keypair.publicKey],
      },
    }) as Record<string, any>;

    expect(normalized.amount).to.equal("42");
    expect(normalized.authority).to.equal(keypair.publicKey.toBase58());
    expect(normalized.digest).to.equal("01020304");
    expect(normalized.nested.values[0]).to.equal("7");
    expect(normalized.nested.values[1]).to.equal(keypair.publicKey.toBase58());
  });

  it("maps idl account names to decoded account addresses", () => {
    const accounts = [Keypair.generate().publicKey, Keypair.generate().publicKey];
    const mapped = mapInstructionAccounts({
      accountNames: ["proposal", "creator_profile", "missing"],
      accountPubkeys: accounts,
    });

    expect(mapped.proposal).to.equal(accounts[0].toBase58());
    expect(mapped.creator_profile).to.equal(accounts[1].toBase58());
    expect(mapped.missing).to.equal(null);
  });

  it("selects proposal as the primary entity when available", () => {
    const entity = selectPrimaryEntityPda({
      proposal: "proposal_pda",
      creator_profile: "creator_profile_pda",
      content_anchor: "content_anchor_pda",
    });

    expect(entity).to.equal("proposal_pda");
  });

  it("falls back to creator_profile or content_anchor when no proposal is present", () => {
    expect(
      selectPrimaryEntityPda({
        proposal: null,
        creator_profile: "creator_profile_pda",
        content_anchor: "content_anchor_pda",
      })
    ).to.equal("creator_profile_pda");

    expect(
      selectPrimaryEntityPda({
        proposal: null,
        creator_profile: null,
        content_anchor: "content_anchor_pda",
      })
    ).to.equal("content_anchor_pda");
  });

  it("maps known Anchor event names to instruction names", () => {
    expect(mapEventNameToInstructionName("ProposalCreated")).to.equal("create_proposal");
    expect(mapEventNameToInstructionName("ContentAnchored")).to.equal("anchor_content_hash");
    expect(mapEventNameToInstructionName("S1BuyoutOfferSubmitted")).to.equal(
      "submit_buyout_offer"
    );
    expect(mapEventNameToInstructionName("Track2Settled")).to.equal("settle_track2");
    expect(mapEventNameToInstructionName("UnknownEvent")).to.equal(null);
  });

  it("prefers Anchor event payloads and keeps unmatched instructions as fallback", () => {
    const merged = mergeAnchorEventsWithInstructions({
      events: [
        {
          eventName: "ProposalFunded",
          instructionName: "sponsor_fund",
          proposalPda: "proposal_pda",
          entityPda: "proposal_pda",
          payload: {
            proposal: "proposal_pda",
            sponsor: "sponsor_wallet",
            status: 1,
          },
        },
      ],
      instructions: [
        {
          instructionIndex: 0,
          instructionName: "create_proposal",
          proposalPda: "proposal_pda",
          entityPda: "proposal_pda",
          payload: {
            args: {
              deadline: "1",
            },
            accounts: {
              proposal: "proposal_pda",
            },
          },
        },
        {
          instructionIndex: 1,
          instructionName: "sponsor_fund",
          proposalPda: "proposal_pda",
          entityPda: "proposal_pda",
          payload: {
            args: {
              track1Amount: "10",
            },
            accounts: {
              proposal: "proposal_pda",
            },
          },
        },
      ],
    });

    expect(merged).to.have.length(2);
    expect(merged[0].instructionName).to.equal("create_proposal");
    expect(merged[1].payload.source).to.equal("anchor_event");
    expect(merged[1].payload.eventName).to.equal("ProposalFunded");
  });
});
