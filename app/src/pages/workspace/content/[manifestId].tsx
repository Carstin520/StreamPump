import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import {
  CheckCircleIcon,
  CloseIcon,
  ImageIcon,
  LinkIcon,
  SignatureIcon,
  UploadIcon,
  VideoIcon,
} from "@/components/shared/AppIcons";
import { MediaVideoPlayer } from "@/components/shared/MediaVideoPlayer";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { StatusDot } from "@/components/workspace/StatusDot";
import { StepProgress, StepItem } from "@/components/workspace/StepProgress";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import {
  completeManifestAssetUpload,
  ContentManifestDetailResponse,
  createContentPublication,
  createProposalIntent,
  finalizeContentManifest,
  getCreatorMarketProfile,
  getContentManifestById,
  ManifestAssetKind,
  presignManifestAssets,
} from "@/lib/api/workspace";
import { ContentManifestStatus } from "@/lib/api/types";
import { formatIsoLabel, shortenWallet } from "@/lib/formatting";
import { useI18n } from "@/lib/i18n";
import { WORKSPACE_PATH } from "@/lib/routes";
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
type UploadStage = "selected" | "hashing" | "presigning" | "uploading" | "completing" | "uploaded" | "failed";
type UploadQueueItem = { file: File; key: string; message: string; stage: UploadStage };

const ACCEPTED_UPLOAD_TYPES = ["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/webp", "image/heic"];
const TRACK3_OPERATOR_GATED_USDC = "0";
const TRACK3_OPERATOR_GATED_DELAY_DAYS = 0;

const CONTENT_DETAIL_READINESS_DESCRIPTION =
  "This page reads live content manifests and can resume asset upload, finalize content, record publication URLs, and create proposal intents. It still depends on authenticated session state, R2/Mux/backend configuration, and seeded S2 creator readiness; failed asset cleanup and webhook reconciliation are not fully productized.";

const STATUS_LABELS: Record<ContentManifestStatus, string> = {
  DRAFT: "草稿", UPLOADING: "上传中", READY: "可发布", LOCKED: "已锁定",
  ANCHORED: "已锚定", PUBLISHED: "已发布", ARCHIVED: "已归档",
};
const STATUS_TONES: Record<ContentManifestStatus, string> = {
  DRAFT: "border-[#7486a1]/30 bg-[#7486a1]/12 text-[#a8b6cc]",
  UPLOADING: "border-[#67b8ff]/30 bg-[#67b8ff]/12 text-[#8ad0ff]",
  READY: "border-[#65ecaf]/30 bg-[#65ecaf]/12 text-[#8df0c4]",
  LOCKED: "border-[#f3b33e]/30 bg-[#f3b33e]/12 text-[#f3c66e]",
  ANCHORED: "border-[#de402a]/30 bg-[#de402a]/12 text-[#ff8a78]",
  PUBLISHED: "border-[#65ecaf]/40 bg-[#65ecaf]/16 text-[#65ecaf]",
  ARCHIVED: "border-white/10 bg-white/5 text-[#8ea0ba]",
};
const UPLOAD_STAGE_LABELS: Record<UploadStage, string> = {
  selected: "待上传", hashing: "计算哈希", presigning: "请求签名",
  uploading: "上传中", completing: "完成中", uploaded: "已上传", failed: "失败",
};
const UPLOAD_STAGE_TONES: Record<UploadStage, string> = {
  selected: "text-[#8ea0ba]", hashing: "text-[#67b8ff]", presigning: "text-[#67b8ff]",
  uploading: "text-[#67b8ff]", completing: "text-[#f3b33e]", uploaded: "text-[#65ecaf]", failed: "text-[#f67263]",
};

const isRenderableUrl = (v: string | null | undefined) => {
  const n = v?.trim();
  return n ? n.startsWith("http://") || n.startsWith("https://") || n.startsWith("/") : false;
};
const isVideoAsset = (a: ManifestAssetRecord) => a.assetType === "VIDEO";
const isMuxAssetReady = (a: ManifestAssetRecord) =>
  isVideoAsset(a) && a.preferredPlaybackSource === "MUX" && isRenderableUrl(a.muxPlaybackUrl);
const hasAssetIssue = (a: ManifestAssetRecord) => {
  const statuses = [a.uploadStatus, a.processingStatus, a.ingestStatus, a.deliveryStatus]
    .map((status) => status?.toUpperCase?.() ?? "");
  return Boolean(a.processingError) || statuses.some((status) => status.includes("FAILED") || status.includes("ERROR"));
};
const isAssetWaiting = (a: ManifestAssetRecord) => {
  if (hasAssetIssue(a)) return false;
  const statuses = [a.uploadStatus, a.processingStatus, a.ingestStatus, a.deliveryStatus]
    .map((status) => status?.toUpperCase?.() ?? "");
  return statuses.some((status) => ["PENDING", "PROCESSING", "QUEUED", "UPLOADING"].includes(status));
};
const resolveRenderableAssetUrl = (a: ManifestAssetRecord) => {
  if (isRenderableUrl(a.preferredPlaybackUrl)) return a.preferredPlaybackUrl;
  if (isRenderableUrl(a.originUrl)) return a.originUrl;
  return null;
};

const sha256Hex = async (file: File) => {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const resolveAssetType = (file: File): ManifestAssetKind =>
  file.type.toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";

const uploadToPresignedUrl = async (url: string, file: Blob, contentType?: string) => {
  const r = await fetch(url, { method: "PUT", headers: contentType ? { "Content-Type": contentType } : undefined, body: file });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  return r;
};
const normalizeEtag = (v: string | null) => v?.trim().replace(/^"+|"+$/g, "") || null;

const uploadMultipartAsset = async (
  upload: Extract<Awaited<ReturnType<typeof presignManifestAssets>>["uploads"][number], { uploadStrategy: "MULTIPART" }>,
  file: File,
  onPartStart: (partNumber: number, partCount: number) => void,
) => {
  const parts = [];
  for (const part of upload.parts) {
    onPartStart(part.partNumber, upload.partCount);
    const start = (part.partNumber - 1) * upload.partSizeBytes;
    const chunk = file.slice(start, Math.min(start + upload.partSizeBytes, file.size));
    const r = await uploadToPresignedUrl(part.presignedUrl, chunk);
    const etag = normalizeEtag(r.headers.get("etag"));
    if (!etag) throw new Error("Missing ETag");
    parts.push({ partNumber: part.partNumber, etag });
  }
  return { multipartUploadId: upload.multipartUploadId, parts };
};

const toUsdcAtomicString = (v: string) => {
  const n = v.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(n)) throw new Error("USDC 格式无效");
  const [whole, frac = ""] = n.split(".");
  return `${whole}${frac.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "") || "0";
};

const defaultDeadlineInput = () => {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function deriveManifestSteps(
  status: ContentManifestStatus,
  hasAssets: boolean,
  hasPublications: boolean,
  t: (key: string) => string,
): StepItem[] {
  const s = (label: string, done: boolean, current: boolean): StepItem => ({
    label,
    status: done ? "done" : current ? "current" : "pending",
  });
  const isDraft = status === "DRAFT";
  const isUploading = status === "UPLOADING";
  const isReady = status === "READY";
  const isLocked = status === "LOCKED";
  const isAnchored = status === "ANCHORED";
  const isPublished = status === "PUBLISHED";

  return [
    s(t("workspace.details"), !isDraft, isDraft),
    s(t("workspace.uploadAssets"), hasAssets && !isUploading, isUploading || (isDraft && !hasAssets)),
    s(t("workspace.completeContent"), isReady || isLocked || isAnchored || isPublished, !isDraft && !isUploading && !isReady && !hasAssets),
    s(t("workspace.publish"), isPublished, isReady || isAnchored),
    s(t("nav.sponsorships"), false, isLocked || isPublished),
  ];
}

export default function ManifestDetailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [busyAction, setBusyAction] = useState<"upload" | "finalize" | "publication" | "intent" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [publicationPlatform, setPublicationPlatform] = useState("XIAOHONGSHU");
  const [publicationUrl, setPublicationUrl] = useState("");
  const [publicationPostId, setPublicationPostId] = useState("");
  const [sponsorWallet, setSponsorWallet] = useState("");
  const [deadlineInput, setDeadlineInput] = useState(defaultDeadlineInput);
  const [track1BaseUsdc, setTrack1BaseUsdc] = useState("500");
  const [track2MetricType, setTrack2MetricType] = useState<"VIEWS" | "CLICKS" | "SAVES">("VIEWS");
  const [track2TargetValue, setTrack2TargetValue] = useState("10000");
  const [track2MinAchievementBps, setTrack2MinAchievementBps] = useState("7000");
  const [track2BudgetUsdc, setTrack2BudgetUsdc] = useState("1000");
  const [activeSection, setActiveSection] = useState<"assets" | "publish" | "sponsor">("assets");

  const loginHref = buildLoginHrefFromRouter(router, WORKSPACE_PATH);
  const updateUploadItem = (key: string, patch: Partial<Pick<UploadQueueItem, "message" | "stage">>) =>
    setUploadQueue((items) => items.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const refreshManifest = async (token: string, manifestId: string) => {
    const data = await getContentManifestById(token, manifestId);
    setState({ kind: "ready", data });
    return data;
  };
  const handleAuthFailure = () => { clearAuthSession(); setState({ kind: "auth" }); };
  const handleApiError = (error: unknown, fallback: string) => {
    if (isAuthError(error)) { handleAuthFailure(); return; }
    setActionMessage(error instanceof Error ? error.message : fallback);
  };

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    const token = getAccessToken();
    const manifestId = String(router.query.manifestId ?? "").trim();
    if (!token) { setState({ kind: "auth" }); return; }
    if (!manifestId) { setState({ kind: "error", message: "manifestId required" }); return; }
    setState({ kind: "loading" });
    void getContentManifestById(token, manifestId)
      .then((data) => { if (!cancelled) setState({ kind: "ready", data }); })
      .catch((error) => {
        if (cancelled) return;
        if (isAuthError(error)) { handleAuthFailure(); return; }
        setState({ kind: "error", message: error instanceof Error ? error.message : "加载失败" });
      });
    return () => { cancelled = true; };
  }, [router.isReady, router.query.manifestId]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setUploadQueue(files.map((f) => ({ file: f, key: `${f.name}-${f.size}-${f.lastModified}`, message: "待上传", stage: "selected" })));
  };

  const handleUploadAssets = async () => {
    const token = getAccessToken();
    const manifestId = state.kind === "ready" ? state.data.manifestId : String(router.query.manifestId ?? "").trim();
    if (!token) { handleAuthFailure(); return; }
    if (!manifestId || selectedFiles.length === 0) { setActionMessage("请选择文件"); return; }
    const invalid = selectedFiles.find((f) => !ACCEPTED_UPLOAD_TYPES.includes(f.type.toLowerCase()));
    if (invalid) { setActionMessage(`不支持的格式: ${invalid.name}`); return; }
    setBusyAction("upload");
    try {
      const existingCount = state.kind === "ready" ? state.data.assets.length : 0;
      const inputs = await Promise.all(selectedFiles.map(async (f, i) => {
        updateUploadItem(`${f.name}-${f.size}-${f.lastModified}`, { message: "计算哈希中", stage: "hashing" });
        return { assetType: resolveAssetType(f), orderIndex: existingCount + i, sha256Hex: await sha256Hex(f), mimeType: f.type.toLowerCase(), fileSizeBytes: String(f.size) };
      }));
      setUploadQueue((items) => items.map((i) => ({ ...i, message: "请求上传签名", stage: "presigning" })));
      const response = await presignManifestAssets(token, manifestId, inputs);
      for (const [idx, upload] of response.uploads.entries()) {
        const f = selectedFiles[idx];
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        updateUploadItem(key, { message: `上传中 (${upload.uploadStrategy})`, stage: "uploading" });
        if (upload.uploadStrategy === "MULTIPART") {
          const mp = await uploadMultipartAsset(upload, f, (pn, pc) => updateUploadItem(key, { message: `上传分片 ${pn}/${pc}`, stage: "uploading" }));
          updateUploadItem(key, { message: "完成上传", stage: "completing" });
          await completeManifestAssetUpload(token, manifestId, upload.assetId, mp);
        } else {
          await uploadToPresignedUrl(upload.presignedUrl, f, f.type);
          updateUploadItem(key, { message: "完成中", stage: "completing" });
          await completeManifestAssetUpload(token, manifestId, upload.assetId);
        }
        updateUploadItem(key, { message: "已上传", stage: "uploaded" });
      }
      await refreshManifest(token, manifestId);
      setSelectedFiles([]);
      setActionMessage("素材上传完成");
    } catch (error) {
      setUploadQueue((items) => items.map((i) => i.stage === "uploaded" ? i : { ...i, message: "上传失败", stage: "failed" }));
      if (!isAuthError(error)) {
        try {
          await refreshManifest(token, manifestId);
        } catch {
          // Keep the original upload error visible; recovery details can be retried by refreshing the page.
        }
      }
      handleApiError(error, "上传失败");
    } finally { setBusyAction(null); }
  };

  const handleFinalize = async () => {
    const token = getAccessToken();
    const manifestId = state.kind === "ready" ? state.data.manifestId : String(router.query.manifestId ?? "").trim();
    if (!token) { handleAuthFailure(); return; }
    if (!manifestId) return;
    setBusyAction("finalize");
    try {
      const r = await finalizeContentManifest(token, manifestId);
      await refreshManifest(token, manifestId);
      setActionMessage(r.manifestHashHex ? `已完善，哈希: ${r.manifestHashHex.slice(0, 12)}...` : "已完善");
    } catch (error) { handleApiError(error, "完善失败"); }
    finally { setBusyAction(null); }
  };

  const handleCreatePublication = async () => {
    const token = getAccessToken();
    const manifestId = state.kind === "ready" ? state.data.manifestId : "";
    if (!token) { handleAuthFailure(); return; }
    const url = publicationUrl.trim();
    if (!url) { setActionMessage("请输入发布链接"); return; }
    try { new URL(url); } catch { setActionMessage("无效的链接格式"); return; }
    setBusyAction("publication");
    try {
      await createContentPublication(token, { manifestId, platform: publicationPlatform, externalUrl: url, externalPostId: publicationPostId.trim() || null });
      await refreshManifest(token, manifestId);
      setPublicationUrl(""); setPublicationPostId("");
      setActionMessage("发布记录已创建，等待验证和媒体交付就绪后进入 public feed");
    } catch (error) { handleApiError(error, "发布失败"); }
    finally { setBusyAction(null); }
  };

  const handleCreateProposalIntent = async () => {
    const token = getAccessToken();
    const manifest = state.kind === "ready" ? state.data : null;
    if (!token) { handleAuthFailure(); return; }
    if (!manifest || !["READY", "ANCHORED", "PUBLISHED", "LOCKED"].includes(manifest.status)) { setActionMessage("请先完善内容"); return; }
    if (!sponsorWallet.trim()) { setActionMessage("请输入赞助商钱包"); return; }
    const dMs = new Date(deadlineInput).getTime();
    if (!Number.isFinite(dMs) || dMs <= Date.now()) { setActionMessage("截止日期须在未来"); return; }
    setBusyAction("intent");
    try {
      const creatorMarket = await getCreatorMarketProfile(manifest.creatorWallet);
      if (creatorMarket.creator.stage !== "S2_ACTIVE" || creatorMarket.creator.level < 2) {
        setActionMessage("当前创作者尚未完成 S2 readiness。请先运行 demo seed/upgrade 流程，再创建赞助合作。");
        return;
      }

      const intent = await createProposalIntent(token, {
        manifestId: manifest.manifestId, creatorWallet: manifest.creatorWallet, sponsorWallet: sponsorWallet.trim(),
        deadlineUnix: String(Math.floor(dMs / 1000)), track1BaseUsdc: toUsdcAtomicString(track1BaseUsdc),
        track2MetricType, track2TargetValue: track2TargetValue.trim(), track2MinAchievementBps: Number(track2MinAchievementBps),
        track2UsdcDeposited: toUsdcAtomicString(track2BudgetUsdc),
        track3UsdcDeposited: toUsdcAtomicString(TRACK3_OPERATOR_GATED_USDC),
        track3DelayDays: TRACK3_OPERATOR_GATED_DELAY_DAYS,
      });
      setActionMessage("合作意向已创建");
      void router.push(`/workspace/intents/${intent.intentId}`);
    } catch (error) { handleApiError(error, "创建失败"); }
    finally { setBusyAction(null); }
  };

  const title = state.kind === "ready" ? (state.data.title ?? t("workspace.unknownContent")) : t("workspace.contentDetail");

  if (state.kind !== "ready") {
    return (
      <>
        <Head><title>{`StreamPump | ${title}`}</title></Head>
        <WorkspaceShell>
          <ProductReadinessBanner
            description={CONTENT_DETAIL_READINESS_DESCRIPTION}
            status="SEEDED_DEMO"
            title="Content detail is live API/R2-wired with media recovery gaps"
          />
          {state.kind === "loading" && (
            <div className="liquid-card card-radius flex items-center gap-3 px-6 py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
              <p className="text-sm text-[#8ea0ba]">{t("common.loading")}</p>
            </div>
          )}
          {state.kind === "auth" && (
            <div className="liquid-card card-radius px-6 py-8">
              <p className="text-lg font-semibold text-white">{t("workspace.loginRequired")}</p>
              <a className="glass-button-primary mt-4 inline-flex px-5 py-2.5 text-sm font-semibold" href={loginHref}>{t("common.login")}</a>
            </div>
          )}
          {state.kind === "error" && (
            <div className="liquid-card card-radius px-6 py-8">
              <p className="text-sm text-[#f67263]">{state.message}</p>
            </div>
          )}
        </WorkspaceShell>
      </>
    );
  }

  const d = state.data;
  const steps = deriveManifestSteps(d.status, d.assets.length > 0, d.publications.length > 0, t);
  const assetsWithIssues = d.assets.filter(hasAssetIssue);
  const assetsWaiting = d.assets.filter(isAssetWaiting);

  const previewPanel = (
    <aside className="space-y-4">
      <div className="liquid-card card-radius p-4">
        <div className="flex items-center justify-between">
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${STATUS_TONES[d.status]}`}>
            {STATUS_LABELS[d.status]}
          </span>
          <span className="text-[10px] text-[#5a6b82]">{formatIsoLabel(d.updatedAt)}</span>
        </div>
        <p className="mt-3 text-sm font-medium text-white">{d.title ?? t("workspace.unknownContent")}</p>
        <p className="mt-1 text-[11px] text-[#6b7d96]">{d.contentType} · {d.assets.length} {t("workspace.media")} · v{d.version}</p>
        <p className="mt-2 text-[11px] text-[#5a6b82]">{t("common.creator")}: {shortenWallet(d.creatorWallet)}</p>
      </div>

      {d.manifestHashHex && (
        <div className="liquid-card card-radius p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.chainStatus")}</p>
          <div className="mt-2 space-y-2">
            <HashRow label="Manifest Hash" value={d.manifestHashHex} />
            <HashRow label="Anchor PDA" value={d.currentAnchorPda} />
          </div>
        </div>
      )}

      {d.publications.length > 0 && (
        <div className="liquid-card card-radius p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.published")}</p>
          {d.publications.map((pub) => (
            <div className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2" key={pub.publicationId}>
              <p className="text-xs font-medium text-white">{pub.platform}</p>
              <p className="mt-0.5 truncate text-[10px] text-[#5a6b82]">{pub.externalUrl}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );

  const sections: { id: "assets" | "publish" | "sponsor"; label: string }[] = [
    { id: "assets", label: t("workspace.assetManagement") },
    { id: "publish", label: t("workspace.publish") },
    { id: "sponsor", label: t("nav.sponsorships") },
  ];

  return (
    <>
      <Head><title>{`StreamPump | ${title}`}</title></Head>
      <WorkspaceShell aside={previewPanel}>
        <ProductReadinessBanner
          description={CONTENT_DETAIL_READINESS_DESCRIPTION}
          status="SEEDED_DEMO"
          title="Content detail is live API/R2-wired with media recovery gaps"
        />

        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-white">{d.title ?? t("workspace.unknownContent")}</h2>
          <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <StepProgress steps={steps} />
          </div>
        </div>

        {/* Asset preview grid */}
        {d.assets.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {d.assets.map((asset) => (
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b1016]" key={asset.assetId}>
                <AssetPreview asset={asset} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-medium text-white">{asset.assetType} #{asset.orderIndex + 1}</span>
                    <StatusDot tone={asset.uploadStatus === "UPLOADED" ? "success" : asset.uploadStatus === "FAILED" ? "error" : "processing"} size="xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section tabs */}
        <div className="flex gap-1 border-b border-white/[0.06]">
          {sections.map((s) => (
            <button
              className={`relative px-4 py-2.5 text-xs font-medium transition ${activeSection === s.id ? "text-white" : "text-[#6b7d96] hover:text-white"}`}
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              type="button"
            >
              {s.label}
              {activeSection === s.id && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#de402a]" />}
            </button>
          ))}
        </div>

        {/* Assets section */}
        {activeSection === "assets" && (
          <div className="section-enter space-y-4">
            {(assetsWithIssues.length > 0 || assetsWaiting.length > 0) && (
              <div className="rounded-2xl border border-[#f3b33e]/20 bg-[#1f1708]/35 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3c66e]">Media recovery status</p>
                    <p className="mt-1 text-xs leading-5 text-[#9aabc4]">
                      {assetsWithIssues.length > 0
                        ? `${assetsWithIssues.length} asset(s) need operator/user recovery. Upload replacement files here, then finalize again after storage is healthy.`
                        : `${assetsWaiting.length} asset(s) are still waiting on upload, processing, ingest, or delivery updates.`}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#f3b33e]/25 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#f3c66e]">
                    {assetsWithIssues.length > 0 ? "RECOVERY_NEEDED" : "PROCESSING"}
                  </span>
                </div>
                {assetsWithIssues.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {assetsWithIssues.slice(0, 3).map((asset) => (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-[11px]" key={asset.assetId}>
                        <span className="font-mono text-[#8ea0ba]">{asset.assetType} #{asset.orderIndex + 1}</span>
                        <span className="truncate text-[#f67263]">{asset.processingError || `${asset.uploadStatus} / ${asset.processingStatus} / ${asset.deliveryStatus}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="block cursor-pointer">
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.02] p-6 transition hover:border-[#de402a]/30">
                <UploadIcon className="h-6 w-6 text-[#6b7d96]" />
                <p className="text-xs text-[#8ea0ba]">{t("workspace.uploadAssetDrop")}</p>
              </div>
              <input accept=".mp4,.mov,.jpg,.jpeg,.png,.webp,.heic" className="hidden" multiple onChange={handleFileSelection} type="file" />
            </label>

            {uploadQueue.length > 0 && (
              <div className="space-y-2">
                {uploadQueue.map((item) => (
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5" key={item.key}>
                    {item.file.type.startsWith("video/") ? <VideoIcon className="h-4 w-4 text-[#67b8ff]" /> : <ImageIcon className="h-4 w-4 text-[#65ecaf]" />}
                    <span className="min-w-0 flex-1 truncate text-xs text-white">{item.file.name}</span>
                    <span className={`text-[10px] font-medium ${UPLOAD_STAGE_TONES[item.stage]}`}>{UPLOAD_STAGE_LABELS[item.stage]}</span>
                    {(item.stage === "uploading" || item.stage === "hashing" || item.stage === "presigning") && (
                      <div className="h-3 w-3 animate-spin rounded-full border border-[#67b8ff] border-t-transparent" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="glass-button-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-40"
                disabled={busyAction !== null || selectedFiles.length === 0}
                onClick={() => void handleUploadAssets()}
                type="button"
              >
                {busyAction === "upload" && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                <UploadIcon className="h-3.5 w-3.5" />
                {t("workspace.uploadAssets")}
              </button>
              <button
                className="glass-button-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-40"
                disabled={busyAction !== null}
                onClick={() => void handleFinalize()}
                type="button"
              >
                {busyAction === "finalize" && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                <CheckCircleIcon className="h-3.5 w-3.5" />
                {t("workspace.completeContent")}
              </button>
            </div>
          </div>
        )}

        {/* Publish section */}
        {activeSection === "publish" && (
          <div className="section-enter space-y-4">
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.publishPlatform")}</span>
                <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setPublicationPlatform(e.target.value.toUpperCase())} value={publicationPlatform} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.externalLink")}</span>
                <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setPublicationUrl(e.target.value)} placeholder="https://..." value={publicationUrl} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.externalPostId")}</span>
                <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setPublicationPostId(e.target.value)} value={publicationPostId} />
              </label>
            </div>
            <button
              className="glass-button-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-40"
              disabled={busyAction !== null}
              onClick={() => void handleCreatePublication()}
              type="button"
            >
              {busyAction === "publication" && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
              <LinkIcon className="h-3.5 w-3.5" />
              {t("workspace.publishToFeed")}
            </button>
          </div>
        )}

        {/* Sponsor section */}
        {activeSection === "sponsor" && (
          <div className="section-enter space-y-4">
            {!["READY", "ANCHORED", "PUBLISHED", "LOCKED"].includes(d.status) && (
              <div className="rounded-2xl border border-[#f3b33e]/20 bg-[#f3b33e]/[0.06] px-4 py-3 text-xs text-[#f3c66e]">
                {t("workspace.sponsorshipAfterDraft")}
              </div>
            )}
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.sponsorWallet")}</span>
                <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setSponsorWallet(e.target.value)} placeholder={t("workspace.sponsorPublicKey")} value={sponsorWallet} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.deadline")}</span>
                <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setDeadlineInput(e.target.value)} type="datetime-local" value={deadlineInput} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.basePay")} (USDC)</span>
                  <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setTrack1BaseUsdc(e.target.value)} value={track1BaseUsdc} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.performanceBudget")} (USDC)</span>
                  <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setTrack2BudgetUsdc(e.target.value)} value={track2BudgetUsdc} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.metricType")}</span>
                  <select className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setTrack2MetricType(e.target.value as "VIEWS" | "CLICKS" | "SAVES")} value={track2MetricType}>
                    <option value="VIEWS">{t("workspace.views")}</option><option value="CLICKS">{t("workspace.clicks")}</option><option value="SAVES">{t("workspace.saves")}</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{t("workspace.targetValue")}</span>
                  <input className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none" onChange={(e) => setTrack2TargetValue(e.target.value)} value={track2TargetValue} />
                </label>
              </div>
              <div className="rounded-2xl border border-[#f3b33e]/20 bg-[#1f1708]/35 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3c66e]">Track 3 CPS operator-gated</p>
                <p className="mt-1 text-xs leading-5 text-[#9aabc4]">
                  Ordinary proposal creation now submits Track 3 as 0 USDC / 0 days. CPS requires merchant reconciliation and remains disabled outside controlled operator workflows.
                </p>
              </div>
            </div>
            <button
              className="glass-button-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-40"
              disabled={busyAction !== null || !["READY", "ANCHORED", "PUBLISHED", "LOCKED"].includes(d.status)}
              onClick={() => void handleCreateProposalIntent()}
              type="button"
            >
              {busyAction === "intent" && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
              <SignatureIcon className="h-3.5 w-3.5" />
              {t("workspace.createSponsorship")}
            </button>
          </div>
        )}

        {actionMessage && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-[#8ea0ba]">
            {actionMessage}
          </div>
        )}
      </WorkspaceShell>
    </>
  );
}

function AssetPreview({ asset }: { asset: ManifestAssetRecord }) {
  const { t } = useI18n();
  const url = resolveRenderableAssetUrl(asset);
  if (isVideoAsset(asset) && isMuxAssetReady(asset) && asset.muxPlaybackUrl) {
    return <MediaVideoPlayer className="h-full w-full" controls muted playsInline preload="metadata" src={asset.muxPlaybackUrl} videoClassName="h-full w-full object-cover" fallbackSrc={asset.originUrl && isRenderableUrl(asset.originUrl) ? asset.originUrl : undefined} />;
  }
  if (isVideoAsset(asset) && url) {
    return <MediaVideoPlayer className="h-full w-full" controls muted playsInline preload="metadata" src={url} videoClassName="h-full w-full object-cover" />;
  }
  if (!isVideoAsset(asset) && url) {
    return <img alt={`${asset.assetType} ${asset.orderIndex + 1}`} className="h-full w-full object-cover" src={url} />;
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
      {isVideoAsset(asset) ? <VideoIcon className="h-5 w-5 text-[#4a5568]" /> : <ImageIcon className="h-5 w-5 text-[#4a5568]" />}
      <span className="text-[10px] text-[#4a5568]">{asset.ingestStatus === "READY" ? t("workspace.transcoding") : t("workspace.previewUnavailable")}</span>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "—";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-[#5a6b82]">{label}</span>
      <span className="font-mono text-[10px] text-[#93a2bb]">{display}</span>
    </div>
  );
}
