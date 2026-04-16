"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Service = exports.S3Service = exports.extensionForMimeType = exports.isVideoMimeType = exports.assertAllowedMimeType = void 0;
/**
 * CN: S3 原始存储服务，负责内容素材 presigned 上传与下载 URL 生成。
 * EN: S3 origin-storage service responsible for content asset presigned upload and download URLs.
 */
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const default_1 = require("../../config/default");
const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 15 * 60;
const ALLOWED_MIME_TYPES = new Set([
    "video/mp4",
    "video/quicktime",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
]);
const normalizeMimeType = (mimeType) => mimeType.trim().toLowerCase();
const assertAllowedMimeType = (mimeType) => {
    const normalized = normalizeMimeType(mimeType);
    if (!ALLOWED_MIME_TYPES.has(normalized)) {
        throw new Error("mimeType must be one of: video/mp4, video/quicktime, image/jpeg, image/png, image/webp, image/heic");
    }
};
exports.assertAllowedMimeType = assertAllowedMimeType;
const isVideoMimeType = (mimeType) => {
    const normalized = normalizeMimeType(mimeType);
    return normalized === "video/mp4" || normalized === "video/quicktime";
};
exports.isVideoMimeType = isVideoMimeType;
const extensionForMimeType = (mimeType) => {
    const normalized = normalizeMimeType(mimeType);
    switch (normalized) {
        case "video/mp4":
            return "mp4";
        case "video/quicktime":
            return "mov";
        case "image/jpeg":
            return "jpg";
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        case "image/heic":
            return "heic";
        default:
            throw new Error(`unsupported mimeType: ${mimeType}`);
    }
};
exports.extensionForMimeType = extensionForMimeType;
const buildS3Client = () => {
    const { origin } = default_1.config.storage;
    const hasExplicitCredentials = Boolean(origin.accessKeyId && origin.secretAccessKey);
    // The same client can target AWS S3 or any S3-compatible vendor by overriding endpoint and credentials.
    return new client_s3_1.S3Client({
        region: origin.region,
        endpoint: origin.endpoint,
        credentials: hasExplicitCredentials
            ? {
                accessKeyId: origin.accessKeyId,
                secretAccessKey: origin.secretAccessKey,
            }
            : undefined,
    });
};
class S3Service {
    client;
    constructor() {
        this.client = buildS3Client();
    }
    async generateUploadUrl(objectKey, mimeType) {
        const normalizedMimeType = normalizeMimeType(mimeType);
        (0, exports.assertAllowedMimeType)(normalizedMimeType);
        const bucket = default_1.config.storage.origin.bucket;
        if (!bucket) {
            throw new Error("S3_BUCKET is not configured");
        }
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ContentType: normalizedMimeType,
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, {
            expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
        });
        return {
            presignedUrl,
            expiresInSeconds: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
        };
    }
    async generateDownloadUrl(objectKey, expiresInSeconds = 3600) {
        if (!objectKey.trim()) {
            throw new Error("objectKey is required");
        }
        if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
            throw new Error("expiresInSeconds must be a positive number");
        }
        const bucket = default_1.config.storage.origin.bucket;
        if (!bucket) {
            throw new Error("S3_BUCKET is not configured");
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: objectKey,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.client, command, {
            expiresIn: Math.floor(expiresInSeconds),
        });
    }
    buildCanonicalUrl(objectKey) {
        const base = default_1.config.storage.origin.publicBaseUrl?.trim();
        if (base) {
            return `${base.replace(/\/$/, "")}/${objectKey}`;
        }
        return `s3://${default_1.config.storage.origin.bucket}/${objectKey}`;
    }
}
exports.S3Service = S3Service;
exports.s3Service = new S3Service();
