/**
 * CN: 使用本地 mp4 文件执行内容上传与 Mux 转码回写的端到端冒烟测试。
 * EN: End-to-end smoke test for local mp4 upload plus Mux transcoding and webhook write-back.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const prisma = new PrismaClient();

const API_BASE = process.env.SMOKE_TEST_API_BASE_URL || "http://127.0.0.1:4000/api/v1";
const WALLET =
  process.env.SMOKE_TEST_WALLET || "11111111111111111111111111111111";
const VIDEO_PATH =
  process.argv[2] || path.resolve(__dirname, "../../test_files/test_mux.mp4");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    error.payload = payload;
    throw error;
  }

  return payload;
};

const main = async () => {
  if (!fs.existsSync(VIDEO_PATH)) {
    throw new Error(`missing test video: ${VIDEO_PATH}`);
  }

  const videoBuffer = fs.readFileSync(VIDEO_PATH);
  const sha256Hex = crypto.createHash("sha256").update(videoBuffer).digest("hex");
  const id = Date.now().toString();
  const jsonHeaders = {
    "content-type": "application/json",
    "x-wallet-address": WALLET,
  };

  const manifestResponse = await callJson(`${API_BASE}/content/manifests`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      "x-idempotency-key": `mux-smoke-create-${id}`,
    },
    body: JSON.stringify({
      contentType: "SHORT_VIDEO",
      title: `Mux Smoke ${id}`,
      captionText: "Mux smoke test for S3 upload and webhook completion",
      tags: ["smoke", "mux"],
    }),
  });

  const manifestId = manifestResponse.data.manifestId;

  const presignResponse = await callJson(
    `${API_BASE}/content/manifests/${manifestId}/assets/presign`,
    {
      method: "POST",
      headers: {
        ...jsonHeaders,
        "x-idempotency-key": `mux-smoke-presign-${id}`,
      },
      body: JSON.stringify({
        assets: [
          {
            assetType: "VIDEO",
            orderIndex: 0,
            sha256Hex,
            mimeType: "video/mp4",
            fileSizeBytes: String(videoBuffer.length),
          },
        ],
      }),
    }
  );

  const upload = presignResponse.data.uploads[0];

  const putResponse = await fetch(upload.presignedUrl, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
    },
    body: videoBuffer,
  });

  if (!putResponse.ok) {
    throw new Error(`S3 upload failed with ${putResponse.status}`);
  }

  const completeResponse = await callJson(
    `${API_BASE}/content/manifests/${manifestId}/assets/${upload.assetId}/complete`,
    {
      method: "POST",
      headers: {
        ...jsonHeaders,
        "x-idempotency-key": `mux-smoke-complete-${id}`,
      },
    }
  );

  let polledAsset = completeResponse.data.asset;
  for (let attempt = 1; attempt <= 48; attempt += 1) {
    const dbAsset = await prisma.contentAsset.findUnique({
      where: { id: upload.assetId },
      select: {
        id: true,
        uploadStatus: true,
        processingStatus: true,
        muxAssetId: true,
        muxPlaybackId: true,
        processingError: true,
        updatedAt: true,
      },
    });

    polledAsset = dbAsset;
    if (!dbAsset) {
      throw new Error("content asset disappeared during polling");
    }

    // READY means Mux webhook completed; ERRORED means the pipeline failed and we should report it.
    if (dbAsset.processingStatus === "READY" || dbAsset.processingStatus === "ERRORED") {
      break;
    }

    await sleep(5000);
  }

  let finalizeResult = null;

  try {
    finalizeResult = await callJson(`${API_BASE}/content/manifests/${manifestId}/finalize`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        "x-idempotency-key": `mux-smoke-finalize-${id}`,
      },
    });
  } catch (error) {
    finalizeResult = {
      error: error.message,
      payload: error.payload || null,
    };
  }

  const manifest = await prisma.contentManifest.findUnique({
    where: { id: manifestId },
    select: {
      id: true,
      status: true,
      manifestHashHex: true,
      currentAnchorPda: true,
      updatedAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        manifestId,
        assetId: upload.assetId,
        storageKey: upload.storageKey,
        initialCompleteAsset: completeResponse.data.asset,
        polledAsset,
        finalize:
          finalizeResult && finalizeResult.data
            ? {
                status: finalizeResult.data.status,
                manifestHashHex: finalizeResult.data.manifestHashHex,
                plannedContentAnchorPda: finalizeResult.data.plannedContentAnchorPda,
              }
            : finalizeResult,
        manifest,
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
          error: error.message,
          payload: error.payload || null,
          stack: error.stack,
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
