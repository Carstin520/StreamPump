"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeContentType = exports.computeManifestFinalizeState = exports.buildCanonicalManifestJson = exports.buildInternalCanonicalUrl = exports.keccakHex = exports.sha256Hex = void 0;
/**
 * CN: 内容清单服务，负责 canonical manifest 生成、摘要计算和 anchor 地址推导。
 * EN: Content manifest service responsible for canonical manifest generation, digest computation, and anchor address derivation.
 */
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const sha3_1 = require("@noble/hashes/sha3");
const web3_js_1 = require("@solana/web3.js");
const default_1 = require("../../config/default");
const AnchorService_1 = require("./AnchorService");
const sortTags = (tags) => {
    if (!Array.isArray(tags)) {
        return [];
    }
    return tags
        .map((tag) => String(tag ?? "").trim())
        .filter((tag) => tag.length > 0)
        .sort((left, right) => left.localeCompare(right));
};
const sha256Hex = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
exports.sha256Hex = sha256Hex;
const keccakHex = (value) => Buffer.from((0, sha3_1.keccak_256)(new TextEncoder().encode(value))).toString("hex");
exports.keccakHex = keccakHex;
const buildInternalCanonicalUrl = (manifestId, version) => {
    const base = default_1.config.app.apiBaseUrl.replace(/\/$/, "");
    return `${base}/content/manifests/${manifestId}/v/${version}`;
};
exports.buildInternalCanonicalUrl = buildInternalCanonicalUrl;
const buildCanonicalManifestJson = (params) => {
    // Asset order must be deterministic, otherwise the same content package would hash to different digests.
    const orderedAssets = [...params.assets]
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((asset) => ({
        type: asset.assetType,
        index: asset.orderIndex,
        sha256: asset.sha256Hex,
        mimeType: asset.mimeType,
        fileSizeBytes: asset.fileSizeBytes.toString(),
        durationMs: asset.durationMs ?? null,
    }));
    return {
        version: params.manifest.version,
        contentType: params.manifest.contentType,
        title: params.manifest.title ?? null,
        captionTextHash: (0, exports.sha256Hex)(params.manifest.captionText ?? ""),
        tags: sortTags(params.manifest.tagsJson),
        coverAssetIndex: orderedAssets.find((asset) => asset.type === "COVER")?.index ??
            orderedAssets[0]?.index ??
            0,
        assets: orderedAssets,
        sourcePlatform: "INTERNAL_DRAFT",
    };
};
exports.buildCanonicalManifestJson = buildCanonicalManifestJson;
const computeManifestFinalizeState = (params) => {
    // Finalization computes every artifact needed by the later hybrid proposal-launch flow.
    const canonicalManifestJson = (0, exports.buildCanonicalManifestJson)(params);
    const canonicalManifestString = JSON.stringify(canonicalManifestJson);
    const internalCanonicalUrl = (0, exports.buildInternalCanonicalUrl)(params.manifest.id, params.manifest.version);
    const internalUrlDigestHex = (0, exports.keccakHex)(internalCanonicalUrl);
    const creator = new web3_js_1.PublicKey(params.manifest.creatorWallet);
    const anchorService = (0, AnchorService_1.getAnchorService)();
    const creatorProfilePda = anchorService.deriveCreatorProfilePda(creator);
    const plannedContentAnchorPda = anchorService
        .deriveContentAnchorPda(creatorProfilePda, Uint8Array.from(Buffer.from(internalUrlDigestHex, "hex")))
        .toBase58();
    return {
        captionTextHash: (0, exports.sha256Hex)(params.manifest.captionText ?? ""),
        canonicalManifestJson,
        manifestHashHex: (0, exports.sha256Hex)(canonicalManifestString),
        internalCanonicalUrl,
        internalUrlDigestHex,
        plannedContentAnchorPda,
    };
};
exports.computeManifestFinalizeState = computeManifestFinalizeState;
const normalizeContentType = (value) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "SHORT_VIDEO") {
        return client_1.ContentType.SHORT_VIDEO;
    }
    if (normalized === "IMAGE_CAROUSEL") {
        return client_1.ContentType.IMAGE_CAROUSEL;
    }
    if (normalized === "MIXED_MEDIA_NOTE") {
        return client_1.ContentType.MIXED_MEDIA_NOTE;
    }
    throw new Error("contentType must be one of: SHORT_VIDEO, IMAGE_CAROUSEL, MIXED_MEDIA_NOTE");
};
exports.normalizeContentType = normalizeContentType;
