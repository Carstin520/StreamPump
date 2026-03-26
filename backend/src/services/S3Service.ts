/**
 * CN: S3 原始存储服务，负责内容素材 presigned 上传与下载 URL 生成。
 * EN: S3 origin-storage service responsible for content asset presigned upload and download URLs.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { config } from "../../config/default";

const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 15 * 60;
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const normalizeMimeType = (mimeType: string): string => mimeType.trim().toLowerCase();

export const assertAllowedMimeType = (mimeType: string): void => {
  const normalized = normalizeMimeType(mimeType);
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    throw new Error(
      "mimeType must be one of: video/mp4, video/quicktime, image/jpeg, image/png, image/webp, image/heic"
    );
  }
};

export const isVideoMimeType = (mimeType: string): boolean => {
  const normalized = normalizeMimeType(mimeType);
  return normalized === "video/mp4" || normalized === "video/quicktime";
};

export const extensionForMimeType = (mimeType: string): string => {
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

const buildS3Client = (): S3Client => {
  const { origin } = config.storage;
  const hasExplicitCredentials = Boolean(origin.accessKeyId && origin.secretAccessKey);

  // The same client can target AWS S3 or any S3-compatible vendor by overriding endpoint and credentials.
  return new S3Client({
    region: origin.region,
    endpoint: origin.endpoint,
    credentials: hasExplicitCredentials
      ? {
          accessKeyId: origin.accessKeyId as string,
          secretAccessKey: origin.secretAccessKey as string,
        }
      : undefined,
  });
};

export interface PresignedUploadUrlResult {
  presignedUrl: string;
  expiresInSeconds: number;
}

export class S3Service {
  private readonly client: S3Client;

  constructor() {
    this.client = buildS3Client();
  }

  async generateUploadUrl(objectKey: string, mimeType: string): Promise<PresignedUploadUrlResult> {
    const normalizedMimeType = normalizeMimeType(mimeType);
    assertAllowedMimeType(normalizedMimeType);

    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("S3_BUCKET is not configured");
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: normalizedMimeType,
    });

    const presignedUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
    });

    return {
      presignedUrl,
      expiresInSeconds: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
    };
  }

  async generateDownloadUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    if (!objectKey.trim()) {
      throw new Error("objectKey is required");
    }

    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error("expiresInSeconds must be a positive number");
    }

    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("S3_BUCKET is not configured");
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: Math.floor(expiresInSeconds),
    });
  }

  buildCanonicalUrl(objectKey: string): string {
    const base = config.storage.origin.publicBaseUrl?.trim();
    if (base) {
      return `${base.replace(/\/$/, "")}/${objectKey}`;
    }

    return `s3://${config.storage.origin.bucket}/${objectKey}`;
  }
}

export const s3Service = new S3Service();
