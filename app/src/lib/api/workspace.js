"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProposalById = exports.getProposalIntentById = exports.getProposalIntentStatus = exports.submitProposalBundle = exports.creatorPartialSignBundle = exports.buildProposalLaunchBundle = exports.lockProposalIntent = exports.createContentPublication = exports.finalizeContentManifest = exports.completeManifestAssetUpload = exports.presignManifestAssets = exports.createContentManifest = exports.getContentManifestById = exports.getWorkspaceOverview = void 0;
const client_1 = require("./client");
const createIdempotencyKey = (prefix) => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const getWorkspaceOverview = (token) => client_1.apiClient.get("/workspace", { token });
exports.getWorkspaceOverview = getWorkspaceOverview;
const getContentManifestById = (token, manifestId) => client_1.apiClient.get(`/content/manifests/${manifestId}`, { token });
exports.getContentManifestById = getContentManifestById;
const createContentManifest = (token, input) => client_1.apiClient.post("/content/manifests", {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("manifest"),
    },
    body: input,
});
exports.createContentManifest = createContentManifest;
const presignManifestAssets = (token, manifestId, assets) => client_1.apiClient.post(`/content/manifests/${manifestId}/assets/presign`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("presign"),
    },
    body: {
        assets,
    },
});
exports.presignManifestAssets = presignManifestAssets;
const completeManifestAssetUpload = (token, manifestId, assetId) => client_1.apiClient.post(`/content/manifests/${manifestId}/assets/${assetId}/complete`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("asset-complete"),
    },
});
exports.completeManifestAssetUpload = completeManifestAssetUpload;
const finalizeContentManifest = (token, manifestId) => client_1.apiClient.post(`/content/manifests/${manifestId}/finalize`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("manifest-finalize"),
    },
});
exports.finalizeContentManifest = finalizeContentManifest;
const createContentPublication = (token, input) => client_1.apiClient.post("/content/publications", {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("publication"),
    },
    body: input,
});
exports.createContentPublication = createContentPublication;
const lockProposalIntent = (token, intentId) => client_1.apiClient.post(`/proposal-intents/${intentId}/lock`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("intent-lock"),
    },
});
exports.lockProposalIntent = lockProposalIntent;
const buildProposalLaunchBundle = (token, intentId, input) => client_1.apiClient.post(`/proposal-intents/${intentId}/build-bundle`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("intent-build"),
    },
    body: input,
});
exports.buildProposalLaunchBundle = buildProposalLaunchBundle;
const creatorPartialSignBundle = (token, intentId, input) => client_1.apiClient.post(`/proposal-intents/${intentId}/creator-partial-sign`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("intent-creator-sign"),
    },
    body: input,
});
exports.creatorPartialSignBundle = creatorPartialSignBundle;
const submitProposalBundle = (token, intentId, input) => client_1.apiClient.post(`/proposal-intents/${intentId}/submit`, {
    token,
    headers: {
        "x-idempotency-key": createIdempotencyKey("intent-submit"),
    },
    body: input,
});
exports.submitProposalBundle = submitProposalBundle;
const getProposalIntentStatus = (token, intentId) => client_1.apiClient.get(`/proposal-intents/${intentId}/status`, { token });
exports.getProposalIntentStatus = getProposalIntentStatus;
const getProposalIntentById = (token, intentId) => client_1.apiClient.get(`/proposal-intents/${intentId}`, { token });
exports.getProposalIntentById = getProposalIntentById;
const getProposalById = (proposalId, token) => client_1.apiClient.get(`/proposals/${proposalId}`, token ? { token } : undefined);
exports.getProposalById = getProposalById;
