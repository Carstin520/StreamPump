"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToHybridStorage = void 0;
/**
 * CN: 旧版双存储上传服务，将文件写入 origin 存储与 edge 存储。
 * EN: Legacy dual-storage upload service that writes files to both origin and edge object storage.
 */
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const default_1 = require("../../config/default");
const buildClient = (storageConfig, forcePathStyle = false) => {
    const hasExplicitCredentials = storageConfig.accessKeyId && storageConfig.secretAccessKey;
    return new client_s3_1.S3Client({
        region: storageConfig.region,
        endpoint: storageConfig.endpoint,
        forcePathStyle,
        credentials: hasExplicitCredentials
            ? {
                accessKeyId: storageConfig.accessKeyId,
                secretAccessKey: storageConfig.secretAccessKey,
            }
            : undefined,
    });
};
const originClient = buildClient(default_1.config.storage.origin);
const edgeClient = buildClient(default_1.config.storage.edge, true);
const buildObjectKey = (creatorId, videoId, fileName) => {
    const extension = path_1.default.extname(fileName) || ".mp4";
    return `videos/${creatorId}/${videoId}${extension}`;
};
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const buildPublicUrl = (storageConfig, objectKey) => {
    if (storageConfig.publicBaseUrl) {
        return `${storageConfig.publicBaseUrl.replace(/\/$/, "")}/${objectKey}`;
    }
    return `s3://${storageConfig.bucket}/${objectKey}`;
};
const uploadToHybridStorage = async (request) => {
    // The same object is written to origin and edge buckets so prototype links resolve from both sides.
    const objectKey = buildObjectKey(request.creatorId, request.videoId, request.fileName);
    const contentSha256 = sha256(request.fileBuffer);
    await originClient.send(new client_s3_1.PutObjectCommand({
        Bucket: default_1.config.storage.origin.bucket,
        Key: objectKey,
        Body: request.fileBuffer,
        ContentType: request.contentType,
        Metadata: {
            creatorId: request.creatorId,
            videoId: request.videoId,
            sha256: contentSha256,
        },
    }));
    await edgeClient.send(new client_s3_1.PutObjectCommand({
        Bucket: default_1.config.storage.edge.bucket,
        Key: objectKey,
        Body: request.fileBuffer,
        ContentType: request.contentType,
        Metadata: {
            originObjectKey: objectKey,
            sha256: contentSha256,
        },
    }));
    const originUrl = buildPublicUrl(default_1.config.storage.origin, objectKey);
    const edgeUrl = buildPublicUrl(default_1.config.storage.edge, objectKey);
    return {
        objectKey,
        contentSha256,
        originUrl,
        edgeUrl,
        canonicalUrl: originUrl,
    };
};
exports.uploadToHybridStorage = uploadToHybridStorage;
