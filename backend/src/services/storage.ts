import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import path from "path";

import { config } from "../../config/default";

interface StorageConfig {
  region: string;
  bucket: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
}

export interface HybridUploadRequest {
  creatorId: string;
  videoId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}

export interface HybridUploadResult {
  objectKey: string;
  contentSha256: string;
  originUrl: string;
  edgeUrl: string;
  canonicalUrl: string;
}

const buildClient = (storageConfig: StorageConfig, forcePathStyle = false) => {
  const hasExplicitCredentials =
    storageConfig.accessKeyId && storageConfig.secretAccessKey;

  return new S3Client({
    region: storageConfig.region,
    endpoint: storageConfig.endpoint,
    forcePathStyle,
    credentials: hasExplicitCredentials
      ? {
          accessKeyId: storageConfig.accessKeyId as string,
          secretAccessKey: storageConfig.secretAccessKey as string,
        }
      : undefined,
  });
};

const originClient = buildClient(config.storage.origin);
const edgeClient = buildClient(config.storage.edge, true);

const buildObjectKey = (creatorId: string, videoId: string, fileName: string) => {
  const extension = path.extname(fileName) || ".mp4";
  return `videos/${creatorId}/${videoId}${extension}`;
};

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

const buildPublicUrl = (storageConfig: StorageConfig, objectKey: string) => {
  if (storageConfig.publicBaseUrl) {
    return `${storageConfig.publicBaseUrl.replace(/\/$/, "")}/${objectKey}`;
  }

  return `s3://${storageConfig.bucket}/${objectKey}`;
};

export const uploadToHybridStorage = async (
  request: HybridUploadRequest
): Promise<HybridUploadResult> => {
  const objectKey = buildObjectKey(request.creatorId, request.videoId, request.fileName);
  const contentSha256 = sha256(request.fileBuffer);

  await originClient.send(
    new PutObjectCommand({
      Bucket: config.storage.origin.bucket,
      Key: objectKey,
      Body: request.fileBuffer,
      ContentType: request.contentType,
      Metadata: {
        creatorId: request.creatorId,
        videoId: request.videoId,
        sha256: contentSha256,
      },
    })
  );

  await edgeClient.send(
    new PutObjectCommand({
      Bucket: config.storage.edge.bucket,
      Key: objectKey,
      Body: request.fileBuffer,
      ContentType: request.contentType,
      Metadata: {
        originObjectKey: objectKey,
        sha256: contentSha256,
      },
    })
  );

  const originUrl = buildPublicUrl(config.storage.origin, objectKey);
  const edgeUrl = buildPublicUrl(config.storage.edge, objectKey);

  return {
    objectKey,
    contentSha256,
    originUrl,
    edgeUrl,
    canonicalUrl: originUrl,
  };
};
