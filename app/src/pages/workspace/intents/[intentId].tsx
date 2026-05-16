import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import {
  CheckCircleIcon,
  CopyIcon,
  EarningsIcon,
  ShieldCheckIcon,
  SignatureIcon,
  WarningIcon,
} from "@/components/shared/AppIcons";
import { DemoActionStatusCard } from "@/components/shared/DemoActionStatusCard";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { StatusDot } from "@/components/workspace/StatusDot";
import { StepProgress, StepItem } from "@/components/workspace/StepProgress";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useDemoActionFlow } from "@/hooks/useDemoActionFlow";
import { ProposalIntentStatus } from "@/lib/api/types";
import {
  buildProposalLaunchBundle,
  BundleSubmitMode,
  creatorPartialSignBundle,
  getProposalIntentById,
  getProposalIntentStatus,
  lockProposalIntent,
  ProposalIntentDetailResponse,
  submitProposalBundle,
} from "@/lib/api/workspace";
import { formatIsoLabel, formatUsdcAtomic, shortenWallet } from "@/lib/formatting";
import { DEMO_S2_ENDORSE_PATH, WORKSPACE_PATH, WORKSPACE_SPONSORSHIPS_PATH } from "@/lib/routes";
import { signVersionedTransactionBase64 } from "@/lib/solana/signVersionedTransaction";
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
  | { kind: "ready"; data: ProposalIntentDetailResponse };

const STATUS_LABELS: Record<ProposalIntentStatus, string> = {
  DRAFT: "草案阶段",
  TERMS_LOCKED: "条款已锁定",
  BUNDLE_BUILT: "交易已构建",
  CREATOR_PARTIALLY_SIGNED: "等待赞助商签名",
  SPONSOR_SIGNED: "赞助商已签名",
  SUBMITTED: "已提交",
  CONFIRMED: "链上已确认",
  FAILED: "失败",
  EXPIRED: "已过期",
};

const canBuildFromStatus = (status: ProposalIntentStatus) =>
  ["TERMS_LOCKED", "BUNDLE_BUILT", "CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "FAILED", "EXPIRED"].includes(status);

const demoIntentSteps: StepItem[] = [
  { label: "条款", status: "done" },
  { label: "构建", status: "done" },
  { label: "创作者签", status: "current" },
  { label: "赞助商签", status: "pending" },
  { label: "提交", status: "pending" },
  { label: "确认", status: "pending" },
];

function deriveIntentSteps(status: ProposalIntentStatus): StepItem[] {
  const order: ProposalIntentStatus[] = ["DRAFT", "TERMS_LOCKED", "BUNDLE_BUILT", "CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"];
  const labels = ["条款", "构建", "创作者签", "赞助商签", "提交", "确认"];
  const statusIdx = order.indexOf(status);
  const failed = status === "FAILED" || status === "EXPIRED";

  return labels.map((label, i) => {
    const stepIdx = i + 1;
    if (failed && stepIdx >= statusIdx) return { label, status: "blocked" as const };
    if (stepIdx < statusIdx) return { label, status: "done" as const };
    if (stepIdx === statusIdx) return { label, status: "current" as const };
    return { label, status: "pending" as const };
  });
}

function MockIntentSigningStep() {
  const demoFlow = useDemoActionFlow();

  return (
    <>
      <Head><title>StreamPump | Mock Signing Step</title></Head>
      <WorkspaceShell>
        <div className="space-y-5">
          <ProductReadinessBanner
            description="This demo intent route only previews creator signature UI state. It does not call wallet signing, proposal intent APIs, transaction bundle builders, or Solana relay paths."
            status="MOCK_PREVIEW"
            title="Demo intent signing is local-only"
          />

          <div className="liquid-card card-radius p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7486a1]">
                  Demo signing step
                </p>
                <h1 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                  Game trailer moodboard × Nova Screen
                </h1>
                <p className="mt-1 max-w-[620px] text-sm text-[#8ea0ba]">
                  Local mock flow for the S2 creator signature. No wallet signature or transaction API is called.
                </p>
              </div>
              <Link
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-medium text-[#cbd6e7] transition hover:text-white"
                href={WORKSPACE_SPONSORSHIPS_PATH}
              >
                Back to desk
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">合作进程</p>
              <span className="text-xs text-white">等待创作者签名</span>
            </div>
            <StepProgress steps={demoIntentSteps} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <section className="liquid-glass-shell card-radius p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#de402a]/15">
                  <SignatureIcon className="h-5 w-5 text-[#ff8a78]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Mock creator signature</p>
                  <p className="text-xs text-[#6b7d96]">Preview the signature confirmation state for the demo.</p>
                </div>
              </div>

              <button
                className="glass-button-primary mt-5 flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={demoFlow.busy || demoFlow.state.status === "success"}
                onClick={demoFlow.begin}
                type="button"
              >
                {demoFlow.busy ? "Submitting..." : demoFlow.state.status === "success" ? "Signed" : "Confirm creator signature"}
              </button>
              <DemoActionStatusCard
                amountLabel="intent-neo-pulsefit"
                confirmLabel="Confirm Signature"
                description="Confirm this local signature step. It only updates the page state for the demo."
                onCancel={demoFlow.reset}
                onConfirm={(options) => demoFlow.submit(options)}
                onRetry={demoFlow.retry}
                state={demoFlow.state}
                successLabel="Signed"
                title="Signature confirmation"
              />
            </section>

            <aside className="space-y-3">
              <div className="liquid-card card-radius p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">Track budgets</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-[#8ea0ba]">Track 1</span><span className="text-white">$1,800</span></div>
                  <div className="flex justify-between"><span className="text-[#8ea0ba]">Track 2</span><span className="text-white">$3,600</span></div>
                  <div className="flex justify-between"><span className="text-[#8ea0ba]">Track 3</span><span className="text-white">$5,200</span></div>
                </div>
              </div>
              {demoFlow.state.status === "success" ? (
                <Link className="glass-button-primary flex justify-center rounded-full px-4 py-3 text-sm font-semibold text-white" href={DEMO_S2_ENDORSE_PATH}>
                  Continue to endorse
                </Link>
              ) : null}
            </aside>
          </div>
        </div>
      </WorkspaceShell>
    </>
  );
}

export default function IntentDetailPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [busyAction, setBusyAction] = useState<"refresh" | "lock" | "build" | "creator-sign" | "submit" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<BundleSubmitMode>("SERVER_RELAY");
  const [forceRebuild, setForceRebuild] = useState(false);
  const [creatorSignedBase64, setCreatorSignedBase64] = useState("");
  const [fullySignedBase64, setFullySignedBase64] = useState("");
  const wallet = useWallet();
  const loginHref = buildLoginHrefFromRouter(router, WORKSPACE_PATH);
  const intentId = String(router.query.intentId ?? "").trim();
  const isDemoMode = router.isReady && router.query.demo === "1" && intentId === "intent-neo-pulsefit";

  const refreshIntent = async (token: string, id: string) => {
    const data = await getProposalIntentById(token, id);
    setState({ kind: "ready", data });
  };
  const handleAuthFailure = () => { clearAuthSession(); setState({ kind: "auth" }); };
  const handleApiError = (error: unknown, fallback: string) => {
    if (isAuthError(error)) { handleAuthFailure(); return; }
    setActionMessage(error instanceof Error ? error.message : fallback);
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;
    let cancelled = false;
    const token = getAccessToken();
    const id = String(router.query.intentId ?? "").trim();
    if (!token) { setState({ kind: "auth" }); return; }
    if (!id) { setState({ kind: "error", message: "intentId required" }); return; }
    setState({ kind: "loading" });
    void getProposalIntentById(token, id)
      .then((data) => { if (!cancelled) setState({ kind: "ready", data }); })
      .catch((error) => {
        if (cancelled) return;
        if (isAuthError(error)) { handleAuthFailure(); return; }
        setState({ kind: "error", message: error instanceof Error ? error.message : "加载失败" });
      });
    return () => { cancelled = true; };
  }, [isDemoMode, router.isReady, router.query.intentId]);

  const latestBundle = state.kind === "ready" ? state.data.bundles[0] ?? null : null;
  const connectedWallet = wallet.publicKey?.toBase58() ?? null;

  const requireRoleWallet = (expected: string) => {
    if (!wallet.connected || !connectedWallet) { setActionMessage("请先连接钱包"); return false; }
    if (connectedWallet !== expected) { setActionMessage(`当前钱包 ${shortenWallet(connectedWallet)} 与所需钱包 ${shortenWallet(expected)} 不匹配`); return false; }
    return true;
  };

  const handleRefresh = async () => {
    const token = getAccessToken();
    if (!token || !intentId) { handleAuthFailure(); return; }
    setBusyAction("refresh");
    try {
      await getProposalIntentStatus(token, intentId);
      await refreshIntent(token, intentId);
      setActionMessage("状态已刷新");
    } catch (e) { handleApiError(e, "刷新失败"); }
    finally { setBusyAction(null); }
  };

  const handleLock = async () => {
    const token = getAccessToken();
    if (!token || !intentId) { handleAuthFailure(); return; }
    setBusyAction("lock");
    try {
      await lockProposalIntent(token, intentId);
      await refreshIntent(token, intentId);
      setActionMessage("条款已锁定");
    } catch (e) { handleApiError(e, "锁定失败"); }
    finally { setBusyAction(null); }
  };

  const handleBuildBundle = async () => {
    const token = getAccessToken();
    if (!token || !intentId) { handleAuthFailure(); return; }
    setBusyAction("build");
    try {
      const r = await buildProposalLaunchBundle(token, intentId, { submitMode, forceRebuild });
      await refreshIntent(token, intentId);
      setActionMessage(r.reused ? "复用现有交易包" : "交易包已构建");
    } catch (e) { handleApiError(e, "构建失败"); }
    finally { setBusyAction(null); }
  };

  const handleWalletCreatorPartialSign = async () => {
    const token = getAccessToken();
    const intent = state.kind === "ready" ? state.data.intent : null;
    if (!token || !intent || !intentId) { handleAuthFailure(); return; }
    if (!latestBundle?.bundleId || !latestBundle.versionedTxBase64) { setActionMessage("请先构建交易包"); return; }
    if (!requireRoleWallet(intent.creatorWallet)) return;
    setBusyAction("creator-sign");
    try {
      setActionMessage("正在请求钱包签名...");
      const signed = await signVersionedTransactionBase64(wallet, latestBundle.versionedTxBase64);
      await creatorPartialSignBundle(token, intentId, { bundleId: latestBundle.bundleId, partiallySignedTxBase64: signed });
      await refreshIntent(token, intentId);
      setActionMessage("创作者签名已提交");
    } catch (e) { handleApiError(e, "签名失败"); }
    finally { setBusyAction(null); }
  };

  const handleCreatorPartialSign = async () => {
    const token = getAccessToken();
    if (!token || !intentId || !latestBundle?.bundleId || !creatorSignedBase64.trim()) { setActionMessage("请粘贴签名数据"); return; }
    setBusyAction("creator-sign");
    try {
      await creatorPartialSignBundle(token, intentId, { bundleId: latestBundle.bundleId, partiallySignedTxBase64: creatorSignedBase64.trim() });
      await refreshIntent(token, intentId);
      setActionMessage("创作者签名已提交");
    } catch (e) { handleApiError(e, "签名失败"); }
    finally { setBusyAction(null); }
  };

  const handleWalletSponsorSubmit = async () => {
    const token = getAccessToken();
    const intent = state.kind === "ready" ? state.data.intent : null;
    if (!token || !intent || !intentId) { handleAuthFailure(); return; }
    if (!latestBundle?.bundleId || !latestBundle.partiallySignedTxBase64) { setActionMessage("需要创作者签名"); return; }
    if (!intent.sponsorWallet || !requireRoleWallet(intent.sponsorWallet)) return;
    setBusyAction("submit");
    try {
      setActionMessage("正在请求赞助商签名...");
      const signed = await signVersionedTransactionBase64(wallet, latestBundle.partiallySignedTxBase64);
      const r = await submitProposalBundle(token, intentId, { bundleId: latestBundle.bundleId, fullySignedTxBase64: signed });
      await refreshIntent(token, intentId);
      setActionMessage(`提交结果: ${r.relayStatus}${r.chainTxSignature ? ` · ${r.chainTxSignature.slice(0, 12)}...` : ""}`);
    } catch (e) { handleApiError(e, "提交失败"); }
    finally { setBusyAction(null); }
  };

  const handleSubmitBundle = async () => {
    const token = getAccessToken();
    if (!token || !intentId || !latestBundle?.bundleId || !fullySignedBase64.trim()) { setActionMessage("请粘贴签名数据"); return; }
    setBusyAction("submit");
    try {
      const r = await submitProposalBundle(token, intentId, { bundleId: latestBundle.bundleId, fullySignedTxBase64: fullySignedBase64.trim() });
      await refreshIntent(token, intentId);
      setActionMessage(`提交结果: ${r.relayStatus}`);
    } catch (e) { handleApiError(e, "提交失败"); }
    finally { setBusyAction(null); }
  };

  if (isDemoMode) {
    return <MockIntentSigningStep />;
  }

  if (state.kind !== "ready") {
    return (
      <>
        <Head><title>StreamPump | 赞助合作详情</title></Head>
        <WorkspaceShell>
          {state.kind === "loading" && (
            <div className="liquid-card card-radius flex items-center gap-3 px-6 py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
              <p className="text-sm text-[#8ea0ba]">加载合作详情...</p>
            </div>
          )}
          {state.kind === "auth" && (
            <div className="liquid-card card-radius px-6 py-8">
              <p className="text-lg font-semibold text-white">登录后查看</p>
              <a className="glass-button-primary mt-4 inline-flex px-5 py-2.5 text-sm font-semibold" href={loginHref}>登录</a>
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
  const intent = d.intent;
  const steps = deriveIntentSteps(intent.status);
  const isCreator = d.viewerRole === "CREATOR";
  const isSponsor = d.viewerRole === "SPONSOR";
  const walletMismatch = connectedWallet && (
    (isCreator && connectedWallet !== intent.creatorWallet) ||
    (isSponsor && connectedWallet !== intent.sponsorWallet)
  );
  const requiredWallet = isCreator ? intent.creatorWallet : intent.sponsorWallet;

  const previewPanel = (
    <aside className="space-y-4">
      {/* Content preview */}
      {d.manifest && (
        <div className="liquid-card card-radius p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">关联内容</p>
          <p className="mt-2 text-sm font-medium text-white">{d.manifest.title ?? "未命名"}</p>
          <p className="mt-1 text-[11px] text-[#6b7d96]">{d.manifest.status} · {d.manifest.assets.length} 素材</p>
        </div>
      )}

      {/* On-chain summary */}
      <div className="liquid-card card-radius p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">链上信息</p>
        <div className="mt-3 space-y-2">
          <HashRow label="Manifest Hash" value={d.manifest?.manifestHashHex} />
          <HashRow label="Anchor PDA" value={d.manifest?.currentAnchorPda} />
          {d.proposal && <HashRow label="Proposal PDA" value={d.proposal.proposalPda} />}
          {latestBundle?.chainTxSignature && <HashRow label="Tx Signature" value={latestBundle.chainTxSignature} />}
        </div>
      </div>

      {/* Bundle info */}
      {d.bundles.length > 0 && (
        <div className="liquid-card card-radius p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">交易包</p>
          {d.bundles.slice(0, 2).map((b) => (
            <div className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2" key={b.bundleId}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white">{b.status}</span>
                <span className="text-[9px] text-[#5a6b82]">{b.submitMode}</span>
              </div>
              <p className="mt-1 text-[10px] text-[#5a6b82]">过期: {formatIsoLabel(b.expiresAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Proposal link */}
      {d.proposal && (
        <Link className="block" href={`/campaigns/${d.proposal.id}`}>
          <div className="liquid-card card-radius flex items-center gap-3 p-4 transition hover:border-white/[0.12]">
            <CheckCircleIcon className="h-4 w-4 text-[#65ecaf]" />
            <div>
              <p className="text-xs font-medium text-white">查看 Campaign</p>
              <p className="text-[10px] text-[#5a6b82]">{d.proposal.status} · {formatIsoLabel(d.proposal.deadlineAt)}</p>
            </div>
          </div>
        </Link>
      )}
    </aside>
  );

  return (
    <>
      <Head><title>{`StreamPump | ${d.manifest?.title ?? "赞助合作"}`}</title></Head>
      <WorkspaceShell aside={previewPanel}>
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{d.manifest?.title ?? "赞助合作详情"}</h2>
              <p className="mt-0.5 text-xs text-[#6b7d96]">
                {shortenWallet(intent.creatorWallet)} × {shortenWallet(intent.sponsorWallet)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-[#93a2bb]">
                {isCreator ? "创作者" : isSponsor ? "赞助商" : "观察者"}
              </span>
              <button
                className="glass-button-ghost px-3 py-1.5 text-[11px] disabled:opacity-40"
                disabled={busyAction !== null}
                onClick={() => void handleRefresh()}
                type="button"
              >
                {busyAction === "refresh" ? "刷新中..." : "刷新状态"}
              </button>
            </div>
          </div>
        </div>

        {/* Lifecycle progress */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">合作进程</p>
            <span className="text-xs text-white">{STATUS_LABELS[intent.status]}</span>
          </div>
          <StepProgress steps={steps} />
        </div>

        {/* Track budget cards */}
        <div className="grid grid-cols-3 gap-3">
          <TrackCard label="基础报酬" sublabel="Track 1" value={formatUsdcAtomic(intent.track1BaseUsdc)} />
          <TrackCard label="绩效预算" sublabel={`Track 2 · ${intent.track2MetricType}`} value={formatUsdcAtomic(intent.track2UsdcDeposited)} />
          <TrackCard label="延迟结算" sublabel="Track 3" value={formatUsdcAtomic(intent.track3UsdcDeposited)} />
        </div>

        {/* Wallet mismatch warning */}
        {walletMismatch && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#f3b33e]/25 bg-[#f3b33e]/[0.06] px-4 py-3">
            <WarningIcon className="h-5 w-5 shrink-0 text-[#f3b33e]" />
            <div>
              <p className="text-sm font-medium text-[#f3c66e]">钱包不匹配</p>
              <p className="text-xs text-[#8ea0ba]">
                当前: {shortenWallet(connectedWallet)} · 所需: {shortenWallet(requiredWallet)}
              </p>
            </div>
          </div>
        )}

        {/* Failure reason */}
        {intent.failureReason && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#f67263]/25 bg-[#f67263]/[0.06] px-4 py-3">
            <WarningIcon className="h-5 w-5 shrink-0 text-[#f67263]" />
            <p className="text-sm text-[#f67263]">{intent.failureReason}</p>
          </div>
        )}

        {/* Signature action card */}
        <div className="liquid-glass-shell card-radius p-5">
          {intent.status === "DRAFT" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                  <ShieldCheckIcon className="h-5 w-5 text-[#93a2bb]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">锁定合作条款</p>
                  <p className="text-xs text-[#6b7d96]">确认条款后将不可修改</p>
                </div>
              </div>
              <button
                className="glass-button-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-40"
                disabled={busyAction !== null}
                onClick={() => void handleLock()}
                type="button"
              >
                {busyAction === "lock" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                锁定条款
              </button>
            </div>
          )}

          {canBuildFromStatus(intent.status) && !latestBundle?.versionedTxBase64 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                  <EarningsIcon className="h-5 w-5 text-[#93a2bb]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">构建交易包</p>
                  <p className="text-xs text-[#6b7d96]">生成链上交易等待双方签名</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select className="input-glass rounded-xl px-3 py-2 text-xs text-white outline-none" onChange={(e) => setSubmitMode(e.target.value as BundleSubmitMode)} value={submitMode}>
                  <option value="SERVER_RELAY">服务器中继</option>
                  <option value="CLIENT_RELAY">客户端中继</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-[#8ea0ba]">
                  <input checked={forceRebuild} className="rounded" onChange={(e) => setForceRebuild(e.target.checked)} type="checkbox" />
                  强制重建
                </label>
              </div>
              <button
                className="glass-button-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-40"
                disabled={busyAction !== null}
                onClick={() => void handleBuildBundle()}
                type="button"
              >
                {busyAction === "build" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                构建交易包
              </button>
            </div>
          )}

          {isCreator && latestBundle?.versionedTxBase64 && intent.status !== "CONFIRMED" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#de402a]/15">
                  <SignatureIcon className="h-5 w-5 text-[#ff8a78]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">请求创作者签名</p>
                  <p className="text-xs text-[#6b7d96]">使用创作者钱包签名交易</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <WalletMultiButton />
                <button
                  className="glass-button-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                  disabled={busyAction !== null || !latestBundle.versionedTxBase64}
                  onClick={() => void handleWalletCreatorPartialSign()}
                  type="button"
                >
                  {busyAction === "creator-sign" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  <SignatureIcon className="h-4 w-4" />
                  创作者签名
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                <StatusDot tone={connectedWallet === intent.creatorWallet ? "success" : "warning"} size="xs" />
                <span className="text-[#6b7d96]">
                  当前: {connectedWallet ? shortenWallet(connectedWallet) : "未连接"} · 需要: {shortenWallet(intent.creatorWallet)}
                </span>
              </div>
            </div>
          )}

          {isSponsor && latestBundle?.partiallySignedTxBase64 && intent.status !== "CONFIRMED" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#de402a]/15">
                  <SignatureIcon className="h-5 w-5 text-[#ff8a78]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">赞助商签名并提交</p>
                  <p className="text-xs text-[#6b7d96]">签名后交易将被提交到 Solana</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <WalletMultiButton />
                <button
                  className="glass-button-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                  disabled={busyAction !== null}
                  onClick={() => void handleWalletSponsorSubmit()}
                  type="button"
                >
                  {busyAction === "submit" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  <SignatureIcon className="h-4 w-4" />
                  签名并提交
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                <StatusDot tone={connectedWallet === intent.sponsorWallet ? "success" : "warning"} size="xs" />
                <span className="text-[#6b7d96]">
                  当前: {connectedWallet ? shortenWallet(connectedWallet) : "未连接"} · 需要: {shortenWallet(intent.sponsorWallet)}
                </span>
              </div>
            </div>
          )}

          {intent.status === "CONFIRMED" && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#65ecaf]/15">
                <CheckCircleIcon className="h-5 w-5 text-[#65ecaf]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#65ecaf]">链上已确认</p>
                <p className="text-xs text-[#6b7d96]">赞助合作已成功上链</p>
              </div>
            </div>
          )}
        </div>

        {/* Advanced / Debug section -- collapsed by default */}
        <details className="rounded-2xl border border-white/[0.06]">
          <summary className="cursor-pointer px-4 py-3 text-[11px] font-medium text-[#5a6b82] hover:text-[#8ea0ba]">
            Advanced / Developer Fallback
          </summary>
          <div className="space-y-4 border-t border-white/[0.06] p-4">
            {isCreator && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#5a6b82]">粘贴 partiallySignedTxBase64</p>
                <textarea
                  className="input-glass min-h-[100px] w-full rounded-2xl px-3 py-2 text-xs text-white outline-none"
                  onChange={(e) => setCreatorSignedBase64(e.target.value)}
                  placeholder="base64 data..."
                  value={creatorSignedBase64}
                />
                <button
                  className="glass-button-ghost px-3 py-1.5 text-[11px] disabled:opacity-40"
                  disabled={busyAction !== null || !latestBundle}
                  onClick={() => void handleCreatorPartialSign()}
                  type="button"
                >
                  提交粘贴的创作者签名
                </button>
              </div>
            )}
            {isSponsor && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#5a6b82]">粘贴 fullySignedTxBase64</p>
                <textarea
                  className="input-glass min-h-[100px] w-full rounded-2xl px-3 py-2 text-xs text-white outline-none"
                  onChange={(e) => setFullySignedBase64(e.target.value)}
                  placeholder="base64 data..."
                  value={fullySignedBase64}
                />
                <button
                  className="glass-button-ghost px-3 py-1.5 text-[11px] disabled:opacity-40"
                  disabled={busyAction !== null || !latestBundle}
                  onClick={() => void handleSubmitBundle()}
                  type="button"
                >
                  提交粘贴的完整签名
                </button>
              </div>
            )}
          </div>
        </details>

        {actionMessage && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-[#8ea0ba]">
            {actionMessage}
          </div>
        )}
      </WorkspaceShell>
    </>
  );
}

(IntentDetailPage as typeof IntentDetailPage & { requiresWalletProviders?: boolean }).requiresWalletProviders = true;

function TrackCard({ label, sublabel, value }: { label: string; sublabel: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#5a6b82]">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-[#4a5568]">{sublabel}</p>
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
