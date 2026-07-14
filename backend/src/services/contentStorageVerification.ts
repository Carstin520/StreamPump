import { r2Service, StoredObjectInspection } from "./R2Service";
import { AssetUploadStatus } from "@prisma/client";

export type ContentStorageVerificationInput = {
  storageKey: string;
  expectedSha256Hex: string;
  expectedSizeBytes: bigint;
  expectedMimeType: string;
};

export type VerifiedContentStorageObject = {
  sha256Hex: string;
  sizeBytes: bigint;
  contentType: string;
  etag: string | null;
};

export type InspectStoredObject = (
  storageKey: string,
  maxBytes: bigint
) => Promise<StoredObjectInspection>;

export class StorageObjectVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageObjectVerificationError";
  }
}

export const buildVerifiedStorageKey = (stagingKey: string, sha256Hex: string): string => {
  const extensionIndex = stagingKey.lastIndexOf(".");
  if (extensionIndex < 0) {
    return `${stagingKey}.verified-${sha256Hex.toLowerCase()}`;
  }
  return `${stagingKey.slice(0, extensionIndex)}.verified-${sha256Hex.toLowerCase()}${stagingKey.slice(extensionIndex)}`;
};

const normalizeMimeType = (value: string): string =>
  value.trim().toLowerCase().split(";", 1)[0];

export const verifyStoredContentAsset = async (
  input: ContentStorageVerificationInput,
  inspect: InspectStoredObject = (storageKey, maxBytes) =>
    r2Service.inspectObject(storageKey, maxBytes)
): Promise<VerifiedContentStorageObject> => {
  const observed = await inspect(input.storageKey, input.expectedSizeBytes);
  const expectedMimeType = normalizeMimeType(input.expectedMimeType);
  const observedMimeType = observed.contentType ? normalizeMimeType(observed.contentType) : "";

  if (observed.headSizeBytes !== null && observed.headSizeBytes !== observed.sizeBytes) {
    throw new StorageObjectVerificationError("stored object size changed during verification");
  }
  if (observed.sizeBytes !== input.expectedSizeBytes) {
    throw new StorageObjectVerificationError("stored object size does not match the upload declaration");
  }
  if (observed.sha256Hex.toLowerCase() !== input.expectedSha256Hex.toLowerCase()) {
    throw new StorageObjectVerificationError("stored object SHA-256 does not match the upload declaration");
  }
  if (!observedMimeType || observedMimeType !== expectedMimeType) {
    throw new StorageObjectVerificationError("stored object MIME type does not match the upload declaration");
  }
  if (!observed.etag) {
    throw new StorageObjectVerificationError("stored object ETag is missing");
  }

  return {
    sha256Hex: observed.sha256Hex.toLowerCase(),
    sizeBytes: observed.sizeBytes,
    contentType: observedMimeType,
    etag: observed.etag,
  };
};

export const assertPromotedObjectMatches = (
  promoted: { contentType: string | null; sizeBytes: bigint | null },
  verified: VerifiedContentStorageObject
): void => {
  const promotedMimeType = promoted.contentType ? normalizeMimeType(promoted.contentType) : "";
  if (promoted.sizeBytes !== verified.sizeBytes || promotedMimeType !== verified.contentType) {
    throw new StorageObjectVerificationError("verified object promotion did not preserve size and MIME type");
  }
};

export const isAssetStorageVerified = (asset: {
  sha256Hex: string;
  fileSizeBytes: bigint;
  verifiedSha256Hex: string | null;
  verifiedSizeBytes: bigint | null;
  storageVerifiedAt: Date | null;
}): boolean =>
  Boolean(asset.storageVerifiedAt) &&
  asset.verifiedSha256Hex?.toLowerCase() === asset.sha256Hex.toLowerCase() &&
  asset.verifiedSizeBytes === asset.fileSizeBytes;

export const shouldCompleteMultipartUpload = (params: {
  isVideo: boolean;
  uploadStatus: AssetUploadStatus;
}): boolean => params.isVideo && params.uploadStatus !== AssetUploadStatus.UPLOADED;

export const verifiedAssetMatchesUploadDeclaration = (params: {
  asset: {
    assetType: string;
    orderIndex: number;
    sha256Hex: string;
    mimeType: string;
    fileSizeBytes: bigint;
  };
  declaration: {
    assetType: string;
    orderIndex: number;
    sha256HexDigest: string;
    mimeType: string;
    fileSizeBytes: bigint;
  };
}): boolean =>
  params.asset.assetType === params.declaration.assetType &&
  params.asset.orderIndex === params.declaration.orderIndex &&
  params.asset.sha256Hex.toLowerCase() === params.declaration.sha256HexDigest.toLowerCase() &&
  params.asset.mimeType.toLowerCase() === params.declaration.mimeType.toLowerCase() &&
  params.asset.fileSizeBytes === params.declaration.fileSizeBytes;
