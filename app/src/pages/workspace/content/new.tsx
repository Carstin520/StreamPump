import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  CheckCircleIcon,
  CloseIcon,
  ImageIcon,
  MixedMediaIcon,
  UploadIcon,
  VideoIcon,
} from "@/components/shared/AppIcons";
import { StepProgress, StepItem } from "@/components/workspace/StepProgress";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ContentType } from "@/lib/api/types";
import {
  completeManifestAssetUpload,
  createContentManifest,
  finalizeContentManifest,
  ManifestAssetKind,
  presignManifestAssets,
} from "@/lib/api/workspace";
import { WORKSPACE_PATH } from "@/lib/routes";
import {
  buildLoginHrefFromRouter,
  clearAuthSession,
  getAccessToken,
  getAuthSession,
  isAuthError,
} from "@/lib/session-flow";

type FlowStep = "details" | "media" | "checks" | "publish" | "sponsorship";

const FLOW_STEPS: { id: FlowStep; label: string }[] = [
  { id: "details", label: "详情" },
  { id: "media", label: "素材" },
  { id: "checks", label: "检查" },
  { id: "publish", label: "发布" },
  { id: "sponsorship", label: "赞助" },
];

const STEP_INDEX: Record<FlowStep, number> = { details: 0, media: 1, checks: 2, publish: 3, sponsorship: 4 };

const TYPE_OPTIONS: { type: ContentType; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "IMAGE_CAROUSEL", label: "图文笔记", desc: "产品体验、穿搭、美食推荐", icon: ImageIcon },
  { type: "SHORT_VIDEO", label: "短视频", desc: "Vlog、教程、开箱、剪辑", icon: VideoIcon },
  { type: "MIXED_MEDIA_NOTE", label: "混合媒体", desc: "图文 + 视频的组合表达", icon: MixedMediaIcon },
];

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SHORT_VIDEO: "短视频",
  IMAGE_CAROUSEL: "图文笔记",
  MIXED_MEDIA_NOTE: "混合媒体",
};

const ACCEPTED_UPLOAD_TYPES = ".mp4,.mov,.jpg,.jpeg,.png,.webp,.heic,video/mp4,video/quicktime,image/jpeg,image/png,image/webp,image/heic";
const ACCEPTED_UPLOAD_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const parseTags = (value: string) =>
  value.split(",").map((e) => e.trim()).filter(Boolean);

const sha256Hex = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const resolveAssetType = (file: File): ManifestAssetKind =>
  file.type.toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";

const uploadToPresignedUrl = async (url: string, file: Blob, contentType?: string) => {
  const response = await fetch(url, {
    method: "PUT",
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}`);
  }

  return response;
};

const normalizeEtag = (value: string | null) =>
  value?.trim().replace(/^"+|"+$/g, "") || null;

export default function NewContentPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ready" | "auth">("checking");
  const [step, setStep] = useState<FlowStep>("details");
  const [contentType, setContentType] = useState<ContentType>("SHORT_VIDEO");
  const [title, setTitle] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const loginHref = buildLoginHrefFromRouter(router, WORKSPACE_PATH);
  const parsedTags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const previewFile = selectedFiles[0] ?? null;
  const previewImageUrl = useMemo(() => {
    if (!previewFile?.type.startsWith("image/")) return null;
    return URL.createObjectURL(previewFile);
  }, [previewFile]);

  useEffect(() => {
    setAuthState(getAuthSession() ? "ready" : "auth");
  }, []);

  useEffect(() => {
    return () => {
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    };
  }, [previewImageUrl]);

  const stepItems: StepItem[] = FLOW_STEPS.map((s, i) => ({
    label: s.label,
    status: STEP_INDEX[step] > i ? "done" : STEP_INDEX[step] === i ? "current" : "pending",
  }));

  const canNext = () => {
    if (step === "details") return !!contentType && !!title.trim();
    if (step === "media") return true;
    if (step === "checks") return true;
    if (step === "publish") return true;
    return false;
  };

  const goNext = () => {
    const idx = STEP_INDEX[step];
    if (idx < FLOW_STEPS.length - 1) setStep(FLOW_STEPS[idx + 1].id);
  };

  const goBack = () => {
    const idx = STEP_INDEX[step];
    if (idx > 0) setStep(FLOW_STEPS[idx - 1].id);
  };

  const handleCreate = async () => {
    const token = getAccessToken();
    if (!token) {
      setAuthState("auth");
      setMessage("请先登录");
      return;
    }

    const invalidFile = selectedFiles.find((file) => !ACCEPTED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase()));
    if (invalidFile) {
      setMessage(`不支持的文件格式: ${invalidFile.name}`);
      return;
    }

    setBusy(true);
    setSaveStatus("saving");
    setMessage(null);

    try {
      const manifest = await createContentManifest(token, {
        contentType,
        title,
        captionText,
        tags: parseTags(tagsInput),
      });

      if (selectedFiles.length > 0) {
        setMessage("草稿已创建，正在上传素材...");
        const assetInputs = await Promise.all(
          selectedFiles.map(async (file, index) => ({
            assetType: resolveAssetType(file),
            orderIndex: index,
            sha256Hex: await sha256Hex(file),
            mimeType: file.type.toLowerCase(),
            fileSizeBytes: String(file.size),
          }))
        );
        const presigned = await presignManifestAssets(token, manifest.manifestId, assetInputs);

        for (const [index, upload] of presigned.uploads.entries()) {
          const file = selectedFiles[index];
          setMessage(`正在上传 ${file.name} (${index + 1}/${selectedFiles.length})`);

          if (upload.uploadStrategy === "MULTIPART") {
            const completedParts = [];

            for (const part of upload.parts) {
              const start = (part.partNumber - 1) * upload.partSizeBytes;
              const chunk = file.slice(start, Math.min(start + upload.partSizeBytes, file.size));
              const response = await uploadToPresignedUrl(part.presignedUrl, chunk);
              const etag = normalizeEtag(response.headers.get("etag"));

              if (!etag) {
                throw new Error(`Missing ETag for ${file.name} part ${part.partNumber}`);
              }

              completedParts.push({ partNumber: part.partNumber, etag });
            }

            await completeManifestAssetUpload(token, manifest.manifestId, upload.assetId, {
              multipartUploadId: upload.multipartUploadId,
              parts: completedParts,
            });
          } else {
            await uploadToPresignedUrl(upload.presignedUrl, file, file.type);
            await completeManifestAssetUpload(token, manifest.manifestId, upload.assetId);
          }
        }

        setMessage("素材上传完成，正在完善内容...");
        await finalizeContentManifest(token, manifest.manifestId);
      }

      setSaveStatus("saved");
      void router.push(`/workspace/content/${manifest.manifestId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "创建失败";
      if (isAuthError(error)) {
        clearAuthSession();
        setAuthState("auth");
      }
      setMessage(msg);
      setSaveStatus("idle");
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (authState === "checking") {
    return (
      <>
        <Head><title>StreamPump | 新建内容</title></Head>
        <WorkspaceShell>
          <div className="liquid-card card-radius flex items-center gap-3 px-6 py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
            <p className="text-sm text-[#8ea0ba]">加载中...</p>
          </div>
        </WorkspaceShell>
      </>
    );
  }

  if (authState === "auth") {
    return (
      <>
        <Head><title>StreamPump | 新建内容</title></Head>
        <WorkspaceShell>
          <div className="liquid-card card-radius px-6 py-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#7486a1]">需要登录</p>
            <h2 className="mt-2 text-lg font-semibold text-white">登录后创建内容</h2>
            <a className="glass-button-primary mt-4 inline-flex px-5 py-2.5 text-sm font-semibold" href={loginHref}>
              登录
            </a>
          </div>
        </WorkspaceShell>
      </>
    );
  }

  const previewPanel = (
    <aside className="space-y-4">
      <div className="liquid-card card-radius overflow-hidden">
        {/* Cover preview */}
        <div className="relative flex aspect-video items-center justify-center bg-[linear-gradient(135deg,#121826_0%,#1a2438_100%)]">
          {previewImageUrl ? (
            <img alt="Preview" className="h-full w-full object-cover" src={previewImageUrl} />
          ) : (
            <span className="text-3xl opacity-20">
              {contentType === "SHORT_VIDEO" ? <VideoIcon className="h-10 w-10" /> : contentType === "MIXED_MEDIA_NOTE" ? <MixedMediaIcon className="h-10 w-10" /> : <ImageIcon className="h-10 w-10" />}
            </span>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(8,17,28,0.6)_100%)]" />
          <span className="absolute right-2 top-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] text-[#93a2bb]">
            {CONTENT_TYPE_LABELS[contentType]}
          </span>
        </div>
        <div className="p-4">
          <p className="text-sm font-medium text-white">{title || "未命名内容"}</p>
          <p className="mt-1 line-clamp-2 text-xs text-[#6b7d96]">{captionText || "暂无描述"}</p>
          {parsedTags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {parsedTags.slice(0, 5).map((tag) => (
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] text-[#7486a1]" key={tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status summary */}
      <div className="liquid-card card-radius p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">内容检查</p>
        <div className="mt-3 space-y-2">
          <CheckRow label="标题" ok={!!title.trim()} />
          <CheckRow label="内容类型" ok={!!contentType} />
          <CheckRow label="正文" ok={!!captionText.trim()} />
          <CheckRow label="素材文件" ok={selectedFiles.length > 0} />
          <CheckRow label="标签" ok={parsedTags.length > 0} />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <Head><title>StreamPump | 新建内容</title></Head>
      <WorkspaceShell aside={previewPanel}>
        {/* Top bar with save status */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">新建内容</h2>
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-[#8ea0ba]">
                <span className="h-3 w-3 animate-spin rounded-full border border-[#8ea0ba] border-t-transparent" />
                保存中...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-xs text-[#65ecaf]">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                已保存
              </span>
            )}
          </div>
        </div>

        {/* Step progress */}
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <StepProgress steps={stepItems} />
        </div>

        {/* Step content */}
        <div className="mt-6">
          {step === "details" && (
            <div className="section-enter space-y-5">
              {/* Content type selector */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">内容类型</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = contentType === opt.type;
                    return (
                      <button
                        className={`card-radius flex items-start gap-3 border p-4 text-left transition ${
                          selected
                            ? "border-[#de402a]/40 bg-[#de402a]/8 shadow-[0_0_20px_rgba(222,64,42,0.08)]"
                            : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]"
                        }`}
                        key={opt.type}
                        onClick={() => setContentType(opt.type)}
                        type="button"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-[#de402a]/20 text-[#ff8a78]" : "bg-white/[0.06] text-[#6b7d96]"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{opt.label}</p>
                          <p className="mt-0.5 text-xs text-[#6b7d96]">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Caption */}
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">标题</span>
                <input
                  className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#3a4556]"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="给内容起个标题..."
                  value={title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">正文</span>
                <textarea
                  className="input-glass min-h-[140px] w-full resize-none rounded-3xl px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-[#3a4556]"
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="分享你的创作故事..."
                  value={captionText}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">标签</span>
                <input
                  className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#3a4556]"
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="用逗号分隔，如: 美食, 城市, 深夜"
                  value={tagsInput}
                />
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {parsedTags.map((tag) => (
                      <span className="liquid-pill rounded-full px-2.5 py-1 text-[11px] text-[#dce6f8]" key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
              </label>
            </div>
          )}

          {step === "media" && (
            <div className="section-enter space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">上传素材</p>

              {/* Upload zone */}
              <label className="block cursor-pointer">
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] p-8 transition hover:border-[#de402a]/30 hover:bg-[#de402a]/[0.03]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]">
                    <UploadIcon className="h-6 w-6 text-[#6b7d96]" />
                  </div>
                  <p className="text-sm text-[#8ea0ba]">拖拽文件或点击上传</p>
                  <p className="text-[11px] text-[#4a5568]">支持 JPG, PNG, WebP, MP4, MOV</p>
                </div>
                <input
                  accept={ACCEPTED_UPLOAD_TYPES}
                  className="hidden"
                  multiple
                  onChange={handleFileSelection}
                  type="file"
                />
              </label>

              {/* File queue */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                      key={`${file.name}-${file.size}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                        {file.type.startsWith("video/") ? (
                          <VideoIcon className="h-4 w-4 text-[#67b8ff]" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-[#65ecaf]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{file.name}</p>
                        <p className="text-[11px] text-[#5a6b82]">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <span className="rounded-full bg-[#65ecaf]/12 px-2 py-0.5 text-[9px] font-semibold text-[#65ecaf]">待上传</span>
                      <button className="text-[#5a6b82] hover:text-white" onClick={() => removeFile(index)} type="button">
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[#4a5568]">文件将在创建草稿后通过预签名 URL 上传到服务器。</p>
            </div>
          )}

          {step === "checks" && (
            <div className="section-enter space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">内容检查</p>
              <div className="space-y-3">
                <CheckCard label="内容完整性" desc="标题、正文、标签均已填写" ok={!!title.trim() && !!captionText.trim()} />
                <CheckCard label="素材准备" desc={selectedFiles.length > 0 ? `${selectedFiles.length} 个文件待上传` : "未选择素材"} ok={selectedFiles.length > 0} />
                <CheckCard label="格式检查" desc="文件格式和大小符合要求" ok={selectedFiles.every((f) => f.size < 500 * 1024 * 1024)} />
                <CheckCard label="Feed 可见性" desc="发布后内容将出现在公共 Feed" ok />
              </div>
            </div>
          )}

          {step === "publish" && (
            <div className="section-enter space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">发布设置</p>
              <div className="space-y-3">
                <VisibilityOption label="公开" desc="所有用户可见" active />
                <VisibilityOption label="仅粉丝" desc="只有关注你的人可见" />
                <VisibilityOption label="私密" desc="仅自己可见" />
              </div>
            </div>
          )}

          {step === "sponsorship" && (
            <div className="section-enter space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">赞助合作（可选）</p>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
                <p className="text-sm text-[#8ea0ba]">
                  创建草稿后，你可以在内容详情页面配置赞助合作条款并发起 proposal。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3.5">
          <div className="text-xs text-[#5a6b82]">
            {selectedFiles.length > 0 && `${selectedFiles.length} 个文件已选择`}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="glass-button-ghost px-4 py-2 text-xs disabled:opacity-30"
              disabled={step === "details" || busy}
              onClick={goBack}
              type="button"
            >
              上一步
            </button>

            {step !== "sponsorship" ? (
              <button
                className="glass-button-primary px-5 py-2 text-xs font-semibold disabled:opacity-40"
                disabled={!canNext() || busy}
                onClick={goNext}
                type="button"
              >
                下一步
              </button>
            ) : (
              <button
                className="glass-button-primary flex items-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-40"
                disabled={busy || !title.trim()}
                onClick={() => void handleCreate()}
                type="button"
              >
                {busy ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                ) : (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                )}
                创建草稿
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className="mt-3 rounded-2xl border border-[#f67263]/20 bg-[#f67263]/[0.06] px-4 py-3 text-sm text-[#f67263]">
            {message}
          </div>
        )}
      </WorkspaceShell>
    </>
  );
}

const CheckRow = ({ label, ok }: { label: string; ok: boolean }) => (
  <div className="flex items-center gap-2">
    <div className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#65ecaf]" : "bg-[#3a4556]"}`} />
    <span className={`text-xs ${ok ? "text-[#93a2bb]" : "text-[#4a5568]"}`}>{label}</span>
  </div>
);

const CheckCard = ({ label, desc, ok }: { label: string; desc: string; ok: boolean }) => (
  <div className={`flex items-center gap-3 rounded-2xl border p-4 ${ok ? "border-[#65ecaf]/20 bg-[#65ecaf]/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ok ? "bg-[#65ecaf]/15 text-[#65ecaf]" : "bg-white/[0.06] text-[#4a5568]"}`}>
      <CheckCircleIcon className="h-4 w-4" />
    </div>
    <div>
      <p className={`text-sm font-medium ${ok ? "text-white" : "text-[#6b7d96]"}`}>{label}</p>
      <p className="text-[11px] text-[#5a6b82]">{desc}</p>
    </div>
  </div>
);

const VisibilityOption = ({ label, desc, active = false }: { label: string; desc: string; active?: boolean }) => (
  <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
    active ? "border-[#de402a]/30 bg-[#de402a]/8" : "border-white/[0.06] bg-white/[0.02]"
  }`}>
    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
      active ? "border-[#de402a] bg-[#de402a]" : "border-white/20 bg-transparent"
    }`}>
      {active && <CheckCircleIcon className="h-3 w-3 text-white" />}
    </div>
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-[11px] text-[#5a6b82]">{desc}</p>
    </div>
  </div>
);
