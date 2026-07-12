/**
 * CN: Cloudflare R2 原始存储服务，负责内容素材 presigned 上传与下载 URL 生成。
 * EN: Cloudflare R2 origin-storage service for content asset presigned upload and download URLs.
 */
import {
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client as R2CompatibleClient,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "crypto";

import { config } from "../../config/default";

const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 15 * 60;
export const MULTIPART_UPLOAD_PART_SIZE_BYTES = 8 * 1024 * 1024;
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

type R2StorageConfig = typeof config.storage.origin | typeof config.storage.delivery;

const buildR2Client = (storage: R2StorageConfig): R2CompatibleClient => {
  const hasExplicitCredentials = Boolean(storage.accessKeyId && storage.secretAccessKey);

  // Cloudflare R2 uses the AWS SDK client as the transport for presigned object requests.
  return new R2CompatibleClient({
    region: storage.region,
    endpoint: storage.endpoint,
    credentials: hasExplicitCredentials
      ? {
          accessKeyId: storage.accessKeyId as string,
          secretAccessKey: storage.secretAccessKey as string,
        }
      : undefined,
  });
};

export interface PresignedUploadUrlResult {
  presignedUrl: string;
  expiresInSeconds: number;
}

export interface PresignedMultipartUploadPartResult {
  partNumber: number;
  presignedUrl: string;
  expiresInSeconds: number;
}

export interface PresignedMultipartUploadResult {
  uploadId: string;
  partCount: number;
  partSizeBytes: number;
  parts: PresignedMultipartUploadPartResult[];
}

export interface CompletedMultipartPart {
  partNumber: number;
  etag: string;
}

export interface StoredObjectInspection {
  contentType: string | null;
  etag: string | null;
  headSizeBytes: bigint | null;
  sha256Hex: string;
  sizeBytes: bigint;
}

export interface PromotedStoredObject {
  contentType: string | null;
  etag: string | null;
  sizeBytes: bigint | null;
}

const normalizeEtag = (value: string | undefined): string | null => {
  const normalized = value?.trim().replace(/^"+|"+$/g, "");
  return normalized || null;
};

const hashObjectBody = async (
  body: unknown,
  maxBytes: bigint
): Promise<{ sha256Hex: string; sizeBytes: bigint }> => {
  if (!body) {
    throw new Error("stored object response is missing a body");
  }

  const hash = createHash("sha256");
  let sizeBytes = 0n;
  const iterable = body as AsyncIterable<Uint8Array>;

  if (typeof iterable[Symbol.asyncIterator] !== "function") {
    throw new Error("stored object body is not stream-readable");
  }

  for await (const chunk of iterable) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    sizeBytes += BigInt(bytes.byteLength);
    if (sizeBytes > maxBytes) {
      throw new Error("stored object exceeds the declared verification size");
    }
  }

  return {
    sha256Hex: hash.digest("hex"),
    sizeBytes,
  };
};

export class R2Service {
  private readonly originClient: R2CompatibleClient;
  private readonly deliveryClient: R2CompatibleClient;

  constructor(clients?: {
    originClient?: R2CompatibleClient;
    deliveryClient?: R2CompatibleClient;
  }) {
    this.originClient = clients?.originClient ?? buildR2Client(config.storage.origin);
    this.deliveryClient = clients?.deliveryClient ?? buildR2Client(config.storage.delivery);
  }

  async generateUploadUrl(objectKey: string, mimeType: string): Promise<PresignedUploadUrlResult> {
    const normalizedMimeType = normalizeMimeType(mimeType);
    assertAllowedMimeType(normalizedMimeType);

    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: normalizedMimeType,
    });

    const presignedUrl = await getSignedUrl(this.originClient, command, {
      expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
    });

    return {
      presignedUrl,
      expiresInSeconds: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
    };
  }

  async putObject(
    objectKey: string,
    body: Uint8Array,
    mimeType: string,
    options?: {
      cacheControl?: string;
    }
  ): Promise<void> {
    const normalizedMimeType = normalizeMimeType(mimeType);
    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }

    await this.originClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        CacheControl: options?.cacheControl,
        ContentType: normalizedMimeType,
      })
    );
  }

  async putVerifiedObject(
    objectKey: string,
    body: Uint8Array,
    mimeType: string,
    options?: { cacheControl?: string }
  ): Promise<void> {
    const normalizedMimeType = normalizeMimeType(mimeType);
    const bucket = config.storage.delivery.bucket;
    if (!bucket) {
      throw new Error("public delivery bucket is not configured; set R2_DELIVERY_BUCKET");
    }

    await this.deliveryClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        CacheControl: options?.cacheControl,
        ContentType: normalizedMimeType,
      })
    );
  }

  async createMultipartUpload(
    objectKey: string,
    mimeType: string,
    fileSizeBytes: bigint
  ): Promise<PresignedMultipartUploadResult> {
    const normalizedMimeType = normalizeMimeType(mimeType);
    assertAllowedMimeType(normalizedMimeType);

    if (fileSizeBytes <= 0n) {
      throw new Error("fileSizeBytes must be greater than 0");
    }

    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }

    const createResult = await this.originClient.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: normalizedMimeType,
      })
    );
    const uploadId = String(createResult.UploadId ?? "").trim();

    if (!uploadId) {
      throw new Error("failed to create multipart upload");
    }

    const partCount = Math.ceil(Number(fileSizeBytes) / MULTIPART_UPLOAD_PART_SIZE_BYTES);
    const parts: PresignedMultipartUploadPartResult[] = [];

    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      const presignedUrl = await getSignedUrl(
        this.originClient,
        new UploadPartCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        {
          expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
        }
      );

      parts.push({
        partNumber,
        presignedUrl,
        expiresInSeconds: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
      });
    }

    return {
      uploadId,
      partCount,
      partSizeBytes: MULTIPART_UPLOAD_PART_SIZE_BYTES,
      parts,
    };
  }

  async completeMultipartUpload(
    objectKey: string,
    uploadId: string,
    parts: CompletedMultipartPart[]
  ): Promise<void> {
    const trimmedUploadId = uploadId.trim();
    if (!trimmedUploadId) {
      throw new Error("uploadId is required");
    }

    if (parts.length === 0) {
      throw new Error("parts must be a non-empty array");
    }

    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }

    await this.originClient.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: trimmedUploadId,
        MultipartUpload: {
          Parts: [...parts]
            .map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.etag.trim().replace(/^"+|"+$/g, ""),
            }))
            .sort((left, right) => left.PartNumber - right.PartNumber),
        },
      })
    );
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
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    return getSignedUrl(this.originClient, command, {
      expiresIn: Math.floor(expiresInSeconds),
    });
  }

  async generateVerifiedDownloadUrl(
    objectKey: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    if (!objectKey.trim()) {
      throw new Error("objectKey is required");
    }
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error("expiresInSeconds must be a positive number");
    }
    const bucket = config.storage.delivery.bucket;
    if (!bucket) {
      throw new Error("public delivery bucket is not configured; set R2_DELIVERY_BUCKET");
    }

    return getSignedUrl(
      this.deliveryClient,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { expiresIn: Math.floor(expiresInSeconds) }
    );
  }

  async inspectObject(objectKey: string, maxBytes: bigint): Promise<StoredObjectInspection> {
    const trimmedKey = objectKey.trim();
    if (!trimmedKey) {
      throw new Error("objectKey is required");
    }

    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }

    const head = await this.originClient.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: trimmedKey,
      })
    );
    if (
      head.ContentLength !== undefined &&
      head.ContentLength !== null &&
      BigInt(head.ContentLength) > maxBytes
    ) {
      throw new Error("stored object exceeds the declared verification size");
    }
    const object = await this.originClient.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: trimmedKey,
      })
    );
    const headEtag = normalizeEtag(head.ETag);
    const objectEtag = normalizeEtag(object.ETag);

    if (headEtag && objectEtag && headEtag !== objectEtag) {
      throw new Error("stored object changed during verification");
    }

    const digest = await hashObjectBody(object.Body, maxBytes);
    return {
      contentType: object.ContentType?.trim().toLowerCase() || head.ContentType?.trim().toLowerCase() || null,
      etag: objectEtag ?? headEtag,
      headSizeBytes:
        head.ContentLength === undefined || head.ContentLength === null
          ? null
          : BigInt(head.ContentLength),
      sha256Hex: digest.sha256Hex,
      sizeBytes: digest.sizeBytes,
    };
  }

  async promoteVerifiedObject(
    sourceKey: string,
    destinationKey: string,
    sourceEtag: string | null
  ): Promise<PromotedStoredObject> {
    const originBucket = config.storage.origin.bucket;
    const deliveryBucket = config.storage.delivery.bucket;
    if (!originBucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }
    if (!deliveryBucket) {
      throw new Error("public delivery bucket is not configured; set R2_DELIVERY_BUCKET");
    }
    if (originBucket === deliveryBucket) {
      throw new Error("R2_DELIVERY_BUCKET must differ from private R2_BUCKET");
    }

    const encodedSource = `${encodeURIComponent(originBucket)}/${sourceKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
    await this.deliveryClient.send(
      new CopyObjectCommand({
        Bucket: deliveryBucket,
        Key: destinationKey,
        CopySource: encodedSource,
        ...(sourceEtag ? { CopySourceIfMatch: `"${sourceEtag}"` } : {}),
      })
    );
    const head = await this.deliveryClient.send(
      new HeadObjectCommand({
        Bucket: deliveryBucket,
        Key: destinationKey,
      })
    );

    const promoted = {
      contentType: head.ContentType?.trim().toLowerCase() || null,
      etag: normalizeEtag(head.ETag),
      sizeBytes:
        head.ContentLength === undefined || head.ContentLength === null
          ? null
          : BigInt(head.ContentLength),
    };
    await this.deleteOriginObject(sourceKey);
    return promoted;
  }

  async deleteOriginObject(objectKey: string): Promise<void> {
    const trimmedKey = objectKey.trim();
    if (!trimmedKey) {
      throw new Error("objectKey is required");
    }
    const bucket = config.storage.origin.bucket;
    if (!bucket) {
      throw new Error("object storage bucket is not configured; set R2_BUCKET");
    }
    await this.originClient.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: trimmedKey })
    );
  }

  buildCanonicalUrl(objectKey: string): string {
    const base = config.storage.delivery.publicBaseUrl?.trim();
    if (base) {
      return `${base.replace(/\/$/, "")}/${objectKey}`;
    }

    return `r2://${config.storage.delivery.bucket}/${objectKey}`;
  }
}

export const r2Service = new R2Service();
