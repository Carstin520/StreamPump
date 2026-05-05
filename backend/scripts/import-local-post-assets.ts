import "../config/loadEnv";

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import {
  AssetProcessingSource,
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  ContentManifestStatus,
  ContentType,
  Prisma,
} from "@prisma/client";

import { prisma } from "../src/services/prisma";
import {
  computeManifestFinalizeState,
  normalizeContentType,
} from "../src/services/contentManifestService";
import {
  CompletedMultipartPart,
  extensionForMimeType,
  isVideoMimeType,
  s3Service,
} from "../src/services/S3Service";
import { uploadDisplayVariant } from "../src/services/imageVariants";

type CliOptions = {
  creatorWallet: string;
  postsRoot: string;
  onlyPostSlugs: Set<string>;
  dryRun: boolean;
  reimport: boolean;
  skipFinalize: boolean;
};

type ParsedPostDocument = {
  slug: string;
  creatorName: string | null;
  stage: string | null;
  typeLabel: string | null;
  location: string | null;
  publishTimeLabel: string | null;
  title: string;
  excerpt: string | null;
  body: string;
  tags: string[];
  theme: string | null;
  mood: string | null;
  visualDirection: string | null;
  rawMarkdown: string;
};

type AssetPlan = {
  assetType: AssetType;
  filePath: string;
  fileName: string;
  mimeType: string;
  sha256Hex: string;
  fileSizeBytes: bigint;
  orderIndex: number;
};

type ImportedPostSummary = {
  slug: string;
  manifestId: string | null;
  status: "IMPORTED" | "SKIPPED" | "DRY_RUN";
  reason?: string;
  contentType?: string;
  assetCount?: number;
  videoAssetCount?: number;
  muxQueuedCount?: number;
};

const HELP_TEXT = `
Import local post assets into StreamPump content manifests.

Usage:
  npm --prefix backend run import:local-post-assets -- --creator-wallet <wallet>
  npm --prefix backend run import:local-post-assets -- --creator-wallet <wallet> --post 2026-04-17-orange-cat-under-table-watch-mode

Options:
  --creator-wallet <wallet>   Required unless LOCAL_POST_IMPORT_CREATOR_WALLET is set.
  --post <slug>               Import only one post slug. Can be provided multiple times.
  --posts-root <path>         Override local posts root. Default: <repo>/local-post-assets/posts
  --dry-run                   Parse files and plan DB/storage actions without writing.
  --reimport                  Ignore existing imported-manifest detection for the same slug.
  --skip-finalize             Upload assets but leave manifests in UPLOADING/READY preparation state.
  --help                      Print this message.
`.trim();

const sha256Hex = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");

const stripWrappingBackticks = (value: string): string => value.trim().replace(/^`+|`+$/g, "");

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveRepoRoot = (): string => {
  const candidates = [
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ];

  for (const candidate of candidates) {
    if (
      path.basename(candidate) &&
      candidate &&
      require("fs").existsSync(path.join(candidate, "local-post-assets", "posts")) &&
      require("fs").existsSync(path.join(candidate, "backend", "package.json"))
    ) {
      return candidate;
    }
  }

  throw new Error("Could not resolve repository root for local-post-assets");
};

const parseArgs = (argv: string[]): CliOptions => {
  const repoRoot = resolveRepoRoot();
  const options: CliOptions = {
    creatorWallet:
      process.env.LOCAL_POST_IMPORT_CREATOR_WALLET?.trim() ||
      process.env.SMOKE_TEST_WALLET?.trim() ||
      "",
    postsRoot: path.join(repoRoot, "local-post-assets", "posts"),
    onlyPostSlugs: new Set<string>(),
    dryRun: false,
    reimport: false,
    skipFinalize: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    if (arg === "--creator-wallet") {
      options.creatorWallet = String(argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }

    if (arg === "--post") {
      const slug = String(argv[index + 1] ?? "").trim();
      if (!slug) {
        throw new Error("--post requires a slug value");
      }
      options.onlyPostSlugs.add(slug);
      index += 1;
      continue;
    }

    if (arg === "--posts-root") {
      const postsRoot = String(argv[index + 1] ?? "").trim();
      if (!postsRoot) {
        throw new Error("--posts-root requires a path value");
      }
      options.postsRoot = path.resolve(postsRoot);
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--reimport") {
      options.reimport = true;
      continue;
    }

    if (arg === "--skip-finalize") {
      options.skipFinalize = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.creatorWallet) {
    throw new Error(
      "creator wallet is required. Pass --creator-wallet <wallet> or set LOCAL_POST_IMPORT_CREATOR_WALLET."
    );
  }

  return options;
};

const splitSections = (markdown: string): Map<string, string> => {
  const sections = new Map<string, string>();
  const regex = /^##\s+(.+?)\n([\s\S]*?)(?=^##\s+.+$|\Z)/gm;
  let match = regex.exec(markdown);

  while (match) {
    sections.set(match[1].trim(), match[2].trim());
    match = regex.exec(markdown);
  }

  return sections;
};

const extractMetaValue = (markdown: string, label: string): string | null => {
  const regex = new RegExp(`^-\\s+${escapeRegExp(label)}:\\s*(.+)$`, "m");
  const match = markdown.match(regex);
  if (!match) {
    return null;
  }

  const normalized = stripWrappingBackticks(match[1]);
  return normalized.length > 0 ? normalized : null;
};

const parseTags = (sectionBody: string | undefined): string[] => {
  if (!sectionBody) {
    return [];
  }

  return sectionBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => stripWrappingBackticks(line.slice(2).trim()))
    .filter((tag) => tag.length > 0);
};

const parsePostMarkdown = async (postMarkdownPath: string): Promise<ParsedPostDocument> => {
  const markdown = await fs.readFile(postMarkdownPath, "utf8");
  const sections = splitSections(markdown);
  const slug =
    extractMetaValue(sections.get("Meta") ?? "", "slug") ??
    path.basename(path.dirname(postMarkdownPath));
  const title = (sections.get("Title") ?? "").trim();
  const body = (sections.get("Body") ?? "").trim();

  if (!title) {
    throw new Error(`missing Title section in ${postMarkdownPath}`);
  }

  if (!body) {
    throw new Error(`missing Body section in ${postMarkdownPath}`);
  }

  const metaSection = sections.get("Meta") ?? "";
  const themeSection = sections.get("Theme") ?? "";

  return {
    slug,
    creatorName: extractMetaValue(metaSection, "creator"),
    stage: extractMetaValue(metaSection, "stage"),
    typeLabel: extractMetaValue(metaSection, "type"),
    location: extractMetaValue(metaSection, "location"),
    publishTimeLabel: extractMetaValue(metaSection, "publish_time_label"),
    title,
    excerpt: (sections.get("Excerpt") ?? "").trim() || null,
    body,
    tags: parseTags(sections.get("Tags")),
    theme: extractMetaValue(themeSection, "theme"),
    mood: extractMetaValue(themeSection, "mood"),
    visualDirection: extractMetaValue(themeSection, "visual_direction"),
    rawMarkdown: markdown,
  };
};

const resolveMimeType = (filePath: string): string => {
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
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    default:
      throw new Error(`unsupported asset extension: ${extension} (${filePath})`);
  }
};

const listVisibleFiles = async (directoryPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => path.join(directoryPath, entry.name))
      .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

const inferContentType = (
  parsedPost: ParsedPostDocument,
  videoFiles: string[],
  imageFilesWithoutCover: string[]
): ContentType => {
  if (videoFiles.length > 0 && imageFilesWithoutCover.length > 0) {
    return ContentType.MIXED_MEDIA_NOTE;
  }

  if (videoFiles.length > 0) {
    return ContentType.SHORT_VIDEO;
  }

  if (imageFilesWithoutCover.length > 0) {
    return ContentType.IMAGE_CAROUSEL;
  }

  if (parsedPost.typeLabel) {
    return normalizeContentType(
      parsedPost.typeLabel.toUpperCase() === "VIDEO" ? "SHORT_VIDEO" : "IMAGE_CAROUSEL"
    );
  }

  throw new Error(`could not infer contentType for ${parsedPost.slug}`);
};

const buildAssetPlans = async (
  postDirectoryPath: string,
  parsedPost: ParsedPostDocument
): Promise<AssetPlan[]> => {
  const imageFiles = await listVisibleFiles(path.join(postDirectoryPath, "images"));
  const videoFiles = await listVisibleFiles(path.join(postDirectoryPath, "videos"));
  const coverFile = imageFiles.find((filePath) =>
    /^cover\./i.test(path.basename(filePath))
  );
  const imageFilesWithoutCover = imageFiles.filter((filePath) => filePath !== coverFile);

  if (!coverFile) {
    throw new Error(`missing cover image in ${path.join(postDirectoryPath, "images")}`);
  }

  if (imageFilesWithoutCover.length === 0 && videoFiles.length === 0) {
    throw new Error(`no importable assets found in ${postDirectoryPath}`);
  }

  const assetFiles: Array<{ assetType: AssetType; filePath: string }> = [
    { assetType: AssetType.COVER, filePath: coverFile },
    ...imageFilesWithoutCover.map((filePath) => ({
      assetType: AssetType.IMAGE,
      filePath,
    })),
    ...videoFiles.map((filePath) => ({
      assetType: AssetType.VIDEO,
      filePath,
    })),
  ];

  const plans: AssetPlan[] = [];
  for (let orderIndex = 0; orderIndex < assetFiles.length; orderIndex += 1) {
    const assetFile = assetFiles[orderIndex];
    const buffer = await fs.readFile(assetFile.filePath);
    plans.push({
      assetType: assetFile.assetType,
      filePath: assetFile.filePath,
      fileName: path.basename(assetFile.filePath),
      mimeType: resolveMimeType(assetFile.filePath),
      sha256Hex: sha256Hex(buffer),
      fileSizeBytes: BigInt(buffer.byteLength),
      orderIndex,
    });
  }

  return plans;
};

const uploadSinglePartObject = async (filePath: string, mimeType: string, storageKey: string) => {
  const upload = await s3Service.generateUploadUrl(storageKey, mimeType);
  const fileBuffer = await fs.readFile(filePath);
  const response = await fetch(upload.presignedUrl, {
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`single-part upload failed (${response.status} ${response.statusText})`);
  }

  return fileBuffer;
};

const uploadMultipartObject = async (
  filePath: string,
  mimeType: string,
  storageKey: string,
  fileSizeBytes: bigint
): Promise<CompletedMultipartPart[]> => {
  const multipartUpload = await s3Service.createMultipartUpload(storageKey, mimeType, fileSizeBytes);
  const fileBuffer = await fs.readFile(filePath);
  const completedParts: CompletedMultipartPart[] = [];

  for (const part of multipartUpload.parts) {
    const offset = (part.partNumber - 1) * multipartUpload.partSizeBytes;
    const chunk = fileBuffer.subarray(offset, offset + multipartUpload.partSizeBytes);
    const response = await fetch(part.presignedUrl, {
      method: "PUT",
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(
        `multipart upload failed for part ${part.partNumber} (${response.status} ${response.statusText})`
      );
    }

    const etag = response.headers.get("etag")?.trim();
    if (!etag) {
      throw new Error(
        "multipart upload response is missing ETag. Ensure the S3 bucket CORS config exposes ETag."
      );
    }

    completedParts.push({
      partNumber: part.partNumber,
      etag,
    });
  }

  await s3Service.completeMultipartUpload(storageKey, multipartUpload.uploadId, completedParts);
  return completedParts;
};

const findExistingImportedManifest = async (
  creatorWallet: string,
  slug: string
): Promise<{ id: string; status: string } | null> => {
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    select id, "status"
    from "ContentManifest"
    where "creatorWallet" = ${creatorWallet}
      and "metadataJson"->'importSource'->>'slug' = ${slug}
    order by "createdAt" desc
    limit 1
  `;

  return rows[0] ?? null;
};

const importPost = async (
  postDirectoryPath: string,
  options: CliOptions
): Promise<ImportedPostSummary> => {
  console.log(`[import-local-post-assets] planning ${path.basename(postDirectoryPath)}`);
  const postMarkdownPath = path.join(postDirectoryPath, "post.md");
  const parsedPost = await parsePostMarkdown(postMarkdownPath);
  const assetPlans = await buildAssetPlans(postDirectoryPath, parsedPost);
  console.log(
    `[import-local-post-assets] planned ${parsedPost.slug}: ${assetPlans.length} assets`
  );
  const videoAssetCount = assetPlans.filter((asset) => asset.assetType === AssetType.VIDEO).length;
  const contentType = inferContentType(
    parsedPost,
    assetPlans.filter((asset) => asset.assetType === AssetType.VIDEO).map((asset) => asset.filePath),
    assetPlans.filter((asset) => asset.assetType === AssetType.IMAGE).map((asset) => asset.filePath)
  );

  if (!options.reimport) {
    const existing = await findExistingImportedManifest(options.creatorWallet, parsedPost.slug);
    if (existing) {
      return {
        slug: parsedPost.slug,
        manifestId: existing.id,
        status: "SKIPPED",
        reason: `already imported (${existing.status})`,
      };
    }
  }

  if (options.dryRun) {
    return {
      slug: parsedPost.slug,
      manifestId: null,
      status: "DRY_RUN",
      contentType,
      assetCount: assetPlans.length,
      videoAssetCount,
      muxQueuedCount: videoAssetCount,
    };
  }

  const manifest = await prisma.contentManifest.create({
    data: {
      creatorWallet: options.creatorWallet,
      contentType,
      status: ContentManifestStatus.DRAFT,
      isPublicFeedEligible: true,
      publishedAt: new Date(),
      publicSlug: parsedPost.slug,
      creatorDisplayName: parsedPost.creatorName,
      publicExcerpt: parsedPost.excerpt,
      title: parsedPost.title,
      captionText: parsedPost.body,
      tagsJson: parsedPost.tags,
      metadataJson: {
        excerpt: parsedPost.excerpt,
        creatorName: parsedPost.creatorName,
        creatorStage: parsedPost.stage,
        location: parsedPost.location,
        publishTimeLabel: parsedPost.publishTimeLabel,
        theme: parsedPost.theme,
        mood: parsedPost.mood,
        visualDirection: parsedPost.visualDirection,
        importSource: {
          kind: "local-post-assets",
          slug: parsedPost.slug,
          postDirectoryName: path.basename(postDirectoryPath),
          postMarkdownPath: path.relative(resolveRepoRoot(), postMarkdownPath),
          importedAt: new Date().toISOString(),
        },
      } satisfies Prisma.InputJsonValue,
    },
  });

  const uploadedAssets = [];
  let coverAssetId: string | null = null;
  let muxQueuedCount = 0;

  await prisma.contentManifest.update({
    where: { id: manifest.id },
    data: {
      status: ContentManifestStatus.UPLOADING,
    },
  });

  for (const assetPlan of assetPlans) {
    const storageKey = `content/${manifest.id}/v/${manifest.version}/${assetPlan.orderIndex}-${assetPlan.sha256Hex.slice(
      0,
      12
    )}.${extensionForMimeType(assetPlan.mimeType)}`;

    console.log(
      `[import-local-post-assets] uploading ${parsedPost.slug} #${assetPlan.orderIndex} ${assetPlan.fileName}`
    );

    const asset = await prisma.contentAsset.create({
      data: {
        manifestId: manifest.id,
        assetType: assetPlan.assetType,
        orderIndex: assetPlan.orderIndex,
        sha256Hex: assetPlan.sha256Hex,
        mimeType: assetPlan.mimeType,
        fileSizeBytes: assetPlan.fileSizeBytes,
        storageKey,
        cdnUrl: null,
        uploadStatus: AssetUploadStatus.PENDING,
        processingStatus: AssetProcessingStatus.NONE,
        muxReconcileAttempts: 0,
      },
    });

    if (asset.assetType === AssetType.COVER) {
      coverAssetId = asset.id;
    }

    if (isVideoMimeType(asset.mimeType)) {
      await uploadMultipartObject(
        assetPlan.filePath,
        assetPlan.mimeType,
        storageKey,
        assetPlan.fileSizeBytes
      );
    } else {
      const fileBuffer = await uploadSinglePartObject(
        assetPlan.filePath,
        assetPlan.mimeType,
        storageKey
      );
      await uploadDisplayVariant(storageKey, fileBuffer);
    }

    let updatedAsset = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: AssetUploadStatus.UPLOADED,
        cdnUrl: s3Service.buildCanonicalUrl(storageKey),
      },
    });

    if (isVideoMimeType(asset.mimeType)) {
      updatedAsset = await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          processingStatus: AssetProcessingStatus.NONE,
          processingSource: AssetProcessingSource.CLIENT_COMPLETE,
          muxAssetId: null,
          muxPlaybackId: null,
          muxLastKnownStatus: "queued",
          muxWebhookReceivedAt: null,
          muxLastCheckedAt: null,
          muxReadyAt: null,
          muxReconcileAttempts: 0,
          processingError: null,
        },
      });

      const { ingestUploadedVideoAssetById } = await import(
        "../src/services/muxReconciliationService"
      );
      const ingestResult = await ingestUploadedVideoAssetById(asset.id);
      if (ingestResult.status !== "SKIPPED") {
        muxQueuedCount += 1;
      }
    } else {
      updatedAsset = await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          processingStatus: AssetProcessingStatus.READY,
          processingSource: AssetProcessingSource.CLIENT_COMPLETE,
          processingError: null,
        },
      });
    }

    uploadedAssets.push(updatedAsset);
    console.log(
      `[import-local-post-assets] uploaded ${parsedPost.slug} #${assetPlan.orderIndex} ${storageKey}`
    );
  }

  if (coverAssetId) {
    await prisma.contentManifest.update({
      where: { id: manifest.id },
      data: {
        coverAssetId,
      },
    });
  }

  if (!options.skipFinalize) {
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
      assets: uploadedAssets,
    });

    await prisma.contentManifest.update({
      where: { id: manifest.id },
      data: {
        status: manifest.currentAnchorPda ? ContentManifestStatus.ANCHORED : ContentManifestStatus.READY,
        isPublicFeedEligible: true,
        publishedAt: manifest.createdAt,
        publicSlug: parsedPost.slug,
        creatorDisplayName: parsedPost.creatorName,
        publicExcerpt: parsedPost.excerpt,
        captionTextHash: finalized.captionTextHash,
        canonicalManifestJson: finalized.canonicalManifestJson as Prisma.InputJsonValue,
        manifestHashHex: finalized.manifestHashHex,
        internalCanonicalUrl: finalized.internalCanonicalUrl,
        internalUrlDigestHex: finalized.internalUrlDigestHex,
        coverAssetId,
      },
    });
  }

  return {
    slug: parsedPost.slug,
    manifestId: manifest.id,
    status: "IMPORTED",
    contentType,
    assetCount: assetPlans.length,
    videoAssetCount,
    muxQueuedCount,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        postsRoot: options.postsRoot,
        reimport: options.reimport,
        skipFinalize: options.skipFinalize,
      },
      null,
      2
    )
  );
  const entries = await fs.readdir(options.postsRoot, { withFileTypes: true });
  const postDirectories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .map((entry) => path.join(options.postsRoot, entry.name))
    .filter((directoryPath) => {
      if (options.onlyPostSlugs.size === 0) {
        return true;
      }
      return options.onlyPostSlugs.has(path.basename(directoryPath));
    })
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

  if (postDirectories.length === 0) {
    throw new Error(`no posts matched under ${options.postsRoot}`);
  }
  console.log(`[import-local-post-assets] matched ${postDirectories.length} post directories`);

  const results: ImportedPostSummary[] = [];

  for (const postDirectoryPath of postDirectories) {
    const summary = await importPost(postDirectoryPath, options);
    results.push(summary);
    console.log(
      `[import-local-post-assets] ${summary.slug}: ${summary.status}${
        summary.reason ? ` (${summary.reason})` : ""
      }`
    );
  }

  const importedCount = results.filter((result) => result.status === "IMPORTED").length;
  const skippedCount = results.filter((result) => result.status === "SKIPPED").length;
  const dryRunCount = results.filter((result) => result.status === "DRY_RUN").length;

  console.log(
    JSON.stringify(
      {
        creatorWallet: options.creatorWallet,
        postsRoot: options.postsRoot,
        importedCount,
        skippedCount,
        dryRunCount,
        results,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
