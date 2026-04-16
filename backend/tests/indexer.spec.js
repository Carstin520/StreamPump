"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const web3_js_1 = require("@solana/web3.js");
const indexer_1 = require("../src/services/indexer");
describe("indexer helpers", () => {
    it("normalizes nested BigInt, PublicKey, and bytes into JSON-safe payloads", () => {
        const keypair = web3_js_1.Keypair.generate();
        const normalized = (0, indexer_1.normalizeIndexerJson)({
            amount: 42n,
            authority: keypair.publicKey,
            digest: Uint8Array.from([1, 2, 3, 4]),
            nested: {
                values: [7n, keypair.publicKey],
            },
        });
        (0, chai_1.expect)(normalized.amount).to.equal("42");
        (0, chai_1.expect)(normalized.authority).to.equal(keypair.publicKey.toBase58());
        (0, chai_1.expect)(normalized.digest).to.equal("01020304");
        (0, chai_1.expect)(normalized.nested.values[0]).to.equal("7");
        (0, chai_1.expect)(normalized.nested.values[1]).to.equal(keypair.publicKey.toBase58());
    });
    it("maps idl account names to decoded account addresses", () => {
        const accounts = [web3_js_1.Keypair.generate().publicKey, web3_js_1.Keypair.generate().publicKey];
        const mapped = (0, indexer_1.mapInstructionAccounts)({
            accountNames: ["proposal", "creator_profile", "missing"],
            accountPubkeys: accounts,
        });
        (0, chai_1.expect)(mapped.proposal).to.equal(accounts[0].toBase58());
        (0, chai_1.expect)(mapped.creator_profile).to.equal(accounts[1].toBase58());
        (0, chai_1.expect)(mapped.missing).to.equal(null);
    });
    it("selects proposal as the primary entity when available", () => {
        const entity = (0, indexer_1.selectPrimaryEntityPda)({
            proposal: "proposal_pda",
            creator_profile: "creator_profile_pda",
            content_anchor: "content_anchor_pda",
        });
        (0, chai_1.expect)(entity).to.equal("proposal_pda");
    });
    it("falls back to creator_profile or content_anchor when no proposal is present", () => {
        (0, chai_1.expect)((0, indexer_1.selectPrimaryEntityPda)({
            proposal: null,
            creator_profile: "creator_profile_pda",
            content_anchor: "content_anchor_pda",
        })).to.equal("creator_profile_pda");
        (0, chai_1.expect)((0, indexer_1.selectPrimaryEntityPda)({
            proposal: null,
            creator_profile: null,
            content_anchor: "content_anchor_pda",
        })).to.equal("content_anchor_pda");
    });
    it("maps known Anchor event names to instruction names", () => {
        (0, chai_1.expect)((0, indexer_1.mapEventNameToInstructionName)("ProposalCreated")).to.equal("create_proposal");
        (0, chai_1.expect)((0, indexer_1.mapEventNameToInstructionName)("ContentAnchored")).to.equal("anchor_content_hash");
        (0, chai_1.expect)((0, indexer_1.mapEventNameToInstructionName)("S1BuyoutOfferSubmitted")).to.equal("submit_buyout_offer");
        (0, chai_1.expect)((0, indexer_1.mapEventNameToInstructionName)("Track2Settled")).to.equal("settle_track2");
        (0, chai_1.expect)((0, indexer_1.mapEventNameToInstructionName)("UnknownEvent")).to.equal(null);
    });
    it("prefers Anchor event payloads and keeps unmatched instructions as fallback", () => {
        const merged = (0, indexer_1.mergeAnchorEventsWithInstructions)({
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
        (0, chai_1.expect)(merged).to.have.length(2);
        (0, chai_1.expect)(merged[0].instructionName).to.equal("create_proposal");
        (0, chai_1.expect)(merged[1].payload.source).to.equal("anchor_event");
        (0, chai_1.expect)(merged[1].payload.eventName).to.equal("ProposalFunded");
    });
});
