"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextIntentStatusAfterBundle = exports.buildLaunchBundleTransaction = exports.buildBundleRecord = exports.assertRequiredSignerPresent = exports.assertTransactionMessageMatches = exports.decodeVersionedTransaction = exports.encodeVersionedTransaction = exports.derivePlannedContentAnchorPda = exports.deriveIntentAddresses = exports.buildInstructionPlan = void 0;
/**
 * CN: Proposal launch 服务，负责 launch instruction 规划、真实 v0 交易组装和签名校验。
 * EN: Proposal launch service that plans launch instructions, assembles real v0 transactions, and validates signatures.
 */
const client_1 = require("@prisma/client");
const web3_js_1 = require("@solana/web3.js");
const AnchorService_1 = require("./AnchorService");
const ZERO_SIGNATURE = new Uint8Array(64);
const parseDigestHex = (digestHex, label) => {
    const normalized = digestHex.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
        throw new Error(`${label} must be a 64-character hex string`);
    }
    return Uint8Array.from(Buffer.from(normalized, "hex"));
};
const mapContentTypeToProposalKind = (contentType) => {
    switch (contentType) {
        case "SHORT_VIDEO":
            return { shortVideo: {} };
        case "IMAGE_CAROUSEL":
            return { imageCarousel: {} };
        case "MIXED_MEDIA_NOTE":
            return { mixedMediaNote: {} };
        default:
            throw new Error(`Unsupported contentType: ${contentType}`);
    }
};
const mapTrack2MetricTypeToProposalMetric = (metricType) => {
    switch (metricType) {
        case "VIEWS":
            return { views: {} };
        case "CLICKS":
            return { clicks: {} };
        case "SAVES":
            return { saves: {} };
        default:
            throw new Error(`Unsupported track2MetricType: ${metricType}`);
    }
};
const getSignerWalletsFromTransaction = (transaction) => transaction.message.staticAccountKeys
    .slice(0, transaction.message.header.numRequiredSignatures)
    .map((key) => key.toBase58());
const isZeroSignature = (signature) => signature.length === ZERO_SIGNATURE.length &&
    signature.every((value, index) => value === ZERO_SIGNATURE[index]);
const buildInstructionPlan = (manifest, _intent) => {
    if (manifest.currentAnchorPda) {
        return ["create_proposal", "sponsor_fund"];
    }
    return ["anchor_content_hash", "create_proposal", "sponsor_fund"];
};
exports.buildInstructionPlan = buildInstructionPlan;
const deriveIntentAddresses = (params) => {
    const anchorService = (0, AnchorService_1.getAnchorService)();
    const creator = new web3_js_1.PublicKey(params.creatorWallet);
    const proposalPda = anchorService.deriveProposalPda(creator, params.deadlineUnix);
    const proposalUsdcVaultPda = anchorService.deriveProposalUsdcVaultPda(proposalPda);
    return {
        proposalPda: proposalPda.toBase58(),
        proposalUsdcVaultPda: proposalUsdcVaultPda.toBase58(),
    };
};
exports.deriveIntentAddresses = deriveIntentAddresses;
const derivePlannedContentAnchorPda = (params) => {
    if (params.lockedAnchorPda) {
        return params.lockedAnchorPda;
    }
    if (params.manifest.currentAnchorPda) {
        return params.manifest.currentAnchorPda;
    }
    if (!params.manifest.internalUrlDigestHex) {
        throw new Error("manifest.internalUrlDigestHex is required to derive plannedContentAnchorPda");
    }
    const anchorService = (0, AnchorService_1.getAnchorService)();
    const creatorProfilePda = anchorService.deriveCreatorProfilePda(new web3_js_1.PublicKey(params.creatorWallet));
    const contentAnchorPda = anchorService.deriveContentAnchorPda(creatorProfilePda, parseDigestHex(params.manifest.internalUrlDigestHex, "manifest.internalUrlDigestHex"));
    return contentAnchorPda.toBase58();
};
exports.derivePlannedContentAnchorPda = derivePlannedContentAnchorPda;
const encodeVersionedTransaction = (transaction) => Buffer.from(transaction.serialize()).toString("base64");
exports.encodeVersionedTransaction = encodeVersionedTransaction;
const decodeVersionedTransaction = (base64Value) => web3_js_1.VersionedTransaction.deserialize(Buffer.from(base64Value, "base64"));
exports.decodeVersionedTransaction = decodeVersionedTransaction;
const assertTransactionMessageMatches = (expectedBase64, candidateBase64) => {
    const expected = (0, exports.decodeVersionedTransaction)(expectedBase64);
    const candidate = (0, exports.decodeVersionedTransaction)(candidateBase64);
    const expectedMessage = Buffer.from(expected.message.serialize()).toString("base64");
    const candidateMessage = Buffer.from(candidate.message.serialize()).toString("base64");
    if (expectedMessage !== candidateMessage) {
        throw new Error("signed transaction does not match the bundle message");
    }
};
exports.assertTransactionMessageMatches = assertTransactionMessageMatches;
const assertRequiredSignerPresent = (serializedTxBase64, signerWallet) => {
    const transaction = (0, exports.decodeVersionedTransaction)(serializedTxBase64);
    const signerWallets = getSignerWalletsFromTransaction(transaction);
    const signerIndex = signerWallets.findIndex((wallet) => wallet === signerWallet);
    if (signerIndex === -1) {
        throw new Error(`bundle does not require signer ${signerWallet}`);
    }
    if (isZeroSignature(transaction.signatures[signerIndex])) {
        throw new Error(`missing signature for ${signerWallet}`);
    }
};
exports.assertRequiredSignerPresent = assertRequiredSignerPresent;
const buildBundleRecord = (params) => ({
    intentId: params.intent.id,
    bundleType: "PROPOSAL_LAUNCH",
    instructionPlanJson: params.instructionPlan,
    messageBase64: params.versionedTxBase64,
    recentBlockhash: params.recentBlockhash,
    lastValidBlockHeight: params.lastValidBlockHeight,
    requiredSignersJson: [
        params.intent.creatorWallet,
        params.intent.sponsorWallet,
    ],
    expiresAt: params.expiresAt,
    submitMode: params.submitMode,
    status: client_1.BundleStatus.BUILT,
    errorMessage: null,
});
exports.buildBundleRecord = buildBundleRecord;
const buildLaunchBundleTransaction = async (params) => {
    if (!params.intent.lockedManifestHashHex) {
        throw new Error("intent.lockedManifestHashHex is required before building the launch bundle");
    }
    if (!params.intent.plannedProposalPda || !params.intent.plannedUsdcVaultPda) {
        throw new Error("intent plannedProposalPda and plannedUsdcVaultPda must be pre-derived");
    }
    const anchorService = (0, AnchorService_1.getAnchorService)();
    const instructionPlan = (0, exports.buildInstructionPlan)(params.manifest, { id: "launch" });
    const plannedContentAnchorPda = (0, exports.derivePlannedContentAnchorPda)({
        creatorWallet: params.intent.creatorWallet,
        manifest: params.manifest,
        lockedAnchorPda: params.intent.lockedAnchorPda,
    });
    const instructions = [];
    if (!params.manifest.currentAnchorPda) {
        if (!params.manifest.internalCanonicalUrl) {
            throw new Error("manifest.internalCanonicalUrl is required when anchor_content_hash must be included");
        }
        const anchorInstruction = await anchorService.buildAnchorContentHashInstruction({
            creatorWallet: params.intent.creatorWallet,
            payerWallet: params.intent.sponsorWallet,
            canonicalUrl: params.manifest.internalCanonicalUrl,
            contentHashHex: params.intent.lockedManifestHashHex,
        });
        instructions.push(anchorInstruction);
    }
    const createProposalInstruction = await anchorService.buildCreateProposalInstruction({
        creatorWallet: params.intent.creatorWallet,
        payerWallet: params.intent.sponsorWallet,
        proposalPda: params.intent.plannedProposalPda,
        proposalUsdcVaultPda: params.intent.plannedUsdcVaultPda,
        contentKind: mapContentTypeToProposalKind(params.manifest.contentType),
        contentHashHex: params.intent.lockedManifestHashHex,
        contentAnchorPda: plannedContentAnchorPda,
        track1BaseUsdc: params.intent.track1BaseUsdc,
        track2MetricType: mapTrack2MetricTypeToProposalMetric(params.intent.track2MetricType),
        track2TargetValue: params.intent.track2TargetValue,
        track2MinAchievementBps: params.intent.track2MinAchievementBps,
        track3DelayDays: params.intent.track3DelayDays,
        deadlineUnix: params.intent.deadlineUnix,
    });
    instructions.push(createProposalInstruction);
    const sponsorFundInstruction = await anchorService.buildSponsorFundInstruction({
        sponsorWallet: params.intent.sponsorWallet,
        proposalPda: params.intent.plannedProposalPda,
        proposalUsdcVaultPda: params.intent.plannedUsdcVaultPda,
        track1Amount: params.intent.track1BaseUsdc,
        track2Amount: params.intent.track2UsdcDeposited,
        track3Amount: params.intent.track3UsdcDeposited,
    });
    instructions.push(sponsorFundInstruction);
    const { blockhash, lastValidBlockHeight } = await anchorService.connection.getLatestBlockhash("confirmed");
    const messageV0 = new web3_js_1.TransactionMessage({
        payerKey: new web3_js_1.PublicKey(params.intent.sponsorWallet),
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message();
    const transaction = new web3_js_1.VersionedTransaction(messageV0);
    return {
        instructionPlan,
        plannedContentAnchorPda,
        versionedTxBase64: (0, exports.encodeVersionedTransaction)(transaction),
        recentBlockhash: blockhash,
        lastValidBlockHeight: BigInt(lastValidBlockHeight),
    };
};
exports.buildLaunchBundleTransaction = buildLaunchBundleTransaction;
const nextIntentStatusAfterBundle = () => client_1.ProposalIntentStatus.BUNDLE_BUILT;
exports.nextIntentStatusAfterBundle = nextIntentStatusAfterBundle;
