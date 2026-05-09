import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import {
  AssetProcessingSource,
  AssetProcessingStatus,
  AssetUploadStatus,
  ContentManifestStatus,
  Prisma,
} from "@prisma/client";

import "../config/loadEnv";
import { prisma } from "../src/services/prisma";
import {
  extensionForMimeType,
  r2Service,
} from "../src/services/R2Service";
import { uploadDisplayVariant } from "../src/services/imageVariants";
import { computeManifestFinalizeState } from "../src/services/contentManifestService";

type CliOptions = {
  slug: string;
};

const parseArgs = (argv: string[]): CliOptions => {
  const slugIndex = argv.findIndex((arg) => arg === "--post");
  if (slugIndex === -1 || !argv[slugIndex + 1]?.trim()) {
    throw new Error("usage: npm --prefix backend run update:local-post-cover -- --post <slug>");
  }

  return {
    slug: argv[slugIndex + 1].trim(),
  };
};

const resolvePostsRoot = () => {
  const candidates = [
    path.resolve(process.cwd(), "local-post-assets/posts"),
    path.resolve(process.cwd(), "../local-post-assets/posts"),
    path.resolve(__dirname, "../../local-post-assets/posts"),
    path.resolve(__dirname, "../../../local-post-assets/posts"),
  ];

  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new Error("could not locate local-post-assets/posts");
  }

  return resolved;
};

const findCoverPath = async (slug: string) => {
  const postDirectoryPath = path.join(resolvePostsRoot(), slug);
  const imagesDirectoryPath = path.join(postDirectoryPath, "images");
  const entries = await fs.readdir(imagesDirectoryPath, { withFileTypes: true });
  const coverEntry = entries.find(
    (entry) => entry.isFile() && /^cover\./i.test(entry.name),
  );

  if (!coverEntry) {
    throw new Error(`missing cover image in ${imagesDirectoryPath}`);
  }

  return path.join(imagesDirectoryPath, coverEntry.name);
};

const resolveMimeType = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    default:
      throw new Error(`unsupported cover extension: ${extension}`);
  }
};

const sha256Hex = async (filePath: string) => {
  const crypto = await import("node:crypto");
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const uploadSinglePartObject = async (
  fileBuffer: Buffer,
  mimeType: string,
  storageKey: string,
) => {
  const upload = await r2Service.generateUploadUrl(storageKey, mimeType);
  const response = await fetch(upload.presignedUrl, {
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    throw new Error(`cover upload failed (${response.status} ${response.statusText})`);
  }

  return fileBuffer;
};

const findLatestImportedManifest = async (slug: string) => {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    select id
    from "ContentManifest"
    where "metadataJson"->'importSource'->>'kind' = 'local-post-assets'
      and "metadataJson"->'importSource'->>'slug' = ${slug}
    order by "createdAt" desc
    limit 1
  `;

  if (!rows[0]?.id) {
    throw new Error(`no imported manifest found for slug ${slug}`);
  }

  const manifest = await prisma.contentManifest.findUnique({
    where: { id: rows[0].id },
    include: {
      assets: {
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });

  if (!manifest) {
    throw new Error(`manifest ${rows[0].id} disappeared while loading`);
  }

  return manifest;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const coverPath = await findCoverPath(options.slug);
  const manifest = await findLatestImportedManifest(options.slug);

  if (
    manifest.status === ContentManifestStatus.ANCHORED ||
    manifest.status === ContentManifestStatus.PUBLISHED
  ) {
    throw new Error(
      `manifest ${manifest.id} is ${manifest.status}; refuse to mutate anchored or published content in place`,
    );
  }

  const coverAsset =
    manifest.assets.find((asset) => asset.id === manifest.coverAssetId) ??
    manifest.assets.find((asset) => asset.assetType === "COVER");

  if (!coverAsset) {
    throw new Error(`manifest ${manifest.id} does not have a cover asset`);
  }

  const mimeType = resolveMimeType(coverPath);
  const sha256 = await sha256Hex(coverPath);
  const fileBuffer = await fs.readFile(coverPath);
  const storageKey = `content/${manifest.id}/v/${manifest.version}/${coverAsset.orderIndex}-${sha256.slice(
    0,
    12,
  )}.${extensionForMimeType(mimeType)}`;

  await uploadSinglePartObject(fileBuffer, mimeType, storageKey);
  await uploadDisplayVariant(storageKey, fileBuffer);

  const updatedAsset = await prisma.contentAsset.update({
    where: { id: coverAsset.id },
    data: {
      sha256Hex: sha256,
      mimeType,
      fileSizeBytes: BigInt(fileBuffer.byteLength),
      storageKey,
      cdnUrl: r2Service.buildCanonicalUrl(storageKey),
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.READY,
      processingSource: AssetProcessingSource.CLIENT_COMPLETE,
      processingError: null,
    },
  });

  const finalized = computeManifestFinalizeState({
    manifest: {
      id: manifest.id,
      creatorWallet: manifest.creatorWallet,
      contentType: manifest.contentType,
      version: manifest.version,
      title: manifest.title,
      captionText: manifest.captionText,
      tagsJson: manifest.tagsJson,
    },
    assets: manifest.assets.map((asset) =>
      asset.id === updatedAsset.id ? updatedAsset : asset,
    ),
  });

  await prisma.contentManifest.update({
    where: { id: manifest.id },
    data: {
      status:
        manifest.currentAnchorPda && manifest.status !== ContentManifestStatus.READY
          ? manifest.status
          : ContentManifestStatus.READY,
      captionTextHash: finalized.captionTextHash,
      canonicalManifestJson:
        finalized.canonicalManifestJson as Prisma.InputJsonValue,
      manifestHashHex: finalized.manifestHashHex,
      internalCanonicalUrl: finalized.internalCanonicalUrl,
      internalUrlDigestHex: finalized.internalUrlDigestHex,
      coverAssetId: updatedAsset.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        slug: options.slug,
        manifestId: manifest.id,
        coverAssetId: updatedAsset.id,
        storageKey,
      },
      null,
      2,
    ),
  );
};

void main()
  .catch((error) => {
    console.error("[update-local-post-cover]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
