/**
 * CN: Workspace 聚合控制器，为前端工作台提供 manifests、intents、proposals 的统一只读视图。
 * EN: Workspace aggregate controller that provides a unified read-only view of manifests, intents, and proposals for the frontend workspace.
 */
import { ProposalIntentStatus } from "@prisma/client";
import { Request, Response } from "express";

import { handleControllerError, HttpError, ok } from "./http";
import { prisma } from "../services/prisma";

const requireAuthenticatedWallet = (req: Request): string => {
  if (!req.auth?.wallet || req.auth.source !== "session") {
    throw new HttpError(401, "AUTH_REQUIRED", "bearer session authentication is required");
  }

  return req.auth.wallet;
};

const needsCreatorAction = (status: ProposalIntentStatus): boolean =>
  status === ProposalIntentStatus.DRAFT ||
  status === ProposalIntentStatus.TERMS_LOCKED ||
  status === ProposalIntentStatus.BUNDLE_BUILT ||
  status === ProposalIntentStatus.FAILED ||
  status === ProposalIntentStatus.EXPIRED;

const needsSponsorAction = (status: ProposalIntentStatus): boolean =>
  status === ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED ||
  status === ProposalIntentStatus.FAILED ||
  status === ProposalIntentStatus.EXPIRED;

export const getWorkspaceOverview = async (req: Request, res: Response) => {
  try {
    const wallet = requireAuthenticatedWallet(req);

    const [manifests, intents, proposals] = await Promise.all([
      prisma.contentManifest.findMany({
        where: { creatorWallet: wallet },
        include: {
          assets: {
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.proposalIntent.findMany({
        where: {
          OR: [{ creatorWallet: wallet }, { sponsorWallet: wallet }],
        },
        include: {
          manifest: {
            select: {
              id: true,
              title: true,
              status: true,
              contentType: true,
            },
          },
          txBundles: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.proposal.findMany({
        where: {
          OR: [{ creatorWallet: wallet }, { sponsorWallet: wallet }],
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    ok(res, {
      wallet,
      manifests: manifests.map((manifest) => ({
        manifestId: manifest.id,
        title: manifest.title,
        status: manifest.status,
        contentType: manifest.contentType,
        version: manifest.version,
        assetCount: manifest.assets.length,
        updatedAt: manifest.updatedAt.toISOString(),
      })),
      intents: intents.map((intent) => {
        const viewerRole = wallet === intent.creatorWallet ? "CREATOR" : "SPONSOR";
        const needsAction =
          viewerRole === "CREATOR"
            ? needsCreatorAction(intent.status)
            : needsSponsorAction(intent.status);

        return {
          intentId: intent.id,
          status: intent.status,
          viewerRole,
          needsAction,
          creatorWallet: intent.creatorWallet,
          sponsorWallet: intent.sponsorWallet,
          manifest: intent.manifest
            ? {
                manifestId: intent.manifest.id,
                title: intent.manifest.title,
                status: intent.manifest.status,
                contentType: intent.manifest.contentType,
              }
            : null,
          latestBundle: intent.txBundles[0]
            ? {
                bundleId: intent.txBundles[0].id,
                status: intent.txBundles[0].status,
                expiresAt: intent.txBundles[0].expiresAt.toISOString(),
                chainTxSignature: intent.txBundles[0].chainTxSignature,
              }
            : null,
          updatedAt: intent.updatedAt.toISOString(),
        };
      }),
      proposals: proposals.map((proposal) => ({
        proposalId: proposal.id,
        proposalPda: proposal.proposalPda,
        status: proposal.status,
        creatorWallet: proposal.creatorWallet,
        sponsorWallet: proposal.sponsorWallet,
        manifestId: proposal.manifestId,
        intentId: proposal.intentId,
        deadlineAt: proposal.deadlineAt.toISOString(),
        track2MetricType: proposal.track2MetricType,
        oracleSyncStatus: proposal.oracleSyncStatus,
        updatedAt: proposal.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    handleControllerError(res, error, "GET_WORKSPACE_OVERVIEW_FAILED");
  }
};
