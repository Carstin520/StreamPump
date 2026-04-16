"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestMuxWebhook = void 0;
/**
 * CN: Mux Webhook 控制器，接收转码状态回调并回写 ContentAsset 处理状态。
 * EN: Mux webhook controller that ingests processing callbacks and updates ContentAsset state.
 */
const client_1 = require("@prisma/client");
const MuxService_1 = require("../services/MuxService");
const prisma_1 = require("../services/prisma");
const parseRawBody = (body) => {
    if (Buffer.isBuffer(body)) {
        return body.toString("utf8");
    }
    if (typeof body === "string") {
        return body;
    }
    if (body && typeof body === "object") {
        return JSON.stringify(body);
    }
    return "";
};
const parseWebhookEvent = (rawBody) => {
    return JSON.parse(rawBody);
};
const extractSignatureHeader = (req) => {
    const signature = req.header("mux-signature");
    if (!signature) {
        throw new Error("mux-signature header is required");
    }
    return signature;
};
const resolvePlaybackId = (event) => {
    const playbackId = event.data?.playback_ids?.[0]?.id;
    if (!playbackId || !playbackId.trim()) {
        return null;
    }
    return playbackId.trim();
};
const resolveErrorMessage = (event) => {
    const messages = event.data?.errors?.messages ?? [];
    if (messages.length === 0) {
        return "Mux asset processing failed";
    }
    return messages.join(",");
};
const ingestMuxWebhook = async (req, res) => {
    try {
        const rawBody = parseRawBody(req.body);
        if (!rawBody) {
            res.status(400).json({ error: "raw webhook body is required" });
            return;
        }
        const signatureHeader = extractSignatureHeader(req);
        try {
            MuxService_1.muxService.verifyWebhookSignature(rawBody, signatureHeader);
        }
        catch (error) {
            res.status(401).json({
                error: error instanceof Error ? error.message : "invalid mux webhook signature",
            });
            return;
        }
        let event;
        try {
            event = parseWebhookEvent(rawBody);
        }
        catch (_error) {
            res.status(400).json({ error: "invalid mux webhook payload" });
            return;
        }
        const eventType = String(event.type ?? "").trim();
        const muxAssetId = String(event.data?.id ?? "").trim();
        if (!eventType) {
            res.status(400).json({ error: "event.type is required" });
            return;
        }
        if (!muxAssetId) {
            res.status(400).json({ error: "event.data.id is required" });
            return;
        }
        if (eventType === "video.asset.ready") {
            const webhookReceivedAt = new Date();
            const playbackId = resolvePlaybackId(event);
            if (!playbackId) {
                await prisma_1.prisma.contentAsset.updateMany({
                    where: { muxAssetId },
                    data: {
                        processingStatus: client_1.AssetProcessingStatus.ERRORED,
                        processingSource: client_1.AssetProcessingSource.MUX_WEBHOOK,
                        muxLastKnownStatus: "ready",
                        muxWebhookReceivedAt: webhookReceivedAt,
                        processingError: "Mux ready event missing playback_id",
                    },
                });
                res.status(202).json({
                    received: true,
                    ignored: false,
                    reason: "ready-without-playback-id",
                    muxAssetId,
                });
                return;
            }
            await prisma_1.prisma.contentAsset.updateMany({
                where: { muxAssetId },
                data: {
                    processingStatus: client_1.AssetProcessingStatus.READY,
                    processingSource: client_1.AssetProcessingSource.MUX_WEBHOOK,
                    muxPlaybackId: playbackId,
                    muxLastKnownStatus: "ready",
                    muxWebhookReceivedAt: webhookReceivedAt,
                    muxReadyAt: webhookReceivedAt,
                    processingError: null,
                },
            });
            res.json({
                received: true,
                eventType,
                muxAssetId,
                muxPlaybackId: playbackId,
            });
            return;
        }
        if (eventType === "video.asset.errored") {
            const webhookReceivedAt = new Date();
            const errorMessage = resolveErrorMessage(event);
            await prisma_1.prisma.contentAsset.updateMany({
                where: {
                    muxAssetId,
                    processingStatus: {
                        not: client_1.AssetProcessingStatus.READY,
                    },
                },
                data: {
                    processingStatus: client_1.AssetProcessingStatus.ERRORED,
                    processingSource: client_1.AssetProcessingSource.MUX_WEBHOOK,
                    muxLastKnownStatus: "errored",
                    muxWebhookReceivedAt: webhookReceivedAt,
                    processingError: errorMessage,
                },
            });
            res.json({
                received: true,
                eventType,
                muxAssetId,
            });
            return;
        }
        res.json({
            received: true,
            ignored: true,
            eventType,
            muxAssetId,
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "failed to process mux webhook",
        });
    }
};
exports.ingestMuxWebhook = ingestMuxWebhook;
