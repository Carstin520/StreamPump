"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFeed = exports.uploadVideo = void 0;
const crypto_1 = require("crypto");
const storage_1 = require("../services/storage");
const digestHex = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const uploadVideo = async (req, res) => {
    const creatorId = String(req.body.creatorId ?? "unknown-creator");
    const fileName = String(req.body.fileName ?? "video.mp4");
    const contentType = String(req.body.contentType ?? "video/mp4");
    const base64Payload = String(req.body.fileBase64 ?? "");
    if (!base64Payload) {
        res.status(400).json({ error: "fileBase64 is required" });
        return;
    }
    const fileBuffer = Buffer.from(base64Payload, "base64");
    const videoId = String(req.body.videoId ?? (0, crypto_1.randomUUID)());
    const upload = await (0, storage_1.uploadToHybridStorage)({
        creatorId,
        videoId,
        fileName,
        fileBuffer,
        contentType,
    });
    res.status(201).json({
        status: "PENDING_REVIEW",
        creatorId,
        videoId,
        objectKey: upload.objectKey,
        edgeUrl: upload.edgeUrl,
        canonicalUrl: upload.canonicalUrl,
        canonicalUrlDigest: digestHex(upload.canonicalUrl),
        contentHash: upload.contentSha256,
    });
};
exports.uploadVideo = uploadVideo;
const listFeed = async (_req, res) => {
    res.json({
        items: [],
        message: "Traffic-futures feed index placeholder",
    });
};
exports.listFeed = listFeed;
