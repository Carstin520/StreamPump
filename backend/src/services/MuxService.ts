/**
 * CN: Mux 服务封装，负责创建视频资产和校验 Mux webhook 签名。
 * EN: Mux service wrapper that creates video assets and verifies Mux webhook signatures.
 */
import Mux from "@mux/mux-node";

const MUX_TIMEOUT_MS = Number(process.env.MUX_REQUEST_TIMEOUT_MS ?? 20_000);

export const buildMuxPlaybackUrl = (playbackId: string): string =>
  `https://stream.mux.com/${playbackId.trim()}.m3u8`;

export interface NormalizedMuxAssetStatus {
  muxAssetId: string;
  status: string;
  playbackId: string | null;
  errorMessage: string | null;
}

class MuxTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Mux timeout after ${timeoutMs}ms (${operation})`);
    this.name = "MuxTimeoutError";
  }
}

export class MuxService {
  private static instance: MuxService | null = null;

  private readonly client: Mux;

  private constructor() {
    this.client = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
  }

  static getInstance(): MuxService {
    if (!MuxService.instance) {
      MuxService.instance = new MuxService();
    }

    return MuxService.instance;
  }

  async createAsset(videoUrl: string): Promise<string> {
    const trimmedUrl = videoUrl.trim();
    if (!trimmedUrl) {
      throw new Error("videoUrl is required");
    }

    this.assertApiCredentials();

    try {
      // Public playback keeps the current prototype simple; access control can be layered on later.
      const asset = await this.withTimeout(
        this.client.video.assets.create({
          inputs: [{ url: trimmedUrl }],
          playback_policies: ["public"],
          video_quality: "basic",
        }),
        "create asset"
      );

      if (!asset.id) {
        throw new Error("Mux response did not include asset id");
      }

      return asset.id;
    } catch (error) {
      throw this.wrapMuxError("createAsset", error);
    }
  }

  async getAsset(muxAssetId: string): Promise<any> {
    const trimmedMuxAssetId = muxAssetId.trim();
    if (!trimmedMuxAssetId) {
      throw new Error("muxAssetId is required");
    }

    this.assertApiCredentials();

    try {
      return await this.withTimeout(
        (this.client.video.assets as any).retrieve(trimmedMuxAssetId),
        "get asset"
      );
    } catch (error) {
      throw this.wrapMuxError("getAsset", error);
    }
  }

  async getAssetStatus(muxAssetId: string): Promise<NormalizedMuxAssetStatus> {
    const asset = await this.getAsset(muxAssetId);
    return this.normalizeAssetStatus(asset, muxAssetId);
  }

  normalizeAssetStatus(asset: any, fallbackMuxAssetId?: string): NormalizedMuxAssetStatus {
    const playbackId = Array.isArray(asset?.playback_ids)
      ? String(asset.playback_ids.find((candidate: any) => candidate?.id)?.id ?? "").trim() || null
      : null;
    const errorMessages = Array.isArray(asset?.errors?.messages)
      ? asset.errors.messages.map((message: unknown) => String(message))
      : [];

    return {
      muxAssetId: String(asset?.id ?? fallbackMuxAssetId ?? "").trim(),
      status: String(asset?.status ?? "").trim().toLowerCase() || "unknown",
      playbackId,
      errorMessage: errorMessages.length > 0 ? errorMessages.join(",") : null,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): void {
    const signature = signatureHeader.trim();
    if (!signature) {
      throw new Error("mux-signature header is required");
    }

    const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
    if (!body.trim()) {
      throw new Error("raw webhook body is required");
    }

    const webhookSecret = process.env.MUX_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new Error("MUX_WEBHOOK_SECRET is not configured");
    }

    try {
      this.client.webhooks.verifySignature(
        body,
        {
          "mux-signature": signature,
        },
        webhookSecret
      );
    } catch (error) {
      throw this.wrapMuxError("verifyWebhookSignature", error);
    }
  }

  private assertApiCredentials(): void {
    if (!process.env.MUX_TOKEN_ID?.trim() || !process.env.MUX_TOKEN_SECRET?.trim()) {
      throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be configured");
    }
  }

  private async withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new MuxTimeoutError(operation, MUX_TIMEOUT_MS));
        }, MUX_TIMEOUT_MS);
      });

      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private wrapMuxError(operation: string, error: unknown): Error {
    if (error instanceof MuxTimeoutError) {
      return error;
    }

    const message = String(error);
    if (
      message.toLowerCase().includes("timeout") ||
      message.includes("ETIMEDOUT") ||
      message.toLowerCase().includes("fetch failed")
    ) {
      return new MuxTimeoutError(operation, MUX_TIMEOUT_MS);
    }

    return error instanceof Error ? error : new Error(message);
  }
}

export const muxService = MuxService.getInstance();
