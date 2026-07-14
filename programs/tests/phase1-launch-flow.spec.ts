/**
 * =============================================================================
 * StreamPump — Phase 1 Launch Flow Test Suite
 * StreamPump — Phase 1 发起流程测试套件
 *
 * Focus:
 * 关注点：
 *   1. Creator stays the business authorizer while an external payer covers rent
 *      创作者保留业务授权身份，外部付款人承担 rent
 *   2. Proposal launch can be bundled atomically with sponsor funding
 *      提案发起可以与 sponsor 注资打包成原子交易
 *   3. Missing creator signature and failed sponsor funding both fail safely
 *      缺失 creator 签名或 sponsor 注资失败都会安全失败
 * =============================================================================
 */

import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { keccak_256 } from "@noble/hashes/sha3";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { getTestContext, type TestContext } from "./helpers/test_context";

describe("streampump-core Phase 1 launch flow", function () {
  this.timeout(300_000);

  let ctx: TestContext;
  let deadlineNonce = 0;

  const nextDeadline = (): anchor.BN => {
    deadlineNonce += 1;
    return ctx.bn(ctx.nowTs() + 120 + deadlineNonce * 11);
  };

  before(async () => {
    ctx = await getTestContext();
  });

  it("allows external payer on create_proposal without charging creator lamports", async () => {
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const deadline = nextDeadline();
    const proposal = ctx.deriveProposal(ctx.creatorS2.publicKey, deadline);
    const proposalUsdcVault = ctx.deriveProposalUsdcVault(proposal);
    const creatorLamportsBefore = await ctx.connection.getBalance(ctx.creatorS2.publicKey);
    const sponsorLamportsBefore = await ctx.connection.getBalance(ctx.sponsorA.publicKey);

    await ctx.program.methods
      .createProposal({
        contentKind: { mixedMediaNote: {} },
        contentHash: Array.from(Keypair.generate().publicKey.toBytes()),
        contentAnchorPda: null,
        track1BaseUsdc: ctx.bn(100_000),
        track2MetricType: { views: {} },
        track2TargetValue: ctx.bn(1_000),
        track2MinAchievementBps: 5_000,
        track3DelayDays: 45,
        deadline,
        nonce: ctx.bn(0),
        maxEndorsementSpump: ctx.bn(0),
      })
      .accounts({
        creator: ctx.creatorS2.publicKey,
        payer: ctx.sponsorA.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        proposal,
        usdcVault: proposalUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.creatorS2, ctx.sponsorA])
      .rpc();

    const creatorLamportsAfter = await ctx.connection.getBalance(ctx.creatorS2.publicKey);
    const sponsorLamportsAfter = await ctx.connection.getBalance(ctx.sponsorA.publicKey);
    const proposalAccount = await ctx.program.account.proposal.fetch(proposal);

    expect(creatorLamportsAfter).to.equal(creatorLamportsBefore);
    expect(sponsorLamportsAfter).to.be.lessThan(sponsorLamportsBefore);
    expect(proposalAccount.creator.toBase58()).to.equal(ctx.creatorS2.publicKey.toBase58());
  });

  it("allows external payer on anchor_content_hash without charging creator lamports", async () => {
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const canonicalUrl = `https://example.com/note/${Date.now()}`;
    const urlDigest = Array.from(keccak_256(new TextEncoder().encode(canonicalUrl)));
    const contentDigest = Array.from(Keypair.generate().publicKey.toBytes());
    const contentAnchor = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("content_anchor"),
        creatorProfile.toBuffer(),
        Buffer.from(urlDigest),
      ],
      ctx.program.programId
    )[0];
    const creatorLamportsBefore = await ctx.connection.getBalance(ctx.creatorS2.publicKey);
    const sponsorLamportsBefore = await ctx.connection.getBalance(ctx.sponsorA.publicKey);

    await ctx.program.methods
      .anchorContentHash({
        canonicalUrl,
        urlDigest,
        contentDigest,
      })
      .accounts({
        creatorAuthority: ctx.creatorS2.publicKey,
        payer: ctx.sponsorA.publicKey,
        creatorProfile,
        contentAnchor,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.creatorS2, ctx.sponsorA])
      .rpc();

    const creatorLamportsAfter = await ctx.connection.getBalance(ctx.creatorS2.publicKey);
    const sponsorLamportsAfter = await ctx.connection.getBalance(ctx.sponsorA.publicKey);
    const contentAnchorAccount = await ctx.program.account.contentHashAnchor.fetch(contentAnchor);

    expect(creatorLamportsAfter).to.equal(creatorLamportsBefore);
    expect(sponsorLamportsAfter).to.be.lessThan(sponsorLamportsBefore);
    expect(contentAnchorAccount.authority.toBase58()).to.equal(ctx.creatorS2.publicKey.toBase58());
  });

  it("rejects create_proposal when sponsor pays but creator does not sign", async () => {
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const deadline = nextDeadline();
    const proposal = ctx.deriveProposal(ctx.creatorS2.publicKey, deadline);
    const proposalUsdcVault = ctx.deriveProposalUsdcVault(proposal);

    let thrown: unknown = null;
    try {
      await ctx.program.methods
        .createProposal({
          contentKind: { shortVideo: {} },
          contentHash: Array.from(Keypair.generate().publicKey.toBytes()),
          contentAnchorPda: null,
          track1BaseUsdc: ctx.bn(100_000),
          track2MetricType: { views: {} },
          track2TargetValue: ctx.bn(1_000),
          track2MinAchievementBps: 5_000,
          track3DelayDays: 45,
          deadline,
          nonce: ctx.bn(0),
          maxEndorsementSpump: ctx.bn(0),
        })
        .accounts({
          creator: ctx.creatorS2.publicKey,
          payer: ctx.sponsorA.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          proposal,
          usdcVault: proposalUsdcVault,
          usdcMint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.sponsorA])
        .rpc();
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).to.match(/signature verification failed|unknown signer/i);
  });

  it("bundles create_proposal plus sponsor_fund in one versioned transaction with sponsor as payer", async () => {
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const deadline = nextDeadline();
    const proposal = ctx.deriveProposal(ctx.creatorS2.publicKey, deadline);
    const proposalUsdcVault = ctx.deriveProposalUsdcVault(proposal);

    const createIx = await ctx.program.methods
      .createProposal({
        contentKind: { mixedMediaNote: {} },
        contentHash: Array.from(Keypair.generate().publicKey.toBytes()),
        contentAnchorPda: null,
        track1BaseUsdc: ctx.bn(100_000),
        track2MetricType: { views: {} },
        track2TargetValue: ctx.bn(1_000),
        track2MinAchievementBps: 5_000,
        track3DelayDays: 45,
        deadline,
        nonce: ctx.bn(0),
        maxEndorsementSpump: ctx.bn(0),
      })
      .accounts({
        creator: ctx.creatorS2.publicKey,
        payer: ctx.sponsorA.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        proposal,
        usdcVault: proposalUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const fundIx = await ctx.program.methods
      .sponsorFund({
        track1Amount: ctx.bn(100_000),
        track2Amount: ctx.bn(400_000),
        track3Amount: ctx.bn(300_000),
      })
      .accounts({
        sponsor: ctx.sponsorA.publicKey,
        proposal,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        proposalUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { blockhash } = await ctx.connection.getLatestBlockhash("confirmed");
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: ctx.sponsorA.publicKey,
        recentBlockhash: blockhash,
        instructions: [createIx, fundIx],
      }).compileToV0Message()
    );

    transaction.sign([ctx.sponsorA, ctx.creatorS2]);

    const signature = await ctx.connection.sendTransaction(transaction, {
      preflightCommitment: "confirmed",
    });
    await ctx.connection.confirmTransaction(signature, "confirmed");

    const proposalAccount = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAccount.status)).to.equal("funded");
    expect(proposalAccount.sponsor?.toBase58()).to.equal(ctx.sponsorA.publicKey.toBase58());
  });

  it("rolls back create_proposal when sponsor_fund fails in the same versioned transaction", async () => {
    const emptySponsor = Keypair.generate();
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const deadline = nextDeadline();
    const proposal = ctx.deriveProposal(ctx.creatorS2.publicKey, deadline);
    const proposalUsdcVault = ctx.deriveProposalUsdcVault(proposal);

    const airdropSignature = await ctx.provider.connection.requestAirdrop(
      emptySponsor.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await ctx.provider.connection.confirmTransaction(airdropSignature, "confirmed");
    const emptySponsorUsdcAta = (
      await getOrCreateAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        ctx.usdcMint,
        emptySponsor.publicKey
      )
    ).address;

    const createIx = await ctx.program.methods
      .createProposal({
        contentKind: { shortVideo: {} },
        contentHash: Array.from(Keypair.generate().publicKey.toBytes()),
        contentAnchorPda: null,
        track1BaseUsdc: ctx.bn(100_000),
        track2MetricType: { views: {} },
        track2TargetValue: ctx.bn(1_000),
        track2MinAchievementBps: 5_000,
        track3DelayDays: 45,
        deadline,
        nonce: ctx.bn(0),
        maxEndorsementSpump: ctx.bn(0),
      })
      .accounts({
        creator: ctx.creatorS2.publicKey,
        payer: emptySponsor.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        proposal,
        usdcVault: proposalUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const fundIx = await ctx.program.methods
      .sponsorFund({
        track1Amount: ctx.bn(100_000),
        track2Amount: ctx.bn(400_000),
        track3Amount: ctx.bn(300_000),
      })
      .accounts({
        sponsor: emptySponsor.publicKey,
        proposal,
        sponsorUsdcAta: emptySponsorUsdcAta,
        proposalUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { blockhash } = await ctx.connection.getLatestBlockhash("confirmed");
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: emptySponsor.publicKey,
        recentBlockhash: blockhash,
        instructions: [createIx, fundIx],
      }).compileToV0Message()
    );

    transaction.sign([emptySponsor, ctx.creatorS2]);

    let thrown: unknown = null;
    try {
      const signature = await ctx.connection.sendTransaction(transaction, {
        preflightCommitment: "confirmed",
      });
      await ctx.connection.confirmTransaction(signature, "confirmed");
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).to.match(/custom program error|insufficient/i);
    expect(await ctx.connection.getAccountInfo(proposal)).to.equal(null);
    expect(await ctx.connection.getAccountInfo(proposalUsdcVault)).to.equal(null);
  });
});
