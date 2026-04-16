"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContentManifestById = exports.listContentManifests = exports.createContentPublication = exports.finalizeContentManifest = exports.completeManifestAssetUpload = exports.presignManifestAssets = exports.createContentManifest = void 0;
/**
 * CN: 内容清单控制器，负责 manifest 创建、素材预签名上传、完成回调和 publication 映射。
 * EN: Content manifest controller that handles manifest creation, asset presign/upload completion, and publication mapping.
 */
const client_1 = require("@prisma/client");
const http_1 = require("./http");
const contentManifestService_1 = require("../services/contentManifestService");
const MuxService_1 = require("../services/MuxService");
const prisma_1 = require("../services/prisma");
const S3Service_1 = require("../services/S3Service");
const MAX_ASSET_SIZE_BYTES = 100 * 1024 * 1024;
const requireAuthenticatedWallet = (req) => {
    if (!req.auth?.wallet || req.auth.source !== "session") {
        throw new http_1.HttpError(401, "AUTH_REQUIRED", "bearer session authentication is required");
    }
    return req.auth.wallet;
};
const normalizeAssetType = (value) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "IMAGE") {
        return client_1.AssetType.IMAGE;
    }
    if (normalized === "VIDEO") {
        return client_1.AssetType.VIDEO;
    }
    if (normalized === "COVER") {
        return client_1.AssetType.COVER;
    }
    throw new http_1.HttpError(400, "INVALID_INPUT", "assetType must be one of: IMAGE, VIDEO, COVER");
};
const assertAssetAndMimeTypeMatch = (assetType, mimeType) => {
    const video = (0, S3Service_1.isVideoMimeType)(mimeType);
    if (assetType === client_1.AssetType.VIDEO && !video) {
        throw new http_1.HttpError(400, "INVALID_INPUT", "VIDEO assets must use a video mimeType");
    }
    if ((assetType === client_1.AssetType.IMAGE || assetType === client_1.AssetType.COVER) && video) {
        throw new http_1.HttpError(400, "INVALID_INPUT", `${assetType} assets must use an image mimeType`);
    }
};
const serializeManifest = (manifest) => ({
    manifestId: manifest.id,
    creatorWallet: manifest.creatorWallet,
    contentType: manifest.contentType,
    status: manifest.status,
    version: manifest.version,
    manifestHashHex: manifest.manifestHashHex,
    currentAnchorPda: manifest.currentAnchorPda,
    currentAnchorTx: manifest.currentAnchorTx,
    createdAt: manifest.createdAt.toISOString(),
    updatedAt: manifest.updatedAt.toISOString(),
});
const serializeAsset = (asset) => ({
    assetId: asset.id,
    assetType: asset.assetType,
    orderIndex: asset.orderIndex,
    storageKey: asset.storageKey,
    uploadStatus: asset.uploadStatus,
    processingStatus: asset.processingStatus,
    muxAssetId: asset.muxAssetId,
    muxPlaybackId: asset.muxPlaybackId,
    muxLastKnownStatus: asset.muxLastKnownStatus,
    updatedAt: asset.updatedAt.toISOString(),
});
const serializePublication = (publication) => ({
    publicationId: publication.id,
    platform: publication.platform,
    externalUrl: publication.externalUrl,
    verificationStatus: publication.verificationStatus,
    verifiedAt: publication.verifiedAt?.toISOString() ?? null,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
});
const serializeManifestDetail = (manifest) => ({
    ...serializeManifest(manifest),
    title: manifest.title,
    captionText: manifest.captionText,
    tags: Array.isArray(manifest.tagsJson) ? manifest.tagsJson : [],
    metadata: manifest.metadataJson ?? null,
    internalCanonicalUrl: manifest.internalCanonicalUrl,
    internalUrlDigestHex: manifest.internalUrlDigestHex,
    coverAssetId: manifest.coverAssetId,
    assets: manifest.assets.map(serializeAsset),
    publications: manifest.publications.map(serializePublication),
});
const requireOwnedManifest = async (manifestId, creatorWallet) => {
    // Ownership is enforced at the DB layer so a creator cannot mutate another creator's content state.
    const manifest = await prisma_1.prisma.contentManifest.findFirst({
        where: {
            id: manifestId,
            creatorWallet,
        },
    });
    if (!manifest) {
        throw new http_1.HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
    }
    return manifest;
};
const createContentManifest = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const creatorWallet = requireAuthenticatedWallet(req);
        const contentType = (0, contentManifestService_1.normalizeContentType)(req.body.contentType);
        const title = (0, http_1.parseOptionalString)(req.body.title);
        const captionText = (0, http_1.parseOptionalString)(req.body.captionText);
        const tags = (0, http_1.parseStringArray)(req.body.tags, "tags");
        const metadataJson = (0, http_1.parseOptionalJsonObject)(req.body.metadata);
        const manifest = await prisma_1.prisma.contentManifest.create({
            data: {
                creatorWallet,
                contentType,
                status: client_1.ContentManifestStatus.DRAFT,
                title,
                captionText,
                tagsJson: tags,
                metadataJson,
            },
        });
        (0, http_1.ok)(res, serializeManifest(manifest), 201);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("contentType")) {
            (0, http_1.handleControllerError)(res, new http_1.HttpError(400, "INVALID_INPUT", error.message), "CREATE_CONTENT_MANIFEST_FAILED");
            return;
        }
        (0, http_1.handleControllerError)(res, error, "CREATE_CONTENT_MANIFEST_FAILED");
    }
};
exports.createContentManifest = createContentManifest;
const presignManifestAssets = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const creatorWallet = requireAuthenticatedWallet(req);
        const manifestId = (0, http_1.parseNonEmptyString)(req.params.manifestId, "manifestId");
        const manifest = await requireOwnedManifest(manifestId, creatorWallet);
        const inputs = Array.isArray(req.body.assets) ? req.body.assets : null;
        if (!inputs || inputs.length === 0) {
            throw new http_1.HttpError(400, "INVALID_INPUT", "assets must be a non-empty array");
        }
        const uploads = [];
        for (const rawAsset of inputs) {
            const assetType = normalizeAssetType(rawAsset.assetType);
            const orderIndex = (0, http_1.parseNonNegativeInt)(rawAsset.orderIndex, "orderIndex");
            const sha256HexDigest = (0, http_1.parseSha256Hex)(rawAsset.sha256Hex, "sha256Hex");
            const mimeType = (0, http_1.parseNonEmptyString)(rawAsset.mimeType, "mimeType").toLowerCase();
            const fileSizeBytes = (0, http_1.parseNonNegativeBigInt)(rawAsset.fileSizeBytes, "fileSizeBytes");
            if (fileSizeBytes > BigInt(MAX_ASSET_SIZE_BYTES)) {
                throw new http_1.HttpError(400, "INVALID_INPUT", `fileSizeBytes exceeds current limit (${MAX_ASSET_SIZE_BYTES} bytes)`);
            }
            (0, S3Service_1.assertAllowedMimeType)(mimeType);
            assertAssetAndMimeTypeMatch(assetType, mimeType);
            const extension = (0, S3Service_1.extensionForMimeType)(mimeType);
            // Storage keys remain deterministic inside one manifest version so asset hashing and audit traces stay stable.
            const storageKey = `content/${manifest.id}/v/${manifest.version}/${orderIndex}-${sha256HexDigest.slice(0, 12)}.${extension}`;
            const asset = await prisma_1.prisma.contentAsset.upsert({
                where: {
                    manifestId_orderIndex: {
                        manifestId: manifest.id,
                        orderIndex,
                    },
                },
                update: {
                    assetType,
                    sha256Hex: sha256HexDigest,
                    mimeType,
                    fileSizeBytes,
                    storageKey,
                    uploadStatus: client_1.AssetUploadStatus.PENDING,
                    processingStatus: client_1.AssetProcessingStatus.NONE,
                    processingError: null,
                },
                create: {
                    manifestId: manifest.id,
                    assetType,
                    orderIndex,
                    sha256Hex: sha256HexDigest,
                    mimeType,
                    fileSizeBytes,
                    storageKey,
                    uploadStatus: client_1.AssetUploadStatus.PENDING,
                    processingStatus: client_1.AssetProcessingStatus.NONE,
                },
            });
            const upload = await S3Service_1.s3Service.generateUploadUrl(storageKey, mimeType);
            uploads.push({
                assetId: asset.id,
                assetType,
                orderIndex,
                storageKey,
                presignedUrl: upload.presignedUrl,
                expiresInSeconds: upload.expiresInSeconds,
            });
        }
        await prisma_1.prisma.contentManifest.update({
            where: { id: manifest.id },
            data: {
                status: client_1.ContentManifestStatus.UPLOADING,
            },
        });
        (0, http_1.ok)(res, {
            manifestId: manifest.id,
            uploads,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "PRESIGN_MANIFEST_ASSETS_FAILED");
    }
};
exports.presignManifestAssets = presignManifestAssets;
const completeManifestAssetUpload = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const creatorWallet = requireAuthenticatedWallet(req);
        const manifestId = (0, http_1.parseNonEmptyString)(req.params.manifestId, "manifestId");
        const assetId = (0, http_1.parseNonEmptyString)(req.params.assetId, "assetId");
        const asset = await prisma_1.prisma.contentAsset.findFirst({
            where: {
                id: assetId,
                manifestId,
                manifest: {
                    creatorWallet,
                },
            },
            include: {
                manifest: true,
            },
        });
        if (!asset) {
            throw new http_1.HttpError(404, "ASSET_NOT_FOUND", "content asset not found");
        }
        // Current MVP trusts the upload completion signal from the client; object existence verification can be added later.
        let updated = await prisma_1.prisma.contentAsset.update({
            where: { id: asset.id },
            data: {
                uploadStatus: client_1.AssetUploadStatus.UPLOADED,
                cdnUrl: S3Service_1.s3Service.buildCanonicalUrl(asset.storageKey),
            },
        });
        if ((0, S3Service_1.isVideoMimeType)(asset.mimeType)) {
            try {
                // Video assets move into PREPARING while Mux asynchronously transcodes them and later calls back via webhook.
                const downloadUrl = await S3Service_1.s3Service.generateDownloadUrl(asset.storageKey, 3600);
                const muxAssetId = await MuxService_1.muxService.createAsset(downloadUrl);
                updated = await prisma_1.prisma.contentAsset.update({
                    where: { id: asset.id },
                    data: {
                        processingStatus: client_1.AssetProcessingStatus.PREPARING,
                        processingSource: client_1.AssetProcessingSource.CLIENT_COMPLETE,
                        muxAssetId,
                        muxLastKnownStatus: "created",
                        muxLastCheckedAt: null,
                        muxReadyAt: null,
                        muxReconcileAttempts: 0,
                        processingError: null,
                    },
                });
            }
            catch (error) {
                updated = await prisma_1.prisma.contentAsset.update({
                    where: { id: asset.id },
                    data: {
                        processingStatus: client_1.AssetProcessingStatus.ERRORED,
                        processingSource: client_1.AssetProcessingSource.CLIENT_COMPLETE,
                        muxLastKnownStatus: "errored",
                        processingError: error instanceof Error ? error.message : "failed to create mux asset",
                    },
                });
            }
        }
        else {
            updated = await prisma_1.prisma.contentAsset.update({
                where: { id: asset.id },
                data: {
                    processingStatus: client_1.AssetProcessingStatus.READY,
                    processingSource: client_1.AssetProcessingSource.CLIENT_COMPLETE,
                    processingError: null,
                },
            });
        }
        (0, http_1.ok)(res, {
            manifestId,
            asset: serializeAsset(updated),
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "COMPLETE_MANIFEST_ASSET_FAILED");
    }
};
exports.completeManifestAssetUpload = completeManifestAssetUpload;
const finalizeContentManifest = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const creatorWallet = requireAuthenticatedWallet(req);
        const manifestId = (0, http_1.parseNonEmptyString)(req.params.manifestId, "manifestId");
        const manifest = await prisma_1.prisma.contentManifest.findFirst({
            where: {
                id: manifestId,
                creatorWallet,
            },
            include: {
                assets: {
                    orderBy: {
                        orderIndex: "asc",
                    },
                },
            },
        });
        if (!manifest) {
            throw new http_1.HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
        }
        if (manifest.assets.length === 0) {
            throw new http_1.HttpError(409, "MANIFEST_EMPTY", "manifest must contain at least one asset");
        }
        const incomplete = manifest.assets.find((asset) => asset.uploadStatus !== client_1.AssetUploadStatus.UPLOADED);
        if (incomplete) {
            throw new http_1.HttpError(409, "ASSET_UPLOAD_INCOMPLETE", `asset ${incomplete.id} must reach UPLOADED before finalize`);
        }
        // Finalization freezes the current asset ordering and generates the canonical digest used by chain-facing flows.
        const finalized = (0, contentManifestService_1.computeManifestFinalizeState)({
            manifest,
            assets: manifest.assets,
        });
        const updated = await prisma_1.prisma.contentManifest.update({
            where: { id: manifest.id },
            data: {
                status: manifest.currentAnchorPda
                    ? client_1.ContentManifestStatus.ANCHORED
                    : client_1.ContentManifestStatus.READY,
                captionTextHash: finalized.captionTextHash,
                canonicalManifestJson: finalized.canonicalManifestJson,
                manifestHashHex: finalized.manifestHashHex,
                internalCanonicalUrl: finalized.internalCanonicalUrl,
                internalUrlDigestHex: finalized.internalUrlDigestHex,
            },
        });
        (0, http_1.ok)(res, {
            ...serializeManifest(updated),
            internalCanonicalUrl: updated.internalCanonicalUrl,
            internalUrlDigestHex: updated.internalUrlDigestHex,
            plannedContentAnchorPda: finalized.plannedContentAnchorPda,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "FINALIZE_MANIFEST_FAILED");
    }
};
exports.finalizeContentManifest = finalizeContentManifest;
const createContentPublication = async (req, res) => {
    try {
        (0, http_1.ensureIdempotencyKey)(req);
        const creatorWallet = requireAuthenticatedWallet(req);
        const manifestId = (0, http_1.parseNonEmptyString)(req.body.manifestId, "manifestId");
        await requireOwnedManifest(manifestId, creatorWallet);
        const platform = (0, http_1.parseNonEmptyString)(req.body.platform, "platform").toUpperCase();
        const externalUrl = (0, http_1.parseNonEmptyString)(req.body.externalUrl, "externalUrl");
        const externalPostId = (0, http_1.parseOptionalString)(req.body.externalPostId);
        const publication = await prisma_1.prisma.contentPublication.create({
            data: {
                manifestId,
                platform,
                externalUrl,
                externalUrlDigestHex: (0, contentManifestService_1.keccakHex)(externalUrl),
                externalPostIdHash: externalPostId ? (0, contentManifestService_1.sha256Hex)(externalPostId) : null,
                verificationStatus: client_1.PublicationVerificationStatus.PENDING,
            },
        });
        const manifestStatus = await prisma_1.prisma.contentManifest.findUnique({
            where: { id: manifestId },
            select: { status: true },
        });
        if (manifestStatus?.status === client_1.ContentManifestStatus.READY) {
            await prisma_1.prisma.contentManifest.update({
                where: { id: manifestId },
                data: {
                    status: client_1.ContentManifestStatus.PUBLISHED,
                },
            });
        }
        (0, http_1.ok)(res, {
            publicationId: publication.id,
            manifestId: publication.manifestId,
            platform: publication.platform,
            externalUrl: publication.externalUrl,
            verificationStatus: publication.verificationStatus,
            createdAt: publication.createdAt.toISOString(),
        }, 201);
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "CREATE_CONTENT_PUBLICATION_FAILED");
    }
};
exports.createContentPublication = createContentPublication;
const listContentManifests = async (req, res) => {
    try {
        const creatorWallet = requireAuthenticatedWallet(req);
        const manifests = await prisma_1.prisma.contentManifest.findMany({
            where: {
                creatorWallet,
            },
            orderBy: {
                updatedAt: "desc",
            },
            include: {
                assets: {
                    orderBy: {
                        orderIndex: "asc",
                    },
                },
            },
        });
        (0, http_1.ok)(res, manifests.map((manifest) => ({
            ...serializeManifest(manifest),
            title: manifest.title,
            assetCount: manifest.assets.length,
            assets: manifest.assets.map(serializeAsset),
        })));
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "LIST_CONTENT_MANIFESTS_FAILED");
    }
};
exports.listContentManifests = listContentManifests;
const getContentManifestById = async (req, res) => {
    try {
        const creatorWallet = requireAuthenticatedWallet(req);
        const manifestId = (0, http_1.parseNonEmptyString)(req.params.manifestId, "manifestId");
        const manifest = await prisma_1.prisma.contentManifest.findFirst({
            where: {
                id: manifestId,
                creatorWallet,
            },
            include: {
                assets: {
                    orderBy: {
                        orderIndex: "asc",
                    },
                },
                publications: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!manifest) {
            throw new http_1.HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
        }
        (0, http_1.ok)(res, serializeManifestDetail(manifest));
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "GET_CONTENT_MANIFEST_FAILED");
    }
};
exports.getContentManifestById = getContentManifestById;
