"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.muxService = exports.MuxService = void 0;
/**
 * CN: Mux 服务封装，负责创建视频资产和校验 Mux webhook 签名。
 * EN: Mux service wrapper that creates video assets and verifies Mux webhook signatures.
 */
const mux_node_1 = __importDefault(require("@mux/mux-node"));
const MUX_TIMEOUT_MS = Number(process.env.MUX_REQUEST_TIMEOUT_MS ?? 20_000);
class MuxTimeoutError extends Error {
    constructor(operation, timeoutMs) {
        super(`Mux timeout after ${timeoutMs}ms (${operation})`);
        this.name = "MuxTimeoutError";
    }
}
class MuxService {
    static instance = null;
    client;
    constructor() {
        this.client = new mux_node_1.default({
            tokenId: process.env.MUX_TOKEN_ID,
            tokenSecret: process.env.MUX_TOKEN_SECRET,
        });
    }
    static getInstance() {
        if (!MuxService.instance) {
            MuxService.instance = new MuxService();
        }
        return MuxService.instance;
    }
    async createAsset(videoUrl) {
        const trimmedUrl = videoUrl.trim();
        if (!trimmedUrl) {
            throw new Error("videoUrl is required");
        }
        this.assertApiCredentials();
        try {
            // Public playback keeps the current prototype simple; access control can be layered on later.
            const asset = await this.withTimeout(this.client.video.assets.create({
                inputs: [{ url: trimmedUrl }],
                playback_policies: ["public"],
                video_quality: "basic",
            }), "create asset");
            if (!asset.id) {
                throw new Error("Mux response did not include asset id");
            }
            return asset.id;
        }
        catch (error) {
            throw this.wrapMuxError("createAsset", error);
        }
    }
    async getAsset(muxAssetId) {
        const trimmedMuxAssetId = muxAssetId.trim();
        if (!trimmedMuxAssetId) {
            throw new Error("muxAssetId is required");
        }
        this.assertApiCredentials();
        try {
            return await this.withTimeout(this.client.video.assets.retrieve(trimmedMuxAssetId), "get asset");
        }
        catch (error) {
            throw this.wrapMuxError("getAsset", error);
        }
    }
    async getAssetStatus(muxAssetId) {
        const asset = await this.getAsset(muxAssetId);
        return this.normalizeAssetStatus(asset, muxAssetId);
    }
    normalizeAssetStatus(asset, fallbackMuxAssetId) {
        const playbackId = Array.isArray(asset?.playback_ids)
            ? String(asset.playback_ids.find((candidate) => candidate?.id)?.id ?? "").trim() || null
            : null;
        const errorMessages = Array.isArray(asset?.errors?.messages)
            ? asset.errors.messages.map((message) => String(message))
            : [];
        return {
            muxAssetId: String(asset?.id ?? fallbackMuxAssetId ?? "").trim(),
            status: String(asset?.status ?? "").trim().toLowerCase() || "unknown",
            playbackId,
            errorMessage: errorMessages.length > 0 ? errorMessages.join(",") : null,
        };
    }
    verifyWebhookSignature(rawBody, signatureHeader) {
        const signature = signatureHeader.trim();
        if (!signature) {
            throw new Error("mux-signature header is required");
        }
        const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
        if (!body.trim()) {
            throw new Error("raw webhook body is required");
        }
        const webhookSecret = process.env.MUX_WEBHOOK_SECRET?.trim();
        if (!webhookSecret) {
            throw new Error("MUX_WEBHOOK_SECRET is not configured");
        }
        try {
            this.client.webhooks.verifySignature(body, {
                "mux-signature": signature,
            }, webhookSecret);
        }
        catch (error) {
            throw this.wrapMuxError("verifyWebhookSignature", error);
        }
    }
    assertApiCredentials() {
        if (!process.env.MUX_TOKEN_ID?.trim() || !process.env.MUX_TOKEN_SECRET?.trim()) {
            throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be configured");
        }
    }
    async withTimeout(promise, operation) {
        let timeoutId;
        try {
            const timeoutPromise = new Promise((_resolve, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new MuxTimeoutError(operation, MUX_TIMEOUT_MS));
                }, MUX_TIMEOUT_MS);
            });
            return await Promise.race([promise, timeoutPromise]);
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
    wrapMuxError(operation, error) {
        if (error instanceof MuxTimeoutError) {
            return error;
        }
        const message = String(error);
        if (message.toLowerCase().includes("timeout") ||
            message.includes("ETIMEDOUT") ||
            message.toLowerCase().includes("fetch failed")) {
            return new MuxTimeoutError(operation, MUX_TIMEOUT_MS);
        }
        return error instanceof Error ? error : new Error(message);
    }
}
exports.MuxService = MuxService;
exports.muxService = MuxService.getInstance();
