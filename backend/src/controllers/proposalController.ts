import {
  OracleSyncStatus,
  Prisma,
  Proposal,
  ProposalStatus,
  Track2MetricType,
  UploadStatus,
} from "@prisma/client";
import { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";

import { getAnchorService } from "../services/AnchorService";
import { prisma } from "../services/prisma";
import { s3Service } from "../services/S3Service";

const parseWallet = (value: unknown, fieldName: string): string => {
  const wallet = String(value ?? "").trim();
  if (!wallet) {
    throw new Error(`${fieldName} is required`);
  }

  try {
    return new PublicKey(wallet).toBase58();
  } catch (_error) {
    throw new Error(`${fieldName} is not a valid Solana public key`);
  }
};

const parseOptionalWallet = (value: unknown): string | null => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return parseWallet(value, "sponsorWallet");
};

const parseNonNegativeBigInt = (value: unknown, fieldName: string): bigint => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }

  let parsed: bigint;
  try {
    parsed = BigInt(String(value));
  } catch (_error) {
    throw new Error(`${fieldName} must be an integer`);
  }

  if (parsed < 0n) {
    throw new Error(`${fieldName} must be non-negative`);
  }

  return parsed;
};

const parseOptionalNonNegativeBigInt = (value: unknown, fieldName: string): bigint | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseNonNegativeBigInt(value, fieldName);
};

const parseNonNegativeInt = (value: unknown, fieldName: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

const parseOptionalId = (value: unknown): string | null => {
  const parsed = String(value ?? "").trim();
  return parsed.length > 0 ? parsed : null;
};

const parseDeadlineUnix = (deadlineTs: unknown, deadlineAt: unknown): bigint => {
  if (deadlineTs !== undefined && deadlineTs !== null && String(deadlineTs).trim() !== "") {
    const parsed = parseNonNegativeBigInt(deadlineTs, "deadlineTs");
    return parsed;
  }

  if (deadlineAt === undefined || deadlineAt === null || String(deadlineAt).trim() === "") {
    throw new Error("deadlineTs or deadlineAt is required");
  }

  const parsedDate = new Date(String(deadlineAt));
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("deadlineAt is not a valid datetime");
  }

  return BigInt(Math.floor(parsedDate.getTime() / 1000));
};

const parseTrack2MetricType = (value: unknown): Track2MetricType => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (normalized === "VIEWS" || normalized === "VIEW") {
    return Track2MetricType.VIEWS;
  }

  if (normalized === "CLICKS" || normalized === "CLICK") {
    return Track2MetricType.CLICKS;
  }

  if (normalized === "SAVES" || normalized === "SAVE") {
    return Track2MetricType.SAVES;
  }

  throw new Error("track2MetricType must be one of: VIEWS, CLICKS, SAVES");
};

const toDateFromUnixSeconds = (unixSeconds: bigint): Date => {
  const asNumber = Number(unixSeconds);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    throw new Error("deadlineTs must be a valid positive unix timestamp (seconds)");
  }

  return new Date(asNumber * 1000);
};

const toSafeJsonMetadata = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object") {
    return value as Prisma.InputJsonValue;
  }

  return undefined;
};

const serializeProposal = (proposal: Proposal) => ({
  id: proposal.id,
  proposalPda: proposal.proposalPda,
  creatorWallet: proposal.creatorWallet,
  sponsorWallet: proposal.sponsorWallet,
  deadlineAt: proposal.deadlineAt.toISOString(),
  status: proposal.status,
  track1BaseUsdc: proposal.track1BaseUsdc.toString(),
  track1Claimed: proposal.track1Claimed,
  track2MetricType: proposal.track2MetricType,
  track2TargetValue: proposal.track2TargetValue.toString(),
  track2MinAchievementBps: proposal.track2MinAchievementBps,
  track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
  track2ActualValue: proposal.track2ActualValue?.toString() ?? null,
  track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
  track3UsdcDeposited: proposal.track3UsdcDeposited.toString(),
  track3CpsPayout: proposal.track3CpsPayout?.toString() ?? null,
  track3DelayDays: proposal.track3DelayDays,
  track3SettledAt: proposal.track3SettledAt?.toISOString() ?? null,
  onChainTxSignature: proposal.onChainTxSignature,
  oracleSyncStatus: proposal.oracleSyncStatus,
  createdAt: proposal.createdAt.toISOString(),
  updatedAt: proposal.updatedAt.toISOString(),
});

const serializePublicFanView = (proposal: Proposal) => ({
  id: proposal.id,
  proposalPda: proposal.proposalPda,
  creatorWallet: proposal.creatorWallet,
  deadlineAt: proposal.deadlineAt.toISOString(),
  status: proposal.status,
  track2MetricType: proposal.track2MetricType,
  track2TargetValue: proposal.track2TargetValue.toString(),
  track2MinAchievementBps: proposal.track2MinAchievementBps,
  track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
  track2ActualValue: proposal.track2ActualValue?.toString() ?? null,
  track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
});

export const createProposalDraft = async (req: Request, res: Response) => {
  try {
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const sponsorWallet = parseOptionalWallet(req.body.sponsorWallet);
    const track2MetricType = parseTrack2MetricType(req.body.track2MetricType);
    const deadlineUnix = parseDeadlineUnix(req.body.deadlineTs, req.body.deadlineAt);
    const deadlineAt = toDateFromUnixSeconds(deadlineUnix);
    const anchorService = getAnchorService();
    const videoId = parseOptionalId(req.body.videoId);

    const track2MinAchievementBps = parseNonNegativeInt(
      req.body.track2MinAchievementBps,
      "track2MinAchievementBps"
    );

    if (track2MinAchievementBps > 10_000) {
      res.status(400).json({ error: "track2MinAchievementBps must be <= 10000" });
      return;
    }

    const creatorKey = new PublicKey(creatorWallet);
    const proposalPda = anchorService.deriveProposalPda(creatorKey, deadlineUnix);
    const creatorProfilePda = anchorService.deriveCreatorProfilePda(creatorKey);
    const proposalUsdcVaultPda = anchorService.deriveProposalUsdcVaultPda(proposalPda);
    const protocolConfigPda = anchorService.deriveProtocolConfigPda();

    let linkedVideoId: string | null = null;
    let anchorTxSignature: string | null = null;

    if (videoId) {
      const video = await prisma.videoContent.findUnique({
        where: { id: videoId },
      });

      if (!video) {
        res.status(404).json({ error: "videoId not found" });
        return;
      }

      if (video.creatorWallet !== creatorWallet) {
        res.status(403).json({ error: "videoId does not belong to creatorWallet" });
        return;
      }

      if (video.proposalId) {
        res.status(409).json({ error: "video is already linked to a proposal" });
        return;
      }

      if (video.uploadStatus !== UploadStatus.UPLOADED) {
        res.status(409).json({ error: "video uploadStatus must be UPLOADED" });
        return;
      }

      const canonicalUrl = video.videoUrl ?? s3Service.buildCanonicalUrl(video.s3ObjectKey);

      if (!video.onChainAnchorTx) {
        const tx = await anchorService.executeAnchorContentHash(
          creatorKey,
          canonicalUrl,
          video.contentHash
        );

        await prisma.videoContent.update({
          where: { id: video.id },
          data: {
            videoUrl: canonicalUrl,
            onChainAnchorTx: tx,
          },
        });

        anchorTxSignature = tx;
      } else if (!video.videoUrl) {
        await prisma.videoContent.update({
          where: { id: video.id },
          data: {
            videoUrl: canonicalUrl,
          },
        });
      }

      linkedVideoId = video.id;
    }

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          proposalPda: proposalPda.toBase58(),
          creatorWallet,
          sponsorWallet,
          deadlineAt,
          status: ProposalStatus.OPEN,
          track1BaseUsdc: parseNonNegativeBigInt(req.body.track1BaseUsdc, "track1BaseUsdc"),
          track1Claimed: false,
          track2MetricType,
          track2TargetValue: parseNonNegativeBigInt(
            req.body.track2TargetValue,
            "track2TargetValue"
          ),
          track2MinAchievementBps,
          track2UsdcDeposited: parseNonNegativeBigInt(
            req.body.track2UsdcDeposited,
            "track2UsdcDeposited"
          ),
          track2ActualValue: parseOptionalNonNegativeBigInt(
            req.body.track2ActualValue,
            "track2ActualValue"
          ),
          track2SettledAt: null,
          track3UsdcDeposited: parseNonNegativeBigInt(
            req.body.track3UsdcDeposited,
            "track3UsdcDeposited"
          ),
          track3CpsPayout: parseOptionalNonNegativeBigInt(
            req.body.track3CpsPayout,
            "track3CpsPayout"
          ),
          track3DelayDays: parseNonNegativeInt(req.body.track3DelayDays, "track3DelayDays"),
          track3SettledAt: null,
          onChainTxSignature: null,
          oracleSyncStatus: OracleSyncStatus.PENDING,
          metadata: toSafeJsonMetadata(req.body.metadata),
        },
      });

      if (linkedVideoId) {
        const linkResult = await tx.videoContent.updateMany({
          where: {
            id: linkedVideoId,
            proposalId: null,
          },
          data: {
            proposalId: created.id,
          },
        });

        if (linkResult.count !== 1) {
          throw new Error("video link race detected; video already linked");
        }
      }

      return created;
    });

    res.status(201).json({
      proposal: serializeProposal(proposal),
      linkedVideoId,
      videoAnchorTx: anchorTxSignature,
      pdaDerivations: {
        programId: anchorService.getProgramId().toBase58(),
        protocolConfigPda: protocolConfigPda.toBase58(),
        creatorProfilePda: creatorProfilePda.toBase58(),
        proposalPda: proposalPda.toBase58(),
        proposalUsdcVaultPda: proposalUsdcVaultPda.toBase58(),
        deadlineUnix: deadlineUnix.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("video link race detected")) {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(400).json({
      error: error instanceof Error ? error.message : "failed to create proposal draft",
    });
  }
};

export const getProposalById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }

    const proposal = await prisma.proposal.findFirst({
      where: {
        OR: [{ id }, { proposalPda: id }],
      },
    });

    if (!proposal) {
      res.status(404).json({ error: "proposal not found" });
      return;
    }

    const requesterWallet = String(
      req.header("x-wallet-address") ?? req.query.wallet ?? ""
    ).trim();

    const isCreatorOrSponsor =
      requesterWallet.length > 0 &&
      (requesterWallet === proposal.creatorWallet || requesterWallet === proposal.sponsorWallet);

    if (isCreatorOrSponsor) {
      res.json({
        viewerRole: "CREATOR_OR_SPONSOR",
        proposal: serializeProposal(proposal),
      });
      return;
    }

    res.json({
      viewerRole: "PUBLIC_FAN",
      proposal: serializePublicFanView(proposal),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "failed to fetch proposal",
    });
  }
};
