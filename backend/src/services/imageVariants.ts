import sharp from "sharp";

import { s3Service } from "./S3Service";

const DISPLAY_MAX_WIDTH = 1280;
const DISPLAY_MAX_HEIGHT = 1280;
const DISPLAY_QUALITY = 76;
const DISPLAY_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const isImageAssetMimeType = (mimeType: string) =>
  mimeType.startsWith("image/");

export const buildDisplayVariantKey = (storageKey: string) => {
  const extensionIndex = storageKey.lastIndexOf(".");
  if (extensionIndex === -1) {
    return `${storageKey}.display.webp`;
  }

  return `${storageKey.slice(0, extensionIndex)}.display.webp`;
};

export const generateDisplayVariant = async (input: Buffer | Uint8Array) => {
  return sharp(input)
    .rotate()
    .resize(DISPLAY_MAX_WIDTH, DISPLAY_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: DISPLAY_QUALITY,
    })
    .toBuffer();
};

const isUnsupportedImageError = (error: unknown) =>
  error instanceof Error &&
  error.message.toLowerCase().includes("unsupported image format");

export const uploadDisplayVariant = async (
  originalStorageKey: string,
  input: Buffer | Uint8Array,
) => {
  let variantBuffer: Buffer;
  try {
    variantBuffer = await generateDisplayVariant(input);
  } catch (error) {
    if (isUnsupportedImageError(error)) {
      return null;
    }

    throw error;
  }
  const variantKey = buildDisplayVariantKey(originalStorageKey);

  await s3Service.putObject(variantKey, new Uint8Array(variantBuffer), "image/webp", {
    cacheControl: DISPLAY_CACHE_CONTROL,
  });

  return variantKey;
};

export const backfillDisplayVariantFromStorage = async (storageKey: string) => {
  const downloadUrl = await s3Service.generateDownloadUrl(storageKey, 15 * 60);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(
      `failed to download source image for variant generation (${response.status} ${response.statusText})`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadDisplayVariant(storageKey, buffer);
};
