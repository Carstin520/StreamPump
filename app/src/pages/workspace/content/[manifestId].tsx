import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { MediaVideoPlayer } from "@/components/shared/MediaVideoPlayer";
import {
  completeManifestAssetUpload,
  ContentManifestDetailResponse,
  createContentPublication,
  finalizeContentManifest,
  getContentManifestById,
  ManifestAssetKind,
  presignManifestAssets,
} from "@/lib/api/workspace";
import { formatIsoLabel, shortenWallet } from "@/lib/formatting";
import { WORKSPACE_PATH, workspacePageTabs } from "@/lib/routes";
import {
  buildLoginHrefFromRouter,
  clearAuthSession,
  getAccessToken,
  isAuthError,
} from "@/lib/session-flow";

type PageState =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ContentManifestDetailResponse };

type ManifestAssetRecord = ContentManifestDetailResponse["assets"][number];

const ACCEPTED_UPLOAD_TYPES = [
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

const isRenderableUrl = (value: string | null | undefined) => {
  const normalized = value?.trim();
  if (!normalized) {
    return false;
  }

  return normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/");
};

const isVideoAsset = (asset: ManifestAssetRecord) => asset.assetType === "VIDEO";

const isMuxAssetReady = (asset: ManifestAssetRecord) =>
  isVideoAsset(asset) && asset.preferredPlaybackSource === "MUX" && isRenderableUrl(asset.muxPlaybackUrl);

const resolveRenderableAssetUrl = (asset: ManifestAssetRecord) => {
  if (isRenderableUrl(asset.preferredPlaybackUrl)) {
    return asset.preferredPlaybackUrl;
  }

  if (isRenderableUrl(asset.originUrl)) {
    return asset.originUrl;
  }

  return null;
};

const renderabilityHint = (asset: ManifestAssetRecord) => {
  if (resolveRenderableAssetUrl(asset)) {
    return null;
  }

  if (asset.originUrl?.startsWith("s3://")) {
    return "Origin URL is not browser-safe yet. Set S3_PUBLIC_BASE_URL or a CDN domain for direct preview.";
  }

  if (isVideoAsset(asset) && asset.ingestStatus !== "READY") {
    return "Video preview will appear after Mux ingest reaches READY.";
  }

  return "No browser-renderable asset URL is available yet.";
};

function ManifestAssetPreview({ asset }: { asset: ManifestAssetRecord }) {
  const renderableUrl = resolveRenderableAssetUrl(asset);
  const previewHint = renderabilityHint(asset);

  if (isVideoAsset(asset)) {
    if (isMuxAssetReady(asset) && asset.muxPlaybackUrl) {
      return (
        <HlsVideoPreview
          asset={asset}
          fallbackUrl={asset.originUrl && isRenderableUrl(asset.originUrl) ? asset.originUrl : null}
        />
      );
    }

    if (renderableUrl) {
      return (
        <MediaVideoPlayer
          className="h-full w-full"
          controls
          loadingLabel="Preparing preview…"
          muted
          playsInline
          preload="metadata"
          src={renderableUrl}
          videoClassName="h-full w-full object-cover"
        />
      );
    }
  } else if (renderableUrl) {
    return <img alt={`${asset.assetType} ${asset.orderIndex + 1}`} className="h-full w-full object-cover" src={renderableUrl} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 px-4 text-center text-xs text-slate-300">
      {previewHint ?? "Preview pending"}
    </div>
  );
}

function HlsVideoPreview({
  asset,
  fallbackUrl,
}: {
  asset: ManifestAssetRecord;
  fallbackUrl: string | null;
}) {
  return (
    <MediaVideoPlayer
      className="h-full w-full"
      controls
      fallbackSrc={fallbackUrl}
      loadingLabel="Preparing Mux preview…"
      muted
      playsInline
      preload="metadata"
      src={asset.muxPlaybackUrl}
      videoClassName="h-full w-full object-cover"
    />
  );
}

const sha256Hex = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const resolveAssetType = (file: File): ManifestAssetKind =>
  file.type.toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";

const uploadToPresignedUrl = async (url: string, file: Blob, contentType?: string) => {
  const response = await fetch(url, {
    method: "PUT",
    headers: contentType
      ? {
          "Content-Type": contentType,
        }
      : undefined,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Asset upload failed with ${response.status}`);
  }

  return response;
};

const normalizeEtag = (value: string | null) =>
  value?.trim().replace(/^"+|"+$/g, "") || null;

const uploadMultipartAsset = async (
  upload: Extract<
    Awaited<ReturnType<typeof presignManifestAssets>>["uploads"][number],
    { uploadStrategy: "MULTIPART" }
  >,
  file: File,
  onPartStart: (partNumber: number, partCount: number) => void,
) => {
  const completedParts = [];

  for (const part of upload.parts) {
    onPartStart(part.partNumber, upload.partCount);

    const start = (part.partNumber - 1) * upload.partSizeBytes;
    const end = Math.min(start + upload.partSizeBytes, file.size);
    const chunk = file.slice(start, end);
    const response = await uploadToPresignedUrl(part.presignedUrl, chunk);
    const etag = normalizeEtag(response.headers.get("etag"));

    if (!etag) {
      throw new Error("Multipart upload response is missing ETag. Expose ETag in S3 CORS.");
    }

    completedParts.push({
      partNumber: part.partNumber,
      etag,
    });
  }

  return {
    multipartUploadId: upload.multipartUploadId,
    parts: completedParts,
  };
};

export default function ManifestDetailPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [busyAction, setBusyAction] = useState<"upload" | "finalize" | "publication" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [publicationPlatform, setPublicationPlatform] = useState("XIAOHONGSHU");
  const [publicationUrl, setPublicationUrl] = useState("");
  const [publicationPostId, setPublicationPostId] = useState("");
  const loginHref = buildLoginHrefFromRouter(router, WORKSPACE_PATH);

  const refreshManifest = async (token: string, manifestId: string) => {
    const data = await getContentManifestById(token, manifestId);
    setState({ kind: "ready", data });
    return data;
  };

  const handleAuthFailure = () => {
    clearAuthSession();
    setState({ kind: "auth" });
  };

  const handleApiError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    if (isAuthError(error)) {
      handleAuthFailure();
      return;
    }

    setActionMessage(message);
  };

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let cancelled = false;
    const token = getAccessToken();
    const manifestId = String(router.query.manifestId ?? "").trim();

    if (!token) {
      setState({ kind: "auth" });
      return;
    }

    if (!manifestId) {
      setState({ kind: "error", message: "manifestId is required" });
      return;
    }

    setState({ kind: "loading" });
    void getContentManifestById(token, manifestId)
      .then((data) => {
        if (!cancelled) {
          setState({ kind: "ready", data });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load manifest.";
        if (isAuthError(error)) {
          handleAuthFailure();
          return;
        }

        setState({ kind: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.manifestId]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setActionMessage(
      files.length > 0
        ? `${files.length} asset file(s) ready for upload. Videos will use multipart S3 upload, then queue async Mux ingest.`
        : null
    );
  };

  const handleUploadAssets = async () => {
    const token = getAccessToken();
    const manifestId = state.kind === "ready"
      ? state.data.manifestId
      : String(router.query.manifestId ?? "").trim();

    if (!token) {
      handleAuthFailure();
      return;
    }

    if (!manifestId) {
      setActionMessage("manifestId is required");
      return;
    }

    if (selectedFiles.length === 0) {
      setActionMessage("Select at least one asset before requesting upload URLs.");
      return;
    }

    const invalidFile = selectedFiles.find((file) => !ACCEPTED_UPLOAD_TYPES.includes(file.type.toLowerCase()));
    if (invalidFile) {
      setActionMessage(`Unsupported file type for ${invalidFile.name}. Allowed types: ${ACCEPTED_UPLOAD_TYPES.join(", ")}`);
      return;
    }

    setBusyAction("upload");

    try {
      setActionMessage(`Preparing ${selectedFiles.length} upload slot(s)...`);

      const existingAssetCount = state.kind === "ready" ? state.data.assets.length : 0;
      const inputs = await Promise.all(
        selectedFiles.map(async (file, index) => ({
          assetType: resolveAssetType(file),
          orderIndex: existingAssetCount + index,
          sha256Hex: await sha256Hex(file),
          mimeType: file.type.toLowerCase(),
          fileSizeBytes: String(file.size),
        })),
      );

      const response = await presignManifestAssets(token, manifestId, inputs);

      for (const [index, upload] of response.uploads.entries()) {
        const file = selectedFiles[index];
        setActionMessage(
          `Uploading ${index + 1}/${response.uploads.length}: ${file.name} via ${upload.uploadStrategy}.`
        );

        if (upload.uploadStrategy === "MULTIPART") {
          const multipartCompletion = await uploadMultipartAsset(
            upload,
            file,
            (partNumber, partCount) => {
              setActionMessage(
                `Uploading ${file.name} part ${partNumber}/${partCount} to S3 before async Mux ingest.`
              );
            }
          );

          await completeManifestAssetUpload(
            token,
            manifestId,
            upload.assetId,
            multipartCompletion
          );
        } else {
          await uploadToPresignedUrl(upload.presignedUrl, file, file.type);
          await completeManifestAssetUpload(token, manifestId, upload.assetId);
        }
      }

      await refreshManifest(token, manifestId);
      setSelectedFiles([]);
      setActionMessage(
        "Asset upload completed. Images are ready from S3 immediately; videos are now queued for async Mux ingest."
      );
    } catch (error) {
      handleApiError(error, "Failed to upload manifest assets.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleFinalize = async () => {
    const token = getAccessToken();
    const manifestId = state.kind === "ready"
      ? state.data.manifestId
      : String(router.query.manifestId ?? "").trim();

    if (!token) {
      handleAuthFailure();
      return;
    }

    if (!manifestId) {
      setActionMessage("manifestId is required");
      return;
    }

    setBusyAction("finalize");

    try {
      setActionMessage("Finalizing manifest and deriving canonical hash...");
      const result = await finalizeContentManifest(token, manifestId);
      await refreshManifest(token, manifestId);
      setActionMessage(
        result.manifestHashHex
          ? `Manifest finalized. Hash: ${result.manifestHashHex.slice(0, 16)}...`
          : "Manifest finalized.",
      );
    } catch (error) {
      handleApiError(error, "Failed to finalize manifest.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreatePublication = async () => {
    const token = getAccessToken();
    const manifestId = state.kind === "ready"
      ? state.data.manifestId
      : String(router.query.manifestId ?? "").trim();

    if (!token) {
      handleAuthFailure();
      return;
    }

    if (!manifestId) {
      setActionMessage("manifestId is required");
      return;
    }

    const normalizedUrl = publicationUrl.trim();
    if (!normalizedUrl) {
      setActionMessage("Publication URL is required.");
      return;
    }

    try {
      new URL(normalizedUrl);
    } catch (_error) {
      setActionMessage("Publication URL must be a valid absolute URL.");
      return;
    }

    setBusyAction("publication");

    try {
      setActionMessage("Creating publication record...");
      await createContentPublication(token, {
        manifestId,
        platform: publicationPlatform,
        externalUrl: normalizedUrl,
        externalPostId: publicationPostId.trim() || null,
      });

      await refreshManifest(token, manifestId);
      setPublicationUrl("");
      setPublicationPostId("");
      setActionMessage("Publication record created and manifest refreshed.");
    } catch (error) {
      handleApiError(error, "Failed to create publication.");
    } finally {
      setBusyAction(null);
    }
  };

  const manifestTitle = state.kind === "ready" ? state.data.title ?? state.data.manifestId : "Manifest detail";

  return (
    <>
      <Head>
        <title>{`StreamPump | ${manifestTitle}`}</title>
      </Head>
      <PageShell
        eyebrow="Workspace"
        subtitle="This view is where upload, processing, and finalize status need to feel operationally clear without looking like an ops dashboard."
        tabs={workspacePageTabs}
        title={manifestTitle}
      >
        {state.kind === "loading" ? <AsyncStateCard body="Loading manifest detail, assets, and publication records from the v1 content API." title="Loading manifest" /> : null}
        {state.kind === "auth" ? <AsyncStateCard actionHref={loginHref} actionLabel="Open login" body="Manifest detail now uses authenticated content APIs. Sign in to load creator-owned manifest data." title="Session required" /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title="Manifest request failed" /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              <section className="glass-card p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Manifest state</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{state.data.status}</h3>
                      <p className="mt-2 text-sm text-slate-300">Owner: {shortenWallet(state.data.creatorWallet)} · {state.data.contentType}</p>
                    </div>
                    <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{formatIsoLabel(state.data.updatedAt)}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {state.data.assets.map((asset) => (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-4" key={asset.assetId}>
                        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700">
                          <ManifestAssetPreview asset={asset} />
                        </div>
                        <p className="mt-3 text-sm font-medium text-white">{asset.assetType} #{asset.orderIndex + 1}</p>
                        <p className="text-xs text-slate-400">{asset.uploadStatus} · {asset.deliveryStatus}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Read from: {asset.preferredPlaybackSource ?? "Pending"} · Ingest: {asset.ingestStatus}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Upload: {asset.uploadStrategy} · Mux: {asset.muxLastKnownStatus ?? "n/a"}
                        </p>
                        {asset.preferredPlaybackUrl ? (
                          <a
                            className="mt-2 inline-flex text-xs text-sky-300 transition hover:text-sky-200"
                            href={asset.preferredPlaybackUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open asset URL
                          </a>
                        ) : null}
                        {asset.processingError ? (
                          <p className="mt-2 text-xs text-rose-300">{asset.processingError}</p>
                        ) : null}
                        {!asset.processingError && renderabilityHint(asset) ? (
                          <p className="mt-2 text-xs text-amber-300">{renderabilityHint(asset)}</p>
                        ) : null}
                      </div>
                    ))}
                    {state.data.assets.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-4 text-sm text-slate-300 md:col-span-3">
                        No assets have been attached to this manifest yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="glass-card p-5">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Asset upload</p>
                    <span className="text-xs text-slate-400">Allowed: MP4, MOV, JPEG, PNG, WEBP, HEIC</span>
                  </div>
                  <input
                    accept=".mp4,.mov,.jpg,.jpeg,.png,.webp,.heic,video/mp4,video/quicktime,image/jpeg,image/png,image/webp,image/heic"
                    className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950"
                    multiple
                    onChange={handleFileSelection}
                    type="file"
                  />
                  {selectedFiles.length > 0 ? (
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pending upload set</p>
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file) => (
                          <div className="flex items-center justify-between gap-3 text-sm text-slate-200" key={`${file.name}-${file.size}-${file.lastModified}`}>
                            <span className="truncate">
                              {file.name}
                              {file.type.toLowerCase().startsWith("video/") ? " · multipart + async mux" : " · single-part s3"}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex gap-3">
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-wait disabled:opacity-70"
                      disabled={busyAction !== null}
                      onClick={() => void handleUploadAssets()}
                      type="button"
                    >
                      Upload selected assets
                    </button>
                    <button
                      className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 disabled:opacity-70"
                      disabled={busyAction !== null || selectedFiles.length === 0}
                      onClick={() => {
                        setSelectedFiles([]);
                        setActionMessage("Pending upload set cleared.");
                      }}
                      type="button"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
              </section>

              <section className="glass-card p-5">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Finalize state</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Manifest hash</p>
                      <p className="mt-2 break-all text-sm text-white">{state.data.manifestHashHex ?? "Not finalized"}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Anchor PDA</p>
                      <p className="mt-2 break-all text-sm text-white">{state.data.currentAnchorPda ?? "Not anchored"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Canonical URL</p>
                    <p className="mt-2 break-all text-sm text-slate-300">{state.data.internalCanonicalUrl ?? "No canonical URL yet"}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-wait disabled:opacity-70"
                      disabled={busyAction !== null}
                      onClick={() => void handleFinalize()}
                      type="button"
                    >
                      Finalize manifest
                    </button>
                  </div>
                  {actionMessage ? (
                    <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      {actionMessage}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <section className="glass-card p-5">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Publication state</p>
                {state.data.publications.length > 0 ? (
                  <div className="space-y-3">
                    {state.data.publications.map((publication) => (
                      <div className="rounded-2xl bg-white/5 p-4" key={publication.publicationId}>
                        <p className="text-sm font-medium text-white">{publication.platform}</p>
                        <p className="mt-1 break-all text-xs text-slate-300">{publication.externalUrl}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">{publication.verificationStatus}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-7 text-slate-300">No publication URLs are linked yet. Once a platform post exists, create a publication record here so the manifest can move into the published lifecycle.</p>
                )}

                <div className="rounded-3xl border border-white/10 bg-white/4 p-4">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Create publication</p>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Platform</span>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                        onChange={(event) => setPublicationPlatform(event.target.value.toUpperCase())}
                        value={publicationPlatform}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">External URL</span>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                        onChange={(event) => setPublicationUrl(event.target.value)}
                        placeholder="https://example.com/post/123"
                        value={publicationUrl}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">External post id (optional)</span>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                        onChange={(event) => setPublicationPostId(event.target.value)}
                        placeholder="post-123"
                        value={publicationPostId}
                      />
                    </label>
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-wait disabled:opacity-70"
                      disabled={busyAction !== null}
                      onClick={() => void handleCreatePublication()}
                      type="button"
                    >
                      Create publication record
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </PageShell>
    </>
  );
}
