/**
 * CN: Mux Webhook 控制器，接收转码状态回调并回写 ContentAsset 处理状态。
 * EN: Mux webhook controller that ingests processing callbacks and updates ContentAsset state.
 */
import { AssetProcessingSource, AssetProcessingStatus } from "@prisma/client";
import { Request, Response } from "express";

import { muxService } from "../services/MuxService";
import { syncManifestPublicationEligibility } from "../services/contentPublicationEligibility";
import { prisma } from "../services/prisma";

type MuxWebhookEvent = {
  type?: string;
  data?: {
    id?: string;
    playback_ids?: Array<{ id?: string }>;
    errors?: {
      messages?: string[];
    };
  };
};

const parseRawBody = (body: unknown): string => {
  if (Buffer.isBuffer(body)) {
    return body.toString("utf8");
  }

  if (typeof body === "string") {
    return body;
  }

  if (body && typeof body === "object") {
    return JSON.stringify(body);
  }

  return "";
};

const parseWebhookEvent = (rawBody: string): MuxWebhookEvent => {
  return JSON.parse(rawBody) as MuxWebhookEvent;
};

const resolvePlaybackId = (event: MuxWebhookEvent): string | null => {
  const playbackId = event.data?.playback_ids?.[0]?.id;
  if (!playbackId || !playbackId.trim()) {
    return null;
  }

  return playbackId.trim();
};

const resolveErrorMessage = (event: MuxWebhookEvent): string => {
  const messages = event.data?.errors?.messages ?? [];
  if (messages.length === 0) {
    return "Mux asset processing failed";
  }

  return messages.join(",");
};

export const ingestMuxWebhook = async (req: Request, res: Response) => {
  try {
    const rawBody = parseRawBody(req.body);
    if (!rawBody) {
      res.status(400).json({ error: "raw webhook body is required" });
      return;
    }

    const signatureHeader = req.header("mux-signature")?.trim();
    if (!signatureHeader) {
      res.status(401).json({ error: "mux-signature header is required" });
      return;
    }

    try {
      muxService.verifyWebhookSignature(rawBody, signatureHeader);
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : "invalid mux webhook signature",
      });
      return;
    }

    let event: MuxWebhookEvent;
    try {
      event = parseWebhookEvent(rawBody);
    } catch (_error) {
      res.status(400).json({ error: "invalid mux webhook payload" });
      return;
    }

    const eventType = String(event.type ?? "").trim();
    const muxAssetId = String(event.data?.id ?? "").trim();

    if (!eventType) {
      res.status(400).json({ error: "event.type is required" });
      return;
    }

    if (!muxAssetId) {
      res.status(400).json({ error: "event.data.id is required" });
      return;
    }

    if (eventType === "video.asset.ready") {
      const webhookReceivedAt = new Date();
      const playbackId = resolvePlaybackId(event);
      if (!playbackId) {
        await prisma.contentAsset.updateMany({
          where: { muxAssetId },
          data: {
            processingStatus: AssetProcessingStatus.ERRORED,
            processingSource: AssetProcessingSource.MUX_WEBHOOK,
            muxLastKnownStatus: "ready",
            muxWebhookReceivedAt: webhookReceivedAt,
            processingError: "Mux ready event missing playback_id",
          },
        });

        res.status(202).json({
          received: true,
          ignored: false,
          reason: "ready-without-playback-id",
          muxAssetId,
        });
        return;
      }

      await prisma.contentAsset.updateMany({
        where: { muxAssetId },
        data: {
          processingStatus: AssetProcessingStatus.READY,
          processingSource: AssetProcessingSource.MUX_WEBHOOK,
          muxPlaybackId: playbackId,
          muxLastKnownStatus: "ready",
          muxWebhookReceivedAt: webhookReceivedAt,
          muxReadyAt: webhookReceivedAt,
          processingError: null,
        },
      });

      const readyAssets = await prisma.contentAsset.findMany({
        where: {
          muxAssetId,
          processingStatus: AssetProcessingStatus.READY,
          muxPlaybackId: playbackId,
        },
        select: {
          manifestId: true,
        },
      });
      await Promise.all(
        Array.from(new Set(readyAssets.map((asset) => asset.manifestId))).map((manifestId) =>
          syncManifestPublicationEligibility(manifestId)
        )
      );

      res.json({
        received: true,
        eventType,
        muxAssetId,
        muxPlaybackId: playbackId,
      });
      return;
    }

    if (eventType === "video.asset.errored") {
      const webhookReceivedAt = new Date();
      const errorMessage = resolveErrorMessage(event);

      await prisma.contentAsset.updateMany({
        where: {
          muxAssetId,
          processingStatus: {
            not: AssetProcessingStatus.READY,
          },
        },
        data: {
          processingStatus: AssetProcessingStatus.ERRORED,
          processingSource: AssetProcessingSource.MUX_WEBHOOK,
          muxLastKnownStatus: "errored",
          muxWebhookReceivedAt: webhookReceivedAt,
          processingError: errorMessage,
        },
      });

      res.json({
        received: true,
        eventType,
        muxAssetId,
      });
      return;
    }

    res.json({
      received: true,
      ignored: true,
      eventType,
      muxAssetId,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "failed to process mux webhook",
    });
  }
};
