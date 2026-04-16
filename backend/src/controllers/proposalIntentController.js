"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProposalById = exports.getProposalIntentById = exports.listProposalIntents = exports.getProposalIntentStatus = exports.submitProposalBundle = exports.creatorPartialSignBundle = exports.buildProposalLaunchBundle = exports.lockProposalIntent = exports.createProposalIntent = exports.extractTransactionSignature = exports.isBundleReusable = exports.isBundleExpired = void 0;
/**
 * CN: Proposal intent 控制器，管理从业务草稿到真实 v0 launch bundle 的后端状态机。
 * EN: Proposal intent controller that manages the backend state machine from business draft to a real v0 launch bundle.
 */
const client_1 = require("@prisma/client");
const bs58_1 = __importDefault(require("bs58"));
const http_1 = require("./http");
const proposalLaunchService_1 = require("../services/proposalLaunchService");
const prisma_1 = require("../services/prisma");
const AnchorService_1 = require("../services/AnchorService");
const parseTrack2MetricType = (value) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "VIEWS" || normalized === "VIEW") {
        return client_1.Track2MetricType.VIEWS;
    }
    if (normalized === "CLICKS" || normalized === "CLICK") {
        return client_1.Track2MetricType.CLICKS;
    }
    if (normalized === "SAVES" || normalized === "SAVE") {
        return client_1.Track2MetricType.SAVES;
    }
    throw new http_1.HttpError(400, "INVALID_INPUT", "track2MetricType must be one of: VIEWS, CLICKS, SAVES");
};
const parseBundleSubmitMode = (value) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "SERVER_RELAY") {
        return client_1.BundleSubmitMode.SERVER_RELAY;
    }
    if (normalized === "CLIENT_RELAY") {
        return client_1.BundleSubmitMode.CLIENT_RELAY;
    }
    throw new http_1.HttpError(400, "INVALID_INPUT", "submitMode must be SERVER_RELAY or CLIENT_RELAY");
};
const parseOptionalBoolean = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
};
const requireAuthenticatedWallet = (req) => {
    if (!req.auth?.wallet || req.auth.source !== "session") {
        throw new http_1.HttpError(401, "AUTH_REQUIRED", "bearer session authentication is required");
    }
    return req.auth.wallet;
};
const getRequesterWallet = (req) => requireAuthenticatedWallet(req);
const isBundleExpired = (bundle) => bundle.expiresAt.getTime() <= Date.now();
exports.isBundleExpired = isBundleExpired;
const isBundleReusable = (bundle) => {
    if (bundle.status === client_1.BundleStatus.CONFIRMED) {
        return true;
    }
    if ((0, exports.isBundleExpired)(bundle)) {
        return false;
    }
    return (bundle.status === client_1.BundleStatus.BUILT ||
        bundle.status === client_1.BundleStatus.PARTIAL ||
        bundle.status === client_1.BundleStatus.FULLY_SIGNED ||
        bundle.status === client_1.BundleStatus.SUBMITTED);
};
exports.isBundleReusable = isBundleReusable;
const extractTransactionSignature = (serializedTxBase64) => {
    const transaction = (0, proposalLaunchService_1.decodeVersionedTransaction)(serializedTxBase64);
    const firstSignature = transaction.signatures[0];
    if (!firstSignature || firstSignature.every((byte) => byte === 0)) {
        throw new Error("fully signed transaction is missing the sponsor signature");
    }
    return bs58_1.default.encode(firstSignature);
};
exports.extractTransactionSignature = extractTransactionSignature;
const serializeIntent = (intent) => ({
    intentId: intent.id,
    status: intent.status,
    // version / 版本: optimistic state version used for multi-step intent transitions.
    version: intent.version,
    creatorWallet: intent.creatorWallet,
    sponsorWallet: intent.sponsorWallet,
    sponsorOrgId: intent.sponsorOrgId,
    creatorOrgId: intent.creatorOrgId,
    manifestId: intent.manifestId,
    lockedManifestHashHex: intent.lockedManifestHashHex,
    lockedAnchorPda: intent.lockedAnchorPda,
    deadlineUnix: intent.deadlineUnix.toString(),
    track1BaseUsdc: intent.track1BaseUsdc.toString(),
    track2MetricType: intent.track2MetricType,
    track2TargetValue: intent.track2TargetValue.toString(),
    track2MinAchievementBps: intent.track2MinAchievementBps,
    track2UsdcDeposited: intent.track2UsdcDeposited.toString(),
    track3UsdcDeposited: intent.track3UsdcDeposited.toString(),
    track3DelayDays: intent.track3DelayDays,
    plannedProposalPda: intent.plannedProposalPda,
    plannedUsdcVaultPda: intent.plannedUsdcVaultPda,
    creatorApprovedAt: intent.creatorApprovedAt?.toISOString() ?? null,
    sponsorApprovedAt: intent.sponsorApprovedAt?.toISOString() ?? null,
    chainTxSignature: intent.chainTxSignature,
    chainSubmittedAt: intent.chainSubmittedAt?.toISOString() ?? null,
    chainConfirmedAt: intent.chainConfirmedAt?.toISOString() ?? null,
    failureReason: intent.failureReason,
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
});
const serializeBundle = (bundle) => ({
    bundleId: bundle.id,
    status: bundle.status,
    submitMode: bundle.submitMode,
    instructionPlan: bundle.instructionPlanJson,
    requiredSigners: bundle.requiredSignersJson,
    versionedTxBase64: bundle.messageBase64,
    recentBlockhash: bundle.recentBlockhash,
    lastValidBlockHeight: bundle.lastValidBlockHeight?.toString() ?? null,
    expiresAt: bundle.expiresAt.toISOString(),
    chainTxSignature: bundle.chainTxSignature,
    errorMessage: bundle.errorMessage,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
});
const serializeProposal = (proposal) => ({
    id: proposal.id,
    proposalPda: proposal.proposalPda,
    creatorWallet: proposal.creatorWallet,
    sponsorWallet: proposal.sponsorWallet,
    deadlineAt: proposal.deadlineAt.toISOString(),
    status: proposal.status,
    track1BaseUsdc: proposal.track1BaseUsdc.toString(),
    track1Claimed: proposal.track1Claimed,
    track2MetricType: proposal.track2MetricType,
    track2TargetValue: proposal.track2TargetValue.toString(),
    track2MinAchievementBps: proposal.track2MinAchievementBps,
    track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
    track2ActualValue: proposal.track2ActualValue?.toString() ?? null,
    track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
    track3UsdcDeposited: proposal.track3UsdcDeposited.toString(),
    track3CpsPayout: proposal.track3CpsPayout?.toString() ?? null,
    track3DelayDays: proposal.track3DelayDays,
    track3SettledAt: proposal.track3SettledAt?.toISOString() ?? null,
    onChainTxSignature: proposal.onChainTxSignature,
    oracleSyncStatus: proposal.oracleSyncStatus,
    contentHashHex: proposal.contentHashHex,
    contentAnchorPda: proposal.contentAnchorPda,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
});
const assertParticipant = (requesterWallet, intent) => {
    if (requesterWallet !== intent.creatorWallet && requesterWallet !== intent.sponsorWallet) {
        throw new http_1.HttpError(403, "FORBIDDEN", "requester must be the creator or sponsor of the intent");
    }
};
const finalizeConfirmedLaunchBundle = async (params) => {
    const latestIntent = await prisma_1.prisma.proposalIntent.findUnique({
        where: { id: params.intentId },
        include: {
            manifest: true,
        },
    });
    if (!latestIntent) {
        throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found after submission");
    }
    const contentAnchorPda = (0, proposalLaunchService_1.derivePlannedContentAnchorPda)({
        creatorWallet: latestIntent.creatorWallet,
        manifest: latestIntent.manifest,
        lockedAnchorPda: latestIntent.lockedAnchorPda,
    });
    return prisma_1.prisma.$transaction(async (tx) => {
        const updatedBundle = await tx.txBundle.update({
            where: { id: params.bundleId },
            data: {
                fullySignedBase64: params.fullySignedTxBase64,
                status: client_1.BundleStatus.CONFIRMED,
                chainTxSignature: params.chainTxSignature,
                errorMessage: null,
            },
        });
        await tx.proposalIntent.update({
            where: { id: latestIntent.id },
            data: {
                status: client_1.ProposalIntentStatus.CONFIRMED,
                version: {
                    increment: 1,
                },
                sponsorApprovedAt: latestIntent.sponsorApprovedAt ?? new Date(),
                chainTxSignature: params.chainTxSignature,
                chainSubmittedAt: latestIntent.chainSubmittedAt ?? new Date(),
                chainConfirmedAt: new Date(),
                failureReason: null,
            },
        });
        await tx.contentManifest.update({
            where: { id: latestIntent.manifest.id },
            data: {
                currentAnchorPda: contentAnchorPda,
                currentAnchorTx: params.chainTxSignature,
                status: latestIntent.manifest.currentAnchorPda
                    ? latestIntent.manifest.status
                    : client_1.ContentManifestStatus.ANCHORED,
            },
        });
        await tx.proposal.upsert({
            where: {
                proposalPda: latestIntent.plannedProposalPda,
            },
            update: {
                sponsorWallet: latestIntent.sponsorWallet,
                sponsorOrgId: latestIntent.sponsorOrgId,
                creatorOrgId: latestIntent.creatorOrgId,
                manifestId: latestIntent.manifestId,
                intentId: latestIntent.id,
                contentHashHex: latestIntent.lockedManifestHashHex,
                contentAnchorPda,
                onChainTxSignature: params.chainTxSignature,
                deadlineAt: new Date(Number(latestIntent.deadlineUnix) * 1000),
                status: client_1.ProposalStatus.FUNDED,
                track1BaseUsdc: latestIntent.track1BaseUsdc,
                track1Claimed: false,
                track2MetricType: latestIntent.track2MetricType,
                track2TargetValue: latestIntent.track2TargetValue,
                track2MinAchievementBps: latestIntent.track2MinAchievementBps,
                track2UsdcDeposited: latestIntent.track2UsdcDeposited,
                track3UsdcDeposited: latestIntent.track3UsdcDeposited,
                track3DelayDays: latestIntent.track3DelayDays,
                oracleSyncStatus: client_1.OracleSyncStatus.PENDING,
            },
            create: {
                proposalPda: latestIntent.plannedProposalPda,
                creatorWallet: latestIntent.creatorWallet,
                sponsorWallet: latestIntent.sponsorWallet,
                sponsorOrgId: latestIntent.sponsorOrgId,
                creatorOrgId: latestIntent.creatorOrgId,
                manifestId: latestIntent.manifestId,
                intentId: latestIntent.id,
                contentHashHex: latestIntent.lockedManifestHashHex,
                contentAnchorPda,
                deadlineAt: new Date(Number(latestIntent.deadlineUnix) * 1000),
                status: client_1.ProposalStatus.FUNDED,
                track1BaseUsdc: latestIntent.track1BaseUsdc,
                track1Claimed: false,
                track2MetricType: latestIntent.track2MetricType,
                track2TargetValue: latestIntent.track2TargetValue,
                track2MinAchievementBps: latestIntent.track2MinAchievementBps,
                track2UsdcDeposited: latestIntent.track2UsdcDeposited,
                track3UsdcDeposited: latestIntent.track3UsdcDeposited,
                track3DelayDays: latestIntent.track3DelayDays,
                onChainTxSignature: params.chainTxSignature,
                oracleSyncStatus: client_1.OracleSyncStatus.PENDING,
            },
        });
        return updatedBundle;
    });
};
const createProposalIntent = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const requesterWallet = getRequesterWallet(req);
        const manifestId = (0, http_1.parseNonEmptyString)(req.body.manifestId, "manifestId");
        const creatorWallet = (0, http_1.parseWallet)(req.body.creatorWallet, "creatorWallet");
        const sponsorWallet = (0, http_1.parseWallet)(req.body.sponsorWallet, "sponsorWallet");
        if (requesterWallet !== creatorWallet && requesterWallet !== sponsorWallet) {
            throw new http_1.HttpError(403, "FORBIDDEN", "requester must be either creatorWallet or sponsorWallet");
        }
        const track2MinAchievementBps = (0, http_1.parseNonNegativeInt)(req.body.track2MinAchievementBps, "track2MinAchievementBps");
        if (track2MinAchievementBps > 10_000) {
            throw new http_1.HttpError(400, "INVALID_INPUT", "track2MinAchievementBps must be <= 10000");
        }
        const manifest = await prisma_1.prisma.contentManifest.findUnique({
            where: { id: manifestId },
            select: {
                id: true,
                creatorWallet: true,
                status: true,
            },
        });
        if (!manifest) {
            throw new http_1.HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
        }
        if (manifest.creatorWallet !== creatorWallet) {
            throw new http_1.HttpError(409, "CREATOR_MANIFEST_MISMATCH", "manifest does not belong to creatorWallet");
        }
        if (manifest.status !== client_1.ContentManifestStatus.READY &&
            manifest.status !== client_1.ContentManifestStatus.ANCHORED &&
            manifest.status !== client_1.ContentManifestStatus.PUBLISHED &&
            manifest.status !== client_1.ContentManifestStatus.LOCKED) {
            throw new http_1.HttpError(409, "MANIFEST_NOT_FINALIZED", "manifest must be READY, ANCHORED, PUBLISHED or LOCKED before creating an intent");
        }
        // Intents are DB-first drafts and do not become settlement truth until the chain transaction confirms.
        const intent = await prisma_1.prisma.proposalIntent.create({
            data: {
                creatorWallet,
                sponsorWallet,
                sponsorOrgId: (0, http_1.parseOptionalString)(req.body.sponsorOrgId),
                creatorOrgId: (0, http_1.parseOptionalString)(req.body.creatorOrgId),
                manifestId,
                deadlineUnix: (0, http_1.parseNonNegativeBigInt)(req.body.deadlineUnix, "deadlineUnix"),
                track1BaseUsdc: (0, http_1.parseNonNegativeBigInt)(req.body.track1BaseUsdc, "track1BaseUsdc"),
                track2MetricType: parseTrack2MetricType(req.body.track2MetricType),
                track2TargetValue: (0, http_1.parseNonNegativeBigInt)(req.body.track2TargetValue, "track2TargetValue"),
                track2MinAchievementBps,
                track2UsdcDeposited: (0, http_1.parseNonNegativeBigInt)(req.body.track2UsdcDeposited, "track2UsdcDeposited"),
                track3UsdcDeposited: (0, http_1.parseNonNegativeBigInt)(req.body.track3UsdcDeposited, "track3UsdcDeposited"),
                track3DelayDays: (0, http_1.parseNonNegativeInt)(req.body.track3DelayDays, "track3DelayDays"),
            },
        });
        (0, http_1.ok)(res, serializeIntent(intent), 201);
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "CREATE_PROPOSAL_INTENT_FAILED");
    }
};
exports.createProposalIntent = createProposalIntent;
const lockProposalIntent = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const requesterWallet = getRequesterWallet(req);
        const intentId = (0, http_1.parseNonEmptyString)(req.params.intentId, "intentId");
        const intent = await prisma_1.prisma.proposalIntent.findUnique({
            where: { id: intentId },
            include: {
                manifest: true,
            },
        });
        if (!intent) {
            throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
        }
        assertParticipant(requesterWallet, intent);
        if (intent.status !== client_1.ProposalIntentStatus.DRAFT) {
            throw new http_1.HttpError(409, "INTENT_ALREADY_LOCKED", "proposal intent is already locked");
        }
        if (!intent.manifest.manifestHashHex) {
            throw new http_1.HttpError(409, "MANIFEST_HASH_MISSING", "manifest must be finalized before locking");
        }
        const derived = (0, proposalLaunchService_1.deriveIntentAddresses)({
            creatorWallet: intent.creatorWallet,
            deadlineUnix: intent.deadlineUnix,
        });
        const locked = await prisma_1.prisma.$transaction(async (tx) => {
            // Locking freezes the exact content hash and derived PDAs so both parties sign against stable terms.
            const updatedIntent = await tx.proposalIntent.update({
                where: { id: intent.id },
                data: {
                    status: client_1.ProposalIntentStatus.TERMS_LOCKED,
                    version: {
                        increment: 1,
                    },
                    lockedManifestHashHex: intent.manifest.manifestHashHex,
                    lockedAnchorPda: intent.manifest.currentAnchorPda,
                    plannedProposalPda: derived.proposalPda,
                    plannedUsdcVaultPda: derived.proposalUsdcVaultPda,
                },
            });
            if (intent.manifest.status === client_1.ContentManifestStatus.READY) {
                await tx.contentManifest.update({
                    where: { id: intent.manifest.id },
                    data: {
                        status: client_1.ContentManifestStatus.LOCKED,
                    },
                });
            }
            return updatedIntent;
        });
        (0, http_1.ok)(res, serializeIntent(locked));
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "LOCK_PROPOSAL_INTENT_FAILED");
    }
};
exports.lockProposalIntent = lockProposalIntent;
const buildProposalLaunchBundle = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const requesterWallet = getRequesterWallet(req);
        const intentId = (0, http_1.parseNonEmptyString)(req.params.intentId, "intentId");
        const submitMode = parseBundleSubmitMode(req.body.submitMode);
        const forceRebuild = parseOptionalBoolean(req.body.forceRebuild);
        const intent = await prisma_1.prisma.proposalIntent.findUnique({
            where: { id: intentId },
            include: {
                manifest: true,
                txBundles: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 1,
                },
            },
        });
        if (!intent) {
            throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
        }
        assertParticipant(requesterWallet, intent);
        if (intent.txBundles[0] && !forceRebuild && (0, exports.isBundleReusable)(intent.txBundles[0])) {
            (0, http_1.ok)(res, {
                intentId: intent.id,
                plannedProposalPda: intent.plannedProposalPda,
                plannedContentAnchorPda: (0, proposalLaunchService_1.derivePlannedContentAnchorPda)({
                    creatorWallet: intent.creatorWallet,
                    manifest: intent.manifest,
                    lockedAnchorPda: intent.lockedAnchorPda,
                }),
                bundle: serializeBundle(intent.txBundles[0]),
                reused: true,
            });
            return;
        }
        if (intent.status !== client_1.ProposalIntentStatus.TERMS_LOCKED &&
            intent.status !== client_1.ProposalIntentStatus.BUNDLE_BUILT &&
            intent.status !== client_1.ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED &&
            intent.status !== client_1.ProposalIntentStatus.SPONSOR_SIGNED &&
            intent.status !== client_1.ProposalIntentStatus.SUBMITTED &&
            intent.status !== client_1.ProposalIntentStatus.FAILED &&
            intent.status !== client_1.ProposalIntentStatus.EXPIRED) {
            throw new http_1.HttpError(409, "INTENT_NOT_REBUILDABLE", "proposal intent must be terms-locked or in a rebuildable launch state before build");
        }
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const assembled = await (0, proposalLaunchService_1.buildLaunchBundleTransaction)({
            intent,
            manifest: intent.manifest,
        });
        const bundle = await prisma_1.prisma.$transaction(async (tx) => {
            const latestBundle = intent.txBundles[0];
            if (latestBundle && latestBundle.status !== client_1.BundleStatus.CONFIRMED && (0, exports.isBundleExpired)(latestBundle)) {
                await tx.txBundle.update({
                    where: { id: latestBundle.id },
                    data: {
                        status: client_1.BundleStatus.EXPIRED,
                        errorMessage: "bundle expired before submission completed",
                    },
                });
            }
            const createdBundle = await tx.txBundle.create({
                data: (0, proposalLaunchService_1.buildBundleRecord)({
                    intent,
                    instructionPlan: assembled.instructionPlan,
                    submitMode,
                    expiresAt,
                    versionedTxBase64: assembled.versionedTxBase64,
                    recentBlockhash: assembled.recentBlockhash,
                    lastValidBlockHeight: assembled.lastValidBlockHeight,
                }),
            });
            await tx.proposalIntent.update({
                where: { id: intent.id },
                data: {
                    status: client_1.ProposalIntentStatus.BUNDLE_BUILT,
                    version: {
                        increment: 1,
                    },
                    creatorApprovedAt: null,
                    sponsorApprovedAt: null,
                    chainTxSignature: null,
                    chainSubmittedAt: null,
                    chainConfirmedAt: null,
                    failureReason: null,
                },
            });
            return createdBundle;
        });
        (0, http_1.ok)(res, {
            intentId: intent.id,
            plannedProposalPda: intent.plannedProposalPda,
            plannedContentAnchorPda: assembled.plannedContentAnchorPda,
            bundle: serializeBundle(bundle),
            reused: false,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "BUILD_PROPOSAL_BUNDLE_FAILED");
    }
};
exports.buildProposalLaunchBundle = buildProposalLaunchBundle;
const creatorPartialSignBundle = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const requesterWallet = getRequesterWallet(req);
        const intentId = (0, http_1.parseNonEmptyString)(req.params.intentId, "intentId");
        const bundleId = (0, http_1.parseNonEmptyString)(req.body.bundleId, "bundleId");
        const partiallySignedTxBase64 = (0, http_1.parseNonEmptyString)(req.body.partiallySignedTxBase64, "partiallySignedTxBase64");
        const intent = await prisma_1.prisma.proposalIntent.findUnique({
            where: { id: intentId },
        });
        if (!intent) {
            throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
        }
        if (requesterWallet !== intent.creatorWallet) {
            throw new http_1.HttpError(403, "FORBIDDEN", "only the creator can submit the partial signature");
        }
        const bundle = await prisma_1.prisma.txBundle.findFirst({
            where: {
                id: bundleId,
                intentId,
            },
        });
        if (!bundle) {
            throw new http_1.HttpError(404, "BUNDLE_NOT_FOUND", "tx bundle not found");
        }
        if (bundle.status === client_1.BundleStatus.PARTIAL &&
            bundle.partiallySignedBase64 === partiallySignedTxBase64) {
            (0, http_1.ok)(res, {
                intentId,
                bundle: serializeBundle(bundle),
                replayed: true,
            });
            return;
        }
        if (bundle.status !== client_1.BundleStatus.BUILT) {
            throw new http_1.HttpError(409, "BUNDLE_NOT_BUILDABLE", "bundle must be in BUILT status");
        }
        if (!bundle.messageBase64) {
            throw new http_1.HttpError(409, "BUNDLE_MESSAGE_MISSING", "bundle is missing serialized transaction data");
        }
        if (bundle.expiresAt.getTime() <= Date.now()) {
            throw new http_1.HttpError(409, "BUNDLE_EXPIRED", "bundle has expired and must be rebuilt");
        }
        (0, proposalLaunchService_1.assertTransactionMessageMatches)(bundle.messageBase64, partiallySignedTxBase64);
        (0, proposalLaunchService_1.assertRequiredSignerPresent)(partiallySignedTxBase64, intent.creatorWallet);
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            // Creator approves the exact launch transaction message; payer responsibility is separated from author approval.
            const updatedBundle = await tx.txBundle.update({
                where: { id: bundle.id },
                data: {
                    partiallySignedBase64: partiallySignedTxBase64,
                    status: client_1.BundleStatus.PARTIAL,
                    errorMessage: null,
                },
            });
            await tx.proposalIntent.update({
                where: { id: intent.id },
                data: {
                    status: client_1.ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED,
                    version: {
                        increment: 1,
                    },
                    creatorApprovedAt: new Date(),
                },
            });
            return updatedBundle;
        });
        (0, http_1.ok)(res, {
            intentId,
            bundle: serializeBundle(updated),
            replayed: false,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "CREATOR_PARTIAL_SIGN_FAILED");
    }
};
exports.creatorPartialSignBundle = creatorPartialSignBundle;
const submitProposalBundle = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const requesterWallet = getRequesterWallet(req);
        const intentId = (0, http_1.parseNonEmptyString)(req.params.intentId, "intentId");
        const bundleId = (0, http_1.parseNonEmptyString)(req.body.bundleId, "bundleId");
        const fullySignedTxBase64 = (0, http_1.parseNonEmptyString)(req.body.fullySignedTxBase64, "fullySignedTxBase64");
        const intent = await prisma_1.prisma.proposalIntent.findUnique({
            where: { id: intentId },
        });
        if (!intent) {
            throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
        }
        if (requesterWallet !== intent.sponsorWallet) {
            throw new http_1.HttpError(403, "FORBIDDEN", "only the sponsor can submit the final signature");
        }
        const bundle = await prisma_1.prisma.txBundle.findFirst({
            where: {
                id: bundleId,
                intentId,
            },
        });
        if (!bundle) {
            throw new http_1.HttpError(404, "BUNDLE_NOT_FOUND", "tx bundle not found");
        }
        if (bundle.status !== client_1.BundleStatus.PARTIAL &&
            bundle.status !== client_1.BundleStatus.FAILED &&
            bundle.status !== client_1.BundleStatus.FULLY_SIGNED &&
            bundle.status !== client_1.BundleStatus.SUBMITTED &&
            bundle.status !== client_1.BundleStatus.CONFIRMED) {
            throw new http_1.HttpError(409, "BUNDLE_NOT_READY", "bundle must be partial, failed, or already submitted before final sponsor submission");
        }
        if (!bundle.messageBase64 || !bundle.recentBlockhash || bundle.lastValidBlockHeight === null) {
            throw new http_1.HttpError(409, "BUNDLE_MESSAGE_MISSING", "bundle is missing relay metadata");
        }
        if (bundle.expiresAt.getTime() <= Date.now()) {
            throw new http_1.HttpError(409, "BUNDLE_EXPIRED", "bundle has expired and must be rebuilt");
        }
        const chainTxSignature = (0, exports.extractTransactionSignature)(fullySignedTxBase64);
        if (bundle.chainTxSignature && bundle.chainTxSignature !== chainTxSignature) {
            throw new http_1.HttpError(409, "BUNDLE_SIGNATURE_MISMATCH", "submitted transaction signature does not match the stored bundle signature");
        }
        if (bundle.chainTxSignature && bundle.status === client_1.BundleStatus.CONFIRMED) {
            (0, http_1.ok)(res, {
                intentId,
                bundle: serializeBundle(bundle),
                relayStatus: "ALREADY_CONFIRMED",
                chainTxSignature: bundle.chainTxSignature,
            });
            return;
        }
        (0, proposalLaunchService_1.assertTransactionMessageMatches)(bundle.messageBase64, fullySignedTxBase64);
        (0, proposalLaunchService_1.assertRequiredSignerPresent)(fullySignedTxBase64, intent.creatorWallet);
        (0, proposalLaunchService_1.assertRequiredSignerPresent)(fullySignedTxBase64, intent.sponsorWallet);
        if (bundle.submitMode === client_1.BundleSubmitMode.CLIENT_RELAY) {
            if (bundle.status === client_1.BundleStatus.FULLY_SIGNED && bundle.fullySignedBase64 === fullySignedTxBase64) {
                (0, http_1.ok)(res, {
                    intentId,
                    bundle: serializeBundle(bundle),
                    relayStatus: "CLIENT_RELAY_PENDING",
                });
                return;
            }
            const updated = await prisma_1.prisma.$transaction(async (tx) => {
                const updatedBundle = await tx.txBundle.update({
                    where: { id: bundle.id },
                    data: {
                        fullySignedBase64: fullySignedTxBase64,
                        status: client_1.BundleStatus.FULLY_SIGNED,
                        chainTxSignature,
                        errorMessage: null,
                    },
                });
                await tx.proposalIntent.update({
                    where: { id: intent.id },
                    data: {
                        status: client_1.ProposalIntentStatus.SPONSOR_SIGNED,
                        version: {
                            increment: 1,
                        },
                        sponsorApprovedAt: new Date(),
                        chainTxSignature,
                    },
                });
                return updatedBundle;
            });
            (0, http_1.ok)(res, {
                intentId,
                bundle: serializeBundle(updated),
                relayStatus: "CLIENT_RELAY_PENDING",
            });
            return;
        }
        const anchorService = (0, AnchorService_1.getAnchorService)();
        if (bundle.status === client_1.BundleStatus.SUBMITTED && bundle.chainTxSignature === chainTxSignature) {
            const signatureState = await anchorService.getSignatureState(chainTxSignature);
            if (signatureState === "SUCCESS") {
                const confirmedProposal = await finalizeConfirmedLaunchBundle({
                    intentId,
                    bundleId: bundle.id,
                    fullySignedTxBase64,
                    chainTxSignature,
                });
                (0, http_1.ok)(res, {
                    intentId,
                    bundle: serializeBundle(confirmedProposal),
                    relayStatus: "CONFIRMED",
                    chainTxSignature,
                });
                return;
            }
            if (signatureState === "PENDING") {
                (0, http_1.ok)(res, {
                    intentId,
                    bundle: serializeBundle(bundle),
                    relayStatus: "SUBMITTED_PENDING",
                    chainTxSignature,
                });
                return;
            }
        }
        const submittedBundle = await prisma_1.prisma.$transaction(async (tx) => {
            const updatedBundle = await tx.txBundle.update({
                where: { id: bundle.id },
                data: {
                    fullySignedBase64: fullySignedTxBase64,
                    status: client_1.BundleStatus.SUBMITTED,
                    chainTxSignature,
                    errorMessage: null,
                },
            });
            await tx.proposalIntent.update({
                where: { id: intent.id },
                data: {
                    status: client_1.ProposalIntentStatus.SUBMITTED,
                    version: {
                        increment: 1,
                    },
                    sponsorApprovedAt: new Date(),
                    chainTxSignature,
                    chainSubmittedAt: new Date(),
                    failureReason: null,
                },
            });
            return updatedBundle;
        });
        try {
            const submittedSignature = await anchorService.sendVersionedTransaction(fullySignedTxBase64);
            if (submittedSignature !== chainTxSignature) {
                throw new Error(`submitted signature mismatch: expected ${chainTxSignature}, got ${submittedSignature}`);
            }
            await anchorService.confirmSubmittedVersionedTransaction({
                signature: chainTxSignature,
                recentBlockhash: bundle.recentBlockhash,
                lastValidBlockHeight: bundle.lastValidBlockHeight,
            });
            const confirmedProposal = await finalizeConfirmedLaunchBundle({
                intentId,
                bundleId: bundle.id,
                fullySignedTxBase64,
                chainTxSignature,
            });
            (0, http_1.ok)(res, {
                intentId,
                bundle: serializeBundle(confirmedProposal),
                relayStatus: "CONFIRMED",
                chainTxSignature,
            });
            return;
        }
        catch (error) {
            const signatureState = await anchorService.getSignatureState(chainTxSignature);
            if (signatureState === "SUCCESS") {
                const confirmedProposal = await finalizeConfirmedLaunchBundle({
                    intentId,
                    bundleId: bundle.id,
                    fullySignedTxBase64,
                    chainTxSignature,
                });
                (0, http_1.ok)(res, {
                    intentId,
                    bundle: serializeBundle(confirmedProposal),
                    relayStatus: "CONFIRMED",
                    chainTxSignature,
                });
                return;
            }
            if (signatureState === "PENDING") {
                (0, http_1.ok)(res, {
                    intentId,
                    bundle: serializeBundle(submittedBundle),
                    relayStatus: "SUBMITTED_PENDING",
                    chainTxSignature,
                });
                return;
            }
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.txBundle.update({
                    where: { id: bundle.id },
                    data: {
                        status: client_1.BundleStatus.FAILED,
                        chainTxSignature,
                        fullySignedBase64: fullySignedTxBase64,
                        errorMessage: error instanceof Error ? error.message : "bundle relay failed",
                    },
                });
                await tx.proposalIntent.update({
                    where: { id: intent.id },
                    data: {
                        status: client_1.ProposalIntentStatus.FAILED,
                        version: {
                            increment: 1,
                        },
                        failureReason: error instanceof Error ? error.message : "bundle relay failed",
                    },
                });
            });
            throw new http_1.HttpError(502, "BUNDLE_RELAY_FAILED", error instanceof Error ? error.message : "bundle relay failed");
        }
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "SUBMIT_PROPOSAL_BUNDLE_FAILED");
    }
};
exports.submitProposalBundle = submitProposalBundle;
const getProposalIntentStatus = async (req, res) => {
    try {
        const intentId = (0, http_1.parseNonEmptyString)(req.params.intentId, "intentId");
        const intent = await prisma_1.prisma.proposalIntent.findUnique({
            where: { id: intentId },
            include: {
                txBundles: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 1,
                },
            },
        });
        if (!intent) {
            throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
        }
        (0, http_1.ok)(res, {
            intent: serializeIntent(intent),
            latestBundle: intent.txBundles[0] ? serializeBundle(intent.txBundles[0]) : null,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "GET_PROPOSAL_INTENT_STATUS_FAILED");
    }
};
exports.getProposalIntentStatus = getProposalIntentStatus;
const listProposalIntents = async (req, res) => {
    try {
        const requesterWallet = requireAuthenticatedWallet(req);
        const intents = await prisma_1.prisma.proposalIntent.findMany({
            where: {
                OR: [{ creatorWallet: requesterWallet }, { sponsorWallet: requesterWallet }],
            },
            include: {
                manifest: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        contentType: true,
                        manifestHashHex: true,
                        currentAnchorPda: true,
                    },
                },
                txBundles: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 1,
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        });
        (0, http_1.ok)(res, intents.map((intent) => ({
            ...serializeIntent(intent),
            manifest: intent.manifest
                ? {
                    manifestId: intent.manifest.id,
                    title: intent.manifest.title,
                    status: intent.manifest.status,
                    contentType: intent.manifest.contentType,
                    manifestHashHex: intent.manifest.manifestHashHex,
                    currentAnchorPda: intent.manifest.currentAnchorPda,
                }
                : null,
            latestBundle: intent.txBundles[0] ? serializeBundle(intent.txBundles[0]) : null,
            viewerRole: requesterWallet === intent.creatorWallet
                ? "CREATOR"
                : requesterWallet === intent.sponsorWallet
                    ? "SPONSOR"
                    : "OBSERVER",
        })));
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "LIST_PROPOSAL_INTENTS_FAILED");
    }
};
exports.listProposalIntents = listProposalIntents;
const getProposalIntentById = async (req, res) => {
    try {
        const requesterWallet = requireAuthenticatedWallet(req);
        const intentId = (0, http_1.parseNonEmptyString)(req.params.intentId, "intentId");
        const intent = await prisma_1.prisma.proposalIntent.findUnique({
            where: { id: intentId },
            include: {
                manifest: {
                    include: {
                        assets: {
                            orderBy: {
                                orderIndex: "asc",
                            },
                        },
                    },
                },
                txBundles: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                proposal: true,
            },
        });
        if (!intent) {
            throw new http_1.HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
        }
        assertParticipant(requesterWallet, intent);
        (0, http_1.ok)(res, {
            intent: serializeIntent(intent),
            viewerRole: requesterWallet === intent.creatorWallet ? "CREATOR" : "SPONSOR",
            manifest: intent.manifest
                ? {
                    manifestId: intent.manifest.id,
                    title: intent.manifest.title,
                    contentType: intent.manifest.contentType,
                    status: intent.manifest.status,
                    version: intent.manifest.version,
                    manifestHashHex: intent.manifest.manifestHashHex,
                    currentAnchorPda: intent.manifest.currentAnchorPda,
                    assets: intent.manifest.assets.map((asset) => ({
                        assetId: asset.id,
                        assetType: asset.assetType,
                        orderIndex: asset.orderIndex,
                        uploadStatus: asset.uploadStatus,
                        processingStatus: asset.processingStatus,
                        muxPlaybackId: asset.muxPlaybackId,
                    })),
                }
                : null,
            proposal: intent.proposal ? serializeProposal(intent.proposal) : null,
            bundles: intent.txBundles.map(serializeBundle),
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "GET_PROPOSAL_INTENT_FAILED");
    }
};
exports.getProposalIntentById = getProposalIntentById;
const getProposalById = async (req, res) => {
    try {
        const id = (0, http_1.parseNonEmptyString)(req.params.id, "id");
        const proposal = await prisma_1.prisma.proposal.findFirst({
            where: {
                OR: [{ id }, { proposalPda: id }],
            },
        });
        if (!proposal) {
            throw new http_1.HttpError(404, "PROPOSAL_NOT_FOUND", "proposal not found");
        }
        const requesterWallet = req.auth?.source === "session" ? req.auth.wallet : null;
        const isCreatorOrSponsor = requesterWallet !== null &&
            (requesterWallet === proposal.creatorWallet || requesterWallet === proposal.sponsorWallet);
        if (isCreatorOrSponsor) {
            (0, http_1.ok)(res, {
                viewerRole: "CREATOR_OR_SPONSOR",
                proposal: serializeProposal(proposal),
            });
            return;
        }
        (0, http_1.ok)(res, {
            viewerRole: "PUBLIC_FAN",
            proposal: {
                id: proposal.id,
                proposalPda: proposal.proposalPda,
                creatorWallet: proposal.creatorWallet,
                deadlineAt: proposal.deadlineAt.toISOString(),
                status: proposal.status,
                track2MetricType: proposal.track2MetricType,
                track2TargetValue: proposal.track2TargetValue.toString(),
                track2MinAchievementBps: proposal.track2MinAchievementBps,
                track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
                track2ActualValue: proposal.track2ActualValue?.toString() ?? null,
                track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
            },
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "GET_PROPOSAL_FAILED");
    }
};
exports.getProposalById = getProposalById;
