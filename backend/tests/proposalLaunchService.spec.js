"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: Proposal launch 服务测试，覆盖 launch plan、PDA 推导和 v0 交易签名校验。
 * EN: Proposal launch service tests covering launch planning, PDA derivation, and v0 transaction signature checks.
 */
const chai_1 = require("chai");
const web3_js_1 = require("@solana/web3.js");
const proposalLaunchService_1 = require("../src/services/proposalLaunchService");
const AnchorService_1 = require("../src/services/AnchorService");
describe("proposalLaunchService", () => {
    it("build_instruction_plan_skips_anchor_when_manifest_already_anchored", () => {
        const plan = (0, proposalLaunchService_1.buildInstructionPlan)({ currentAnchorPda: web3_js_1.Keypair.generate().publicKey.toBase58() }, { id: "intent-1" });
        (0, chai_1.expect)(plan).to.deep.equal(["create_proposal", "sponsor_fund"]);
    });
    it("build_instruction_plan_includes_anchor_when_missing", () => {
        const plan = (0, proposalLaunchService_1.buildInstructionPlan)({ currentAnchorPda: null }, { id: "intent-1" });
        (0, chai_1.expect)(plan).to.deep.equal(["anchor_content_hash", "create_proposal", "sponsor_fund"]);
    });
    it("derive_intent_addresses_matches_onchain_pdas", () => {
        const creator = web3_js_1.Keypair.generate().publicKey;
        const deadlineUnix = 1900000000n;
        const anchorService = (0, AnchorService_1.getAnchorService)();
        const derived = (0, proposalLaunchService_1.deriveIntentAddresses)({
            creatorWallet: creator.toBase58(),
            deadlineUnix,
        });
        (0, chai_1.expect)(derived.proposalPda).to.equal(anchorService.deriveProposalPda(creator, deadlineUnix).toBase58());
        (0, chai_1.expect)(derived.proposalUsdcVaultPda).to.equal(anchorService
            .deriveProposalUsdcVaultPda(new web3_js_1.PublicKey(derived.proposalPda))
            .toBase58());
    });
    it("derive_planned_content_anchor_pda_prefers_locked_anchor_when_present", () => {
        const lockedAnchorPda = web3_js_1.Keypair.generate().publicKey.toBase58();
        const planned = (0, proposalLaunchService_1.derivePlannedContentAnchorPda)({
            creatorWallet: web3_js_1.Keypair.generate().publicKey.toBase58(),
            manifest: {
                currentAnchorPda: null,
                internalUrlDigestHex: "11".repeat(32),
            },
            lockedAnchorPda,
        });
        (0, chai_1.expect)(planned).to.equal(lockedAnchorPda);
    });
    it("build_bundle_record_persists_real_blockhash_metadata", () => {
        const creatorWallet = web3_js_1.Keypair.generate().publicKey.toBase58();
        const sponsorWallet = web3_js_1.Keypair.generate().publicKey.toBase58();
        const record = (0, proposalLaunchService_1.buildBundleRecord)({
            intent: {
                id: "intent-1",
                creatorWallet,
                sponsorWallet,
            },
            instructionPlan: ["anchor_content_hash", "create_proposal", "sponsor_fund"],
            submitMode: "SERVER_RELAY",
            expiresAt: new Date("2026-03-29T00:00:00.000Z"),
            versionedTxBase64: Buffer.from("test-bundle").toString("base64"),
            recentBlockhash: web3_js_1.Keypair.generate().publicKey.toBase58(),
            lastValidBlockHeight: 123n,
        });
        (0, chai_1.expect)(record.messageBase64).to.be.a("string");
        (0, chai_1.expect)(record.recentBlockhash).to.be.a("string");
        (0, chai_1.expect)(record.lastValidBlockHeight).to.equal(123n);
        (0, chai_1.expect)(record.requiredSignersJson).to.deep.equal([creatorWallet, sponsorWallet]);
    });
    it("creator_and_sponsor_can_sign_same_versioned_transaction_once_each", () => {
        const sponsor = web3_js_1.Keypair.generate();
        const creator = web3_js_1.Keypair.generate();
        const blockhash = web3_js_1.Keypair.generate().publicKey.toBase58();
        const instruction = new web3_js_1.TransactionInstruction({
            programId: web3_js_1.SystemProgram.programId,
            keys: [
                { pubkey: sponsor.publicKey, isSigner: true, isWritable: true },
                { pubkey: creator.publicKey, isSigner: true, isWritable: false },
            ],
            data: Buffer.from([1, 2, 3]),
        });
        const tx = new web3_js_1.VersionedTransaction(new web3_js_1.TransactionMessage({
            payerKey: sponsor.publicKey,
            recentBlockhash: blockhash,
            instructions: [instruction],
        }).compileToV0Message());
        tx.sign([sponsor, creator]);
        const encoded = (0, proposalLaunchService_1.encodeVersionedTransaction)(tx);
        (0, proposalLaunchService_1.assertRequiredSignerPresent)(encoded, sponsor.publicKey.toBase58());
        (0, proposalLaunchService_1.assertRequiredSignerPresent)(encoded, creator.publicKey.toBase58());
    });
    it("creator_partial_signature_cannot_be_reused_after_bundle_mutation", () => {
        const sponsor = web3_js_1.Keypair.generate();
        const creator = web3_js_1.Keypair.generate();
        const recipient = web3_js_1.Keypair.generate().publicKey;
        const baseBlockhash = web3_js_1.Keypair.generate().publicKey.toBase58();
        const original = new web3_js_1.VersionedTransaction(new web3_js_1.TransactionMessage({
            payerKey: sponsor.publicKey,
            recentBlockhash: baseBlockhash,
            instructions: [
                web3_js_1.SystemProgram.transfer({
                    fromPubkey: sponsor.publicKey,
                    toPubkey: recipient,
                    lamports: 1,
                }),
            ],
        }).compileToV0Message());
        original.sign([sponsor]);
        const originalBase64 = (0, proposalLaunchService_1.encodeVersionedTransaction)(original);
        const mutated = new web3_js_1.VersionedTransaction(new web3_js_1.TransactionMessage({
            payerKey: sponsor.publicKey,
            recentBlockhash: baseBlockhash,
            instructions: [
                web3_js_1.SystemProgram.transfer({
                    fromPubkey: sponsor.publicKey,
                    toPubkey: recipient,
                    lamports: 2,
                }),
            ],
        }).compileToV0Message());
        mutated.sign([sponsor]);
        const mutatedBase64 = (0, proposalLaunchService_1.encodeVersionedTransaction)(mutated);
        (0, chai_1.expect)(() => (0, proposalLaunchService_1.assertTransactionMessageMatches)(originalBase64, mutatedBase64)).to.throw(/does not match the bundle message/);
    });
    it("decode_round_trip_preserves_transaction_message", () => {
        const sponsor = web3_js_1.Keypair.generate();
        const recipient = web3_js_1.Keypair.generate().publicKey;
        const tx = new web3_js_1.VersionedTransaction(new web3_js_1.TransactionMessage({
            payerKey: sponsor.publicKey,
            recentBlockhash: web3_js_1.Keypair.generate().publicKey.toBase58(),
            instructions: [
                web3_js_1.SystemProgram.transfer({
                    fromPubkey: sponsor.publicKey,
                    toPubkey: recipient,
                    lamports: 5,
                }),
            ],
        }).compileToV0Message());
        const encoded = (0, proposalLaunchService_1.encodeVersionedTransaction)(tx);
        const decoded = (0, proposalLaunchService_1.decodeVersionedTransaction)(encoded);
        (0, chai_1.expect)(Buffer.from(decoded.message.serialize()).toString("base64")).to.equal(Buffer.from(tx.message.serialize()).toString("base64"));
    });
});
