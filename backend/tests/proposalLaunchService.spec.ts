/**
 * CN: Proposal launch 服务测试，覆盖 launch plan、PDA 推导和 v0 交易签名校验。
 * EN: Proposal launch service tests covering launch planning, PDA derivation, and v0 transaction signature checks.
 */
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  assertRequiredSignerPresent,
  assertTransactionMessageMatches,
  buildBundleRecord,
  buildInstructionPlan,
  decodeVersionedTransaction,
  deriveIntentAddresses,
  derivePlannedContentAnchorPda,
  encodeVersionedTransaction,
} from "../src/services/proposalLaunchService";
import { getAnchorService } from "../src/services/AnchorService";

describe("proposalLaunchService", () => {
  it("build_instruction_plan_skips_anchor_when_manifest_already_anchored", () => {
    const plan = buildInstructionPlan(
      { currentAnchorPda: Keypair.generate().publicKey.toBase58() },
      { id: "intent-1" }
    );

    expect(plan).to.deep.equal(["create_proposal", "sponsor_fund"]);
  });

  it("build_instruction_plan_includes_anchor_when_missing", () => {
    const plan = buildInstructionPlan({ currentAnchorPda: null }, { id: "intent-1" });

    expect(plan).to.deep.equal(["anchor_content_hash", "create_proposal", "sponsor_fund"]);
  });

  it("derive_intent_addresses_matches_onchain_pdas", () => {
    const creator = Keypair.generate().publicKey;
    const deadlineUnix = 1_900_000_000n;
    const anchorService = getAnchorService();
    const derived = deriveIntentAddresses({
      creatorWallet: creator.toBase58(),
      deadlineUnix,
    });

    expect(derived.proposalPda).to.equal(
      anchorService.deriveProposalPda(creator, deadlineUnix).toBase58()
    );
    expect(derived.proposalUsdcVaultPda).to.equal(
      anchorService
        .deriveProposalUsdcVaultPda(new PublicKey(derived.proposalPda))
        .toBase58()
    );
  });

  it("derive_planned_content_anchor_pda_prefers_locked_anchor_when_present", () => {
    const lockedAnchorPda = Keypair.generate().publicKey.toBase58();
    const planned = derivePlannedContentAnchorPda({
      creatorWallet: Keypair.generate().publicKey.toBase58(),
      manifest: {
        currentAnchorPda: null,
        internalUrlDigestHex: "11".repeat(32),
      },
      lockedAnchorPda,
    });

    expect(planned).to.equal(lockedAnchorPda);
  });

  it("build_bundle_record_persists_real_blockhash_metadata", () => {
    const creatorWallet = Keypair.generate().publicKey.toBase58();
    const sponsorWallet = Keypair.generate().publicKey.toBase58();
    const record = buildBundleRecord({
      intent: {
        id: "intent-1",
        creatorWallet,
        sponsorWallet,
      },
      instructionPlan: ["anchor_content_hash", "create_proposal", "sponsor_fund"],
      submitMode: "SERVER_RELAY",
      expiresAt: new Date("2026-03-29T00:00:00.000Z"),
      versionedTxBase64: Buffer.from("test-bundle").toString("base64"),
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 123n,
    });

    expect(record.messageBase64).to.be.a("string");
    expect(record.recentBlockhash).to.be.a("string");
    expect(record.lastValidBlockHeight).to.equal(123n);
    expect(record.requiredSignersJson as string[]).to.deep.equal([creatorWallet, sponsorWallet]);
  });

  it("creator_and_sponsor_can_sign_same_versioned_transaction_once_each", () => {
    const sponsor = Keypair.generate();
    const creator = Keypair.generate();
    const blockhash = Keypair.generate().publicKey.toBase58();
    const instruction = new TransactionInstruction({
      programId: SystemProgram.programId,
      keys: [
        { pubkey: sponsor.publicKey, isSigner: true, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from([1, 2, 3]),
    });
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: sponsor.publicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message()
    );

    tx.sign([sponsor, creator]);
    const encoded = encodeVersionedTransaction(tx);

    assertRequiredSignerPresent(encoded, sponsor.publicKey.toBase58());
    assertRequiredSignerPresent(encoded, creator.publicKey.toBase58());
  });

  it("creator_partial_signature_cannot_be_reused_after_bundle_mutation", () => {
    const sponsor = Keypair.generate();
    const creator = Keypair.generate();
    const recipient = Keypair.generate().publicKey;
    const baseBlockhash = Keypair.generate().publicKey.toBase58();

    const original = new VersionedTransaction(
      new TransactionMessage({
        payerKey: sponsor.publicKey,
        recentBlockhash: baseBlockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: sponsor.publicKey,
            toPubkey: recipient,
            lamports: 1,
          }),
        ],
      }).compileToV0Message()
    );
    original.sign([sponsor]);
    const originalBase64 = encodeVersionedTransaction(original);

    const mutated = new VersionedTransaction(
      new TransactionMessage({
        payerKey: sponsor.publicKey,
        recentBlockhash: baseBlockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: sponsor.publicKey,
            toPubkey: recipient,
            lamports: 2,
          }),
        ],
      }).compileToV0Message()
    );
    mutated.sign([sponsor]);
    const mutatedBase64 = encodeVersionedTransaction(mutated);

    expect(() => assertTransactionMessageMatches(originalBase64, mutatedBase64)).to.throw(
      /does not match the bundle message/
    );
  });

  it("decode_round_trip_preserves_transaction_message", () => {
    const sponsor = Keypair.generate();
    const recipient = Keypair.generate().publicKey;
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: sponsor.publicKey,
        recentBlockhash: Keypair.generate().publicKey.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: sponsor.publicKey,
            toPubkey: recipient,
            lamports: 5,
          }),
        ],
      }).compileToV0Message()
    );

    const encoded = encodeVersionedTransaction(tx);
    const decoded = decodeVersionedTransaction(encoded);

    expect(Buffer.from(decoded.message.serialize()).toString("base64")).to.equal(
      Buffer.from(tx.message.serialize()).toString("base64")
    );
  });
});
