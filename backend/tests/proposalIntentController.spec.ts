/**
 * CN: Proposal intent 控制器辅助逻辑测试，覆盖 bundle 复用判断和签名提取。
 * EN: Proposal intent controller helper tests covering bundle reuse rules and signature extraction.
 */
import { expect } from "chai";
import {
  ProposalIntentStatus,
  BundleStatus,
  Track2MetricType,
} from "@prisma/client";
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  buildProposalIntentSemantics,
  extractTransactionSignature,
  isBundleReusable,
  serializeIntent,
} from "../src/controllers/proposalIntentShared";

describe("proposalIntentController helpers", () => {
  it("reuses an active built bundle", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.BUILT,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(reusable).to.equal(true);
  });

  it("does not reuse an expired partial bundle", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.PARTIAL,
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(reusable).to.equal(false);
  });

  it("always reuses a confirmed bundle even after expiry", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.CONFIRMED,
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(reusable).to.equal(true);
  });

  it("extracts the canonical transaction signature from a fully signed v0 transaction", () => {
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
            lamports: 1,
          }),
        ],
      }).compileToV0Message()
    );

    tx.sign([sponsor]);
    const extracted = extractTransactionSignature(Buffer.from(tx.serialize()).toString("base64"));

    expect(extracted).to.be.a("string");
    expect(extracted.length).to.be.greaterThan(20);
  });

  it("describes the next signer for intent list/detail serializers", () => {
    const now = new Date(Date.now() + 60_000);
    const semantics = buildProposalIntentSemantics(
      {
        id: "intent-id",
        status: ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED,
        version: 2,
        creatorWallet: "creator-wallet",
        sponsorWallet: "sponsor-wallet",
        sponsorOrgId: null,
        creatorOrgId: null,
        manifestId: "manifest-id",
        lockedManifestHashHex: "a".repeat(64),
        lockedAnchorPda: "anchor-pda",
        deadlineUnix: 1_800_000_000n,
        nonce: 9n,
        track1BaseUsdc: 1n,
        track2MetricType: Track2MetricType.VIEWS,
        track2TargetValue: 1n,
        track2MinAchievementBps: 8_000,
        track2UsdcDeposited: 1n,
        track3UsdcDeposited: 1n,
        track3DelayDays: 7,
        maxEndorsementSpump: 10_000n,
        plannedProposalPda: "proposal-pda",
        plannedUsdcVaultPda: "vault-pda",
        creatorApprovedAt: now,
        sponsorApprovedAt: null,
        chainTxSignature: null,
        chainSubmittedAt: null,
        chainConfirmedAt: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      },
      "creator-wallet",
      null
    );

    expect(semantics.currentStep).to.equal("AWAITING_SPONSOR_SIGNATURE");
    expect(semantics.viewerRole).to.equal("CREATOR");
    expect(semantics.nextAction).to.equal("SPONSOR_SIGN_AND_SUBMIT");
    expect(semantics.requiredSigner).to.equal("SPONSOR");
    expect(semantics.disabledReason).to.equal("SPONSOR_REQUIRED");
  });

  it("serializes proposal nonce and endorsement cap explicitly", () => {
    const now = new Date("2026-05-24T00:00:00.000Z");
    const serialized = serializeIntent({
      id: "intent-id",
      status: ProposalIntentStatus.DRAFT,
      version: 1,
      creatorWallet: "creator-wallet",
      sponsorWallet: "sponsor-wallet",
      sponsorOrgId: null,
      creatorOrgId: null,
      manifestId: "manifest-id",
      lockedManifestHashHex: null,
      lockedAnchorPda: null,
      deadlineUnix: 1_800_000_000n,
      nonce: 123n,
      track1BaseUsdc: 100n,
      track2MetricType: Track2MetricType.VIEWS,
      track2TargetValue: 1_000n,
      track2MinAchievementBps: 7_000,
      track2UsdcDeposited: 200n,
      track3UsdcDeposited: 0n,
      track3DelayDays: 0,
      maxEndorsementSpump: 50_000n,
      plannedProposalPda: null,
      plannedUsdcVaultPda: null,
      creatorApprovedAt: null,
      sponsorApprovedAt: null,
      chainTxSignature: null,
      chainSubmittedAt: null,
      chainConfirmedAt: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(serialized.nonce).to.equal("123");
    expect(serialized.maxEndorsementSpump).to.equal("50000");
  });
});
