import { MuxStatus, Prisma, UploadStatus } from "@prisma/client";
import { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";

import { getAnchorService } from "../services/AnchorService";
import { muxService } from "../services/MuxService";
import { prisma } from "../services/prisma";
import { s3Service } from "../services/S3Service";

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const SHA256_HEX_REGEX = /^[A-Fa-f0-9]{64}$/;

const parseCreatorWallet = (req: Request): string => {
  const wallet = String(req.header("x-wallet-address") ?? req.body.creatorWallet ?? "").trim();
  if (!wallet) {
    throw new Error("creator wallet is required via x-wallet-address header or creatorWallet body field");
  }

  try {
    return new PublicKey(wallet).toBase58();
  } catch (_error) {
    throw new Error("creator wallet is not a valid Solana public key");
  }
};

const parseContentHash = (value: unknown): string => {
  const hash = String(value ?? "").trim().toLowerCase();
  if (!SHA256_HEX_REGEX.test(hash)) {
    throw new Error("contentHash must be a 64-character SHA-256 hex string");
  }

  return hash;
};

const parseFileSizeBytes = (value: unknown): bigint => {
  let parsed: bigint;
  try {
    parsed = BigInt(String(value ?? ""));
  } catch (_error) {
    throw new Error("fileSizeBytes must be an integer");
  }

  if (parsed <= 0n) {
    throw new Error("fileSizeBytes must be greater than 0");
  }

  if (parsed > BigInt(MAX_VIDEO_SIZE_BYTES)) {
    throw new Error(`fileSizeBytes exceeds MVP limit (${MAX_VIDEO_SIZE_BYTES} bytes)`);
  }

  return parsed;
};

const normalizeMimeType = (value: unknown): string => String(value ?? "").trim().toLowerCase();

const extensionForMimeType = (mimeType: string): string => {
  if (mimeType === "video/quicktime") {
    return "mov";
  }

  return "mp4";
};

const isUniqueConstraintError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as { code?: unknown }).code === "P2002";
};

export const requestUpload = async (req: Request, res: Response) => {
  try {
    const creatorWallet = parseCreatorWallet(req);
    const contentHash = parseContentHash(req.body.contentHash);
    const fileSizeBytes = parseFileSizeBytes(req.body.fileSizeBytes);
    const mimeType = normalizeMimeType(req.body.mimeType);
    const extension = extensionForMimeType(mimeType);
    const s3ObjectKey = `raw/${creatorWallet}/${contentHash}.${extension}`;

    const existing = await prisma.videoContent.findUnique({
      where: { contentHash },
    });

    if (existing && existing.creatorWallet !== creatorWallet) {
      res.status(409).json({
        error: "contentHash already exists for another creator",
      });
      return;
    }

    const video = existing
      ? await prisma.videoContent.update({
          where: { id: existing.id },
          data: {
            fileSizeBytes,
            mimeType,
            s3ObjectKey,
          },
        })
      : await prisma.videoContent.create({
          data: {
            creatorWallet,
            s3ObjectKey,
            contentHash,
            mimeType,
            fileSizeBytes,
            uploadStatus: UploadStatus.PENDING,
          },
        });

    const upload = await s3Service.generateUploadUrl(s3ObjectKey, mimeType);

    res.status(201).json({
      videoId: video.id,
      s3ObjectKey,
      contentHash,
      mimeType,
      fileSizeBytes: fileSizeBytes.toString(),
      uploadStatus: video.uploadStatus,
      presignedUrl: upload.presignedUrl,
      expiresInSeconds: upload.expiresInSeconds,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: "duplicate contentHash or s3ObjectKey" });
      return;
    }

    res.status(400).json({
      error: error instanceof Error ? error.message : "failed to request upload",
    });
  }
};

export const confirmUpload = async (req: Request, res: Response) => {
  try {
    const videoId = String(req.body.videoId ?? "").trim();
    if (!videoId) {
      res.status(400).json({ error: "videoId is required" });
      return;
    }

    const existing = await prisma.videoContent.findUnique({
      where: { id: videoId },
    });

    if (!existing) {
      res.status(404).json({ error: "video not found" });
      return;
    }

    const canonicalUrl = existing.videoUrl ?? s3Service.buildCanonicalUrl(existing.s3ObjectKey);

    let updated = await prisma.videoContent.update({
      where: { id: videoId },
      data: {
        uploadStatus: UploadStatus.UPLOADED,
        videoUrl: canonicalUrl,
      },
    });

    let anchored = Boolean(updated.onChainAnchorTx);
    let anchorError: string | null = null;

    if (!anchored) {
      const creator = new PublicKey(updated.creatorWallet);
      try {
        const txSignature = await getAnchorService().executeAnchorContentHash(
          creator,
          canonicalUrl,
          updated.contentHash
        );

        updated = await prisma.videoContent.update({
          where: { id: videoId },
          data: {
            onChainAnchorTx: txSignature,
          },
        });
        anchored = true;
      } catch (error) {
        anchorError =
          error instanceof Error ? error.message : "failed to anchor content hash";
        updated = await prisma.videoContent.update({
          where: { id: videoId },
          data: {
            onChainAnchorTx: null,
          },
        });
      }
    }

    let muxError: string | null = null;

    if (!updated.muxAssetId) {
      const lockResult = await prisma.videoContent.updateMany({
        where: {
          id: videoId,
          muxAssetId: null,
          OR: [{ muxStatus: MuxStatus.NONE }, { muxStatus: MuxStatus.ERRORED }],
        },
        data: {
          muxStatus: MuxStatus.PREPARING,
          muxErrorMessage: null,
        },
      });

      if (lockResult.count === 1) {
        try {
          const presignedGetUrl = await s3Service.generateDownloadUrl(updated.s3ObjectKey, 3600);
          const muxAssetId = await muxService.createAsset(presignedGetUrl);

          updated = await prisma.videoContent.update({
            where: { id: videoId },
            data: {
              muxAssetId,
              muxStatus: MuxStatus.PREPARING,
              muxErrorMessage: null,
            },
          });
        } catch (error) {
          muxError = error instanceof Error ? error.message : "failed to create mux asset";
          updated = await prisma.videoContent.update({
            where: { id: videoId },
            data: {
              muxStatus: MuxStatus.ERRORED,
              muxErrorMessage: muxError,
            },
          });
        }
      } else {
        const latest = await prisma.videoContent.findUnique({
          where: { id: videoId },
        });

        if (latest) {
          updated = latest;
        }
      }
    }

    const statusCode = anchorError || muxError ? 202 : 200;

    res.status(statusCode).json({
      videoId: updated.id,
      uploadStatus: updated.uploadStatus,
      videoUrl: updated.videoUrl,
      onChainAnchorTx: updated.onChainAnchorTx,
      anchored,
      anchorError,
      muxAssetId: updated.muxAssetId,
      muxPlaybackId: updated.muxPlaybackId,
      muxStatus: updated.muxStatus,
      muxErrorMessage: updated.muxErrorMessage,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "video not found" });
      return;
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "failed to confirm upload",
    });
  }
};
