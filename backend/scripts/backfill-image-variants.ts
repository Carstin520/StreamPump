import "dotenv/config";

import "../config/loadEnv";

import { AssetType, AssetUploadStatus } from "@prisma/client";

import { prisma } from "../src/services/prisma";
import { backfillDisplayVariantFromStorage } from "../src/services/imageVariants";

type CliOptions = {
  manifestId: string | null;
};

const parseArgs = (argv: string[]): CliOptions => {
  const manifestIndex = argv.findIndex((arg) => arg === "--manifest");

  return {
    manifestId:
      manifestIndex === -1 ? null : argv[manifestIndex + 1]?.trim() || null,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const assets = await prisma.contentAsset.findMany({
    where: {
      assetType: {
        in: [AssetType.COVER, AssetType.IMAGE],
      },
      uploadStatus: AssetUploadStatus.UPLOADED,
      ...(options.manifestId
        ? {
            manifestId: options.manifestId,
          }
        : {}),
    },
    orderBy: [
      { manifestId: "asc" },
      { orderIndex: "asc" },
    ],
    select: {
      id: true,
      manifestId: true,
      orderIndex: true,
      storageKey: true,
    },
  });

  const results: Array<{ assetId: string; manifestId: string; variantKey: string }> = [];
  let failed = 0;
  let skipped = 0;

  for (const asset of assets) {
    let variantKey: string | null = null;
    try {
      variantKey = await backfillDisplayVariantFromStorage(asset.storageKey);
    } catch (error) {
      failed += 1;
      console.log(
        `[backfill-image-variants] manifest=${asset.manifestId} asset=${asset.id} skipped=source-unavailable reason=${
          error instanceof Error ? error.message : "unknown-error"
        }`,
      );
      continue;
    }

    if (!variantKey) {
      skipped += 1;
      console.log(
        `[backfill-image-variants] manifest=${asset.manifestId} asset=${asset.id} skipped=unsupported-source-format`,
      );
      continue;
    }
    results.push({
      assetId: asset.id,
      manifestId: asset.manifestId,
      variantKey,
    });
    console.log(
      `[backfill-image-variants] manifest=${asset.manifestId} asset=${asset.id} variant=${variantKey}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        processed: results.length,
        manifestId: options.manifestId,
        failed,
        skipped,
      },
      null,
      2,
    ),
  );
};

void main()
  .catch((error) => {
    console.error("[backfill-image-variants]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
