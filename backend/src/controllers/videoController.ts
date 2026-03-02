import { Request, Response } from "express";
import { createHash, randomUUID } from "crypto";

import { uploadToHybridStorage } from "../services/storage";

const digestHex = (value: string) => createHash("sha256").update(value).digest("hex");

export const uploadVideo = async (req: Request, res: Response) => {
  const creatorId = String(req.body.creatorId ?? "unknown-creator");
  const fileName = String(req.body.fileName ?? "video.mp4");
  const contentType = String(req.body.contentType ?? "video/mp4");
  const base64Payload = String(req.body.fileBase64 ?? "");

  if (!base64Payload) {
    res.status(400).json({ error: "fileBase64 is required" });
    return;
  }

  const fileBuffer = Buffer.from(base64Payload, "base64");
  const videoId = String(req.body.videoId ?? randomUUID());

  const upload = await uploadToHybridStorage({
    creatorId,
    videoId,
    fileName,
    fileBuffer,
    contentType,
  });

  res.status(201).json({
    status: "PENDING_REVIEW",
    creatorId,
    videoId,
    objectKey: upload.objectKey,
    edgeUrl: upload.edgeUrl,
    canonicalUrl: upload.canonicalUrl,
    canonicalUrlDigest: digestHex(upload.canonicalUrl),
    contentHash: upload.contentSha256,
  });
};

export const listFeed = async (_req: Request, res: Response) => {
  res.json({
    items: [],
    message: "Traffic-futures feed index placeholder",
  });
};
