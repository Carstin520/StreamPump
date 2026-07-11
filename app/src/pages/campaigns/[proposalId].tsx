import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { Panel } from "@/components/shared/Panel";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import {
  getProposalById,
  getPublicCampaignProof,
  ProposalDetailResponse,
  PublicCampaignProofResponse,
} from "@/lib/api/workspace";
import { publicDemoEnabled } from "@/lib/feature-flags";
import { formatIsoLabel, formatUsdcAtomic, shortenWallet } from "@/lib/formatting";
import { useI18n } from "@/lib/i18n";
import { findCreatorStrict } from "@/lib/mocks/discover";
import { findMockProposalDetail } from "@/lib/mocks/workspace";
import {
  DEMO_S2_ENDORSE_PATH,
  DEMO_S2_SETTLEMENT_PATH,
} from "@/lib/routes";
import { getAccessToken, loadWithPublicFallback } from "@/lib/session-flow";

const localizeEnum = (
  t: (key: string) => string,
  prefix: string,
  value: string | null | undefined,
) => {
  if (!value) return value ?? "";
  const key = `${prefix}.${value}`;
  const resolved = t(key);
  return resolved === key ? value : resolved;
};

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      data: ProposalDetailResponse;
      proofStatus?: PublicCampaignProofResponse["proofStatus"];
      source: "live-campaign-proof" | "live-api" | "demo-fallback";
    };

const normalizeCampaignProof = (
  campaign: PublicCampaignProofResponse
): ProposalDetailResponse => ({
  viewerRole: "PUBLIC_FAN",
  proposal: {
    id: campaign.proposalId,
    proposalPda: campaign.proposalPda,
    creatorWallet: campaign.creatorWallet,
    sponsorWallet: campaign.sponsorWallet,
    deadlineAt: campaign.deadlineAt,
    status: campaign.status,
    track1BaseUsdc: campaign.budgetTracks.track1BaseUsdc,
    track1Claimed: campaign.budgetTracks.track1Claimed,
    track2MetricType: campaign.budgetTracks.track2MetricType,
    track2TargetValue: campaign.budgetTracks.track2TargetValue,
    track2MinAchievementBps: campaign.budgetTracks.track2MinAchievementBps,
    track2UsdcDeposited: campaign.budgetTracks.track2UsdcDeposited,
    track2ActualValue: campaign.budgetTracks.track2ActualValue,
    track2SettledAt: campaign.budgetTracks.track2SettledAt,
    track3UsdcDeposited: campaign.budgetTracks.track3UsdcDeposited,
    track3CpsPayout: campaign.budgetTracks.track3CpsPayout,
    track3DelayDays: campaign.budgetTracks.track3DelayDays,
    track3SettledAt: campaign.budgetTracks.track3SettledAt,
    onChainTxSignature: campaign.proof.latestChainTxSignature,
    oracleSyncStatus: campaign.proof.oracleSyncStatus ?? undefined,
    contentHashHex: campaign.proof.contentHashHex,
    contentAnchorPda: campaign.proof.contentAnchorPda,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  },
});

const resolveProposalRouteId = (
  queryValue: string | string[] | undefined,
  asPath: string
) => {
  const queryId = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (queryId?.trim()) {
    return queryId.trim();
  }

  const pathname = asPath.split("?")[0]?.split("#")[0] ?? "";
  const pathId = pathname.split("/").filter(Boolean).at(-1);
  return pathId ? decodeURIComponent(pathId).trim() : "";
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const demoEnabled = publicDemoEnabled();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const proposalId = resolveProposalRouteId(router.query.proposalId, router.asPath);
    const token = getAccessToken();

    if (!proposalId) {
      if (!router.isReady) {
        return;
      }
      setState({ kind: "error", message: "proposalId is required" });
      return;
    }

    setState({ kind: "loading" });

    // P0 truth gate: only auto-select a seeded fixture proposal when the public
    // demo flag is on. In production the route always resolves against the real
    // campaign-proof / proposal API and surfaces an honest error on failure.
    if (publicDemoEnabled()) {
      const mockProposal = findMockProposalDetail(proposalId);
      if (mockProposal) {
        setState({ kind: "ready", data: mockProposal, source: "demo-fallback" });
        return;
      }
    }

    const loadProposal = async () => {
      try {
        const campaignProof = await getPublicCampaignProof(proposalId);
        const data = normalizeCampaignProof(campaignProof);
        if (!cancelled) {
          setState({
            kind: "ready",
            data,
            proofStatus: campaignProof.proofStatus,
            source: "live-campaign-proof",
          });
        }
      } catch (campaignError) {
        try {
          const data = await loadWithPublicFallback({
            loadPublic: () => getProposalById(proposalId),
            loadWithToken: (accessToken) => getProposalById(proposalId, accessToken),
            token,
          });
          if (!cancelled) {
            setState({ kind: "ready", data, source: "live-api" });
          }
        } catch (proposalError) {
          const message =
            proposalError instanceof Error
              ? proposalError.message
              : campaignError instanceof Error
                ? campaignError.message
                : "Failed to load proposal.";
          if (!cancelled) {
            setState({ kind: "error", message });
          }
        }
      }
    };

    void loadProposal();

    return () => {
      cancelled = true;
    };
  }, [router.asPath, router.isReady, router.query.proposalId]);

  const pageTitle = state.kind === "ready" ? state.data.proposal.id : t("campaign.pageTitle");
  const isPublicView = state.kind === "ready" && state.data.viewerRole === "PUBLIC_FAN";
  const isDemoProposal = state.kind === "ready" && state.source === "demo-fallback";
  const isCampaignProof = state.kind === "ready" && state.source === "live-campaign-proof";
  const demoCreator = isDemoProposal ? findCreatorStrict("neo-park") : undefined;
  const demoCreatorName = locale === "en" ? "Midnight Save" : demoCreator?.name;
  const campaignHeading = demoCreator
    ? `${demoCreatorName} × Nova Screen`
    : state.kind === "ready" && isPublicView
      ? shortenWallet(state.data.proposal.creatorWallet)
      : state.kind === "ready"
        ? `${shortenWallet(state.data.proposal.creatorWallet)} × ${shortenWallet(state.data.proposal.sponsorWallet)}`
        : t("campaign.pageTitle");
  const settlementHref = isDemoProposal
    ? DEMO_S2_SETTLEMENT_PATH
    : state.kind === "ready"
      ? `/campaigns/${state.data.proposal.proposalPda || state.data.proposal.id}/settlement`
      : DEMO_S2_SETTLEMENT_PATH;

  return (
    <>
      <Head>
        <title>{`StreamPump | ${pageTitle}`}</title>
      </Head>
      <PageShell
        subtitle={t(demoEnabled ? "campaign.pageSubtitle" : "campaign.pageSubtitleLive")}
        title={t("campaign.pageTitle")}
      >
        <ProductReadinessBanner
          description={t(demoEnabled ? "campaign.readinessBannerDesc" : "campaign.readinessBannerDescLive")}
          status={demoEnabled ? "SEEDED_DEMO" : "BACKEND_READY_UI_GAP"}
          title={t(demoEnabled ? "campaign.readinessBannerTitle" : "campaign.readinessBannerTitleLive")}
        />

        {state.kind === "loading" ? <AsyncStateCard body={t("campaign.loadingBody")} title={t("campaign.loading")} /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title={t("campaign.requestFailed")} /> : null}
        {state.kind === "ready" ? (
          <CampaignProofView
            avatarSrc={demoCreator?.avatarSrc}
            endorseHref={
              isDemoProposal
                ? DEMO_S2_ENDORSE_PATH
                : `/campaigns/${state.data.proposal.proposalPda || state.data.proposal.id}/endorse`
            }
            heading={campaignHeading}
            isCampaignProof={isCampaignProof}
            isDemoProposal={isDemoProposal}
            proofStatus={state.proofStatus}
            proposal={state.data.proposal}
            settlementHref={settlementHref}
            sponsorName={
              isDemoProposal
                ? "Nova Screen"
                : state.data.proposal.sponsorWallet
                  ? shortenWallet(state.data.proposal.sponsorWallet)
                  : t("campaign.privateValue")
            }
            viewerRole={state.data.viewerRole}
          />
        ) : null}
      </PageShell>
    </>
  );
}

const explorerUrl = (kind: "tx" | "address", value: string) =>
  `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;

const toBigSafe = (value?: string | null) => {
  try {
    return value ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
};

const TrackRow = ({
  label,
  sub,
  amount,
  statusText,
  statusColor,
  accent,
  dim,
}: {
  label: string;
  sub: string;
  amount: string;
  statusText: string;
  statusColor: string;
  accent: string;
  dim?: boolean;
}) => (
  <div
    className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3"
    style={{ borderLeft: `3px solid ${accent}`, opacity: dim ? 0.6 : 1 }}
  >
    <div className="min-w-0 flex-1">
      <p className="text-[length:var(--fs-caption)] font-bold text-white">{label}</p>
      <p className="mt-0.5 text-[length:var(--fs-micro)] leading-snug text-[#7e90aa]">{sub}</p>
    </div>
    <p className="whitespace-nowrap text-base font-extrabold text-white">{amount}</p>
    <p
      className="min-w-[60px] whitespace-nowrap text-right text-[length:var(--fs-micro)] font-semibold"
      style={{ color: statusColor }}
    >
      {statusText}
    </p>
  </div>
);

const ProofRow = ({ label, value, href }: { label: string; value: string; href?: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.05] bg-black/20 px-3 py-2.5">
    <span className="shrink-0 text-[length:var(--fs-micro)] text-[#93a2bb]">{label}</span>
    {href ? (
      <a
        className="truncate font-mono text-[length:var(--fs-micro)] text-[#9fd0ff] transition hover:text-white"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {value} ↗
      </a>
    ) : (
      <span className="truncate font-mono text-[length:var(--fs-micro)] text-[#9fd0ff]">{value}</span>
    )}
  </div>
);

const CampaignProofView = ({
  proposal,
  viewerRole,
  isDemoProposal,
  isCampaignProof,
  proofStatus,
  heading,
  sponsorName,
  avatarSrc,
  endorseHref,
  settlementHref,
}: {
  proposal: ProposalDetailResponse["proposal"];
  viewerRole: ProposalDetailResponse["viewerRole"];
  isDemoProposal: boolean;
  isCampaignProof: boolean;
  proofStatus?: PublicCampaignProofResponse["proofStatus"];
  heading: string;
  sponsorName: string;
  avatarSrc?: string;
  endorseHref: string;
  settlementHref: string;
}) => {
  const { locale, t } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";
  const p = proposal;

  const metricActual = p.track2ActualValue != null ? Number(p.track2ActualValue) : NaN;
  const metricTarget = p.track2TargetValue != null ? Number(p.track2TargetValue) : NaN;
  const metricPct =
    Number.isFinite(metricActual) && Number.isFinite(metricTarget) && metricTarget > 0
      ? Math.min(100, Math.round((metricActual / metricTarget) * 100))
      : null;

  const track1Settled = p.status === "RESOLVED_SUCCESS";
  const track2Settled = Boolean(p.track2SettledAt);
  // Sum of the three Track budgets. This is the committed/funded budget, NOT a
  // live on-chain vault balance. The distinct on-chain account (proposal PDA) is
  // shown separately in the proof rows below.
  const committedBudgetAtomic = (
    toBigSafe(p.track1BaseUsdc) + toBigSafe(p.track2UsdcDeposited) + toBigSafe(p.track3UsdcDeposited)
  ).toString();

  const anchored = Boolean(p.contentAnchorPda);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <CampaignSourceNotice isDemoProposal={isDemoProposal} viewerRole={viewerRole} />

        {/* Header */}
        <div className="flex items-center gap-3.5">
          {avatarSrc ? (
            <img alt="" className="h-14 w-14 rounded-2xl border border-white/[0.12] object-cover" src={avatarSrc} />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-2xl border border-white/[0.12] bg-[linear-gradient(135deg,#2a3346,#161f2c)]" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-extrabold tracking-[-0.02em] text-white">{heading}</h2>
            <p className="mt-1 text-[length:var(--fs-caption)] text-[#93a2bb]">
              {localizeEnum(t, "campaign.statusLabel", p.status)}
            </p>
          </div>
        </div>

        {/* LIVE CAMPAIGN panel */}
        <Panel className="space-y-3" style={{ background: "linear-gradient(160deg,rgba(101,236,175,0.08),rgba(255,255,255,0.03))", borderColor: "rgba(101,236,175,0.22)" }}>
          <div className="flex items-center gap-2.5">
            {isDemoProposal ? (
              <>
                <span className="h-[7px] w-[7px] rounded-full bg-[#f3b33e] shadow-[0_0_10px_#f3b33e]" />
                <span className="font-mono text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.16em] text-[#f3c66e]">
                  SEEDED_DEMO
                </span>
              </>
            ) : (
              <>
                <span className="h-[7px] w-[7px] rounded-full bg-[#65ecaf] shadow-[0_0_10px_#65ecaf]" />
                <span className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.16em] text-[#7ce0b0]">
                  {t("campaign.liveCampaignTag")}
                </span>
              </>
            )}
            {proofStatus ? (
              <span className="ml-auto rounded-full border border-[#65ecaf]/30 bg-[#0e1f17]/60 px-2.5 py-0.5 text-[length:var(--fs-nano)] font-semibold text-[#8df0c4]">
                {proofStatus}
              </span>
            ) : null}
          </div>
          <h3 className="text-xl font-extrabold leading-snug text-white">{heading}</h3>

          {/* sponsor + verifiable */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[length:var(--fs-micro)] text-[#93a2bb]">{t("campaign.sponsoredBy")}</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#4a6cd4]/40 bg-[#4a6cd4]/[0.16] px-3 py-1 text-[length:var(--fs-micro)] font-bold text-[#a9bdf2]">
              <span className="h-3.5 w-3.5 rounded bg-[linear-gradient(135deg,#4a6cd4,#67b8ff)]" />
              {sponsorName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3fb6a8]/36 bg-[#3fb6a8]/[0.14] px-3 py-1 text-[length:var(--fs-micro)] text-[#7fe3d3]">
              {t("campaign.onChainVerifiable")}
            </span>
          </div>

          {/* content manifest card */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
            <div
              className="grid h-[54px] w-[84px] shrink-0 place-items-center rounded-lg text-lg"
              style={{ background: "linear-gradient(135deg,rgba(101,236,175,0.36),rgba(74,108,212,0.3))" }}
            >
              ▶
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{t("campaign.contentManifest")}</p>
              <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7e90aa]">
                {anchored ? t("campaign.manifestAnchored") : t("campaign.pendingPrivate")}
                {p.contentAnchorPda ? ` · ${shortenWallet(p.contentAnchorPda)}` : ""}
              </p>
            </div>
          </div>

          {/* metric progress */}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[length:var(--fs-micro)] text-[#93a2bb]">
                {t("campaign.metricProgress")} · {localizeEnum(t, "campaign.metricLabel", p.track2MetricType)}
              </span>
              <span className="text-[length:var(--fs-micro)] text-[#cbd6e7]">
                <b className="text-[length:var(--fs-caption)] text-white">{p.track2ActualValue ?? t("campaign.pendingReport")}</b>
                {" / "}
                {t("campaign.target")} {p.track2TargetValue}
                {metricPct != null ? ` · ${metricPct}%` : ""}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f0795f,#65ecaf)]"
                style={{ width: `${metricPct ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-[length:var(--fs-micro)] leading-relaxed text-[#7e90aa]">{t("campaign.unlockTrack2")}</p>
          </div>
        </Panel>

        {/* three-track settlement */}
        <Panel className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[length:var(--fs-caption)] font-semibold text-[#93a2bb]">{t("campaign.threeTrackSettlement")}</span>
            <span className="text-[length:var(--fs-micro)] text-[#7e90aa]">{t("campaign.vaultLabel")} {formatUsdcAtomic(committedBudgetAtomic)}</span>
          </div>
          <div className="space-y-2.5">
            <TrackRow
              accent="#de402a"
              amount={p.track1BaseUsdc ? formatUsdcAtomic(p.track1BaseUsdc) : t("campaign.privateValue")}
              label={t("campaign.track1Label")}
              statusColor={track1Settled ? "#7ce0b0" : "#f5b8ab"}
              statusText={track1Settled ? t("campaign.statusSettled") : t("campaign.statusInProgress")}
              sub={t("campaign.track1Sub")}
            />
            <TrackRow
              accent="#f0795f"
              amount={formatUsdcAtomic(p.track2UsdcDeposited)}
              label={t("campaign.track2Label")}
              statusColor={track2Settled ? "#7ce0b0" : "#f5b8ab"}
              statusText={track2Settled ? t("campaign.statusSettled") : t("campaign.statusInProgress")}
              sub={t("campaign.track2Sub")}
            />
            <TrackRow
              accent="#7486a1"
              amount={p.track3UsdcDeposited ? formatUsdcAtomic(p.track3UsdcDeposited) : "—"}
              dim
              label={t("campaign.track3Label")}
              statusColor="#7486a1"
              statusText={t("campaign.statusGated")}
              sub={t("campaign.track3Sub")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[length:var(--fs-nano)] text-[#7e90aa]">
            {[t("campaign.flowContent"), t("campaign.flowProposal"), t("campaign.flowSign"), t("campaign.flowFund")].map((step) => (
              <span key={step}>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">{step}</span>
                <span className="px-1">→</span>
              </span>
            ))}
            <span className="rounded-full border border-[#65ecaf]/34 bg-[#65ecaf]/[0.14] px-2.5 py-1 text-[#7ce0b0]">{t("campaign.flowSettle")}</span>
          </div>
        </Panel>

        {/* on-chain proof */}
        <Panel className="space-y-3">
          <div>
            <p className="text-[length:var(--fs-caption)] font-semibold text-[#93a2bb]">{t("campaign.proofTitle")}</p>
            <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7e90aa]">{t("campaign.proofSubtitle")}</p>
          </div>
          <div className="space-y-2">
            <ProofRow
              href={p.proposalPda ? explorerUrl("address", p.proposalPda) : undefined}
              label={t("campaign.proofProposalPda")}
              value={p.proposalPda ? shortenWallet(p.proposalPda) : t("campaign.pendingPrivate")}
            />
            <ProofRow
              href={p.contentAnchorPda ? explorerUrl("address", p.contentAnchorPda) : undefined}
              label={t("campaign.contentAnchor")}
              value={p.contentAnchorPda ? shortenWallet(p.contentAnchorPda) : t("campaign.pendingPrivate")}
            />
            <ProofRow
              href={p.onChainTxSignature ? explorerUrl("tx", p.onChainTxSignature) : undefined}
              label={t("campaign.proofFundingTx")}
              value={p.onChainTxSignature ? shortenWallet(p.onChainTxSignature) : t("campaign.pendingPrivate")}
            />
            <ProofRow label={t("campaign.proofVault")} value={formatUsdcAtomic(committedBudgetAtomic)} />
          </div>
          <p className="text-[length:var(--fs-micro)] text-[#7e90aa]">
            {t("campaign.oracleSync")}{" "}
            {p.oracleSyncStatus ? localizeEnum(t, "campaign.oracleLabel", p.oracleSyncStatus) : t("campaign.oracleSyncPublic")}
            {" · "}
            {t("campaign.deadline")} {formatIsoLabel(p.deadlineAt, dateLocale)}
          </p>
        </Panel>
      </div>

      {/* right column */}
      <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
        <Panel className="space-y-3">
          <p className="text-base font-extrabold text-white">{t("campaign.endorseTitle")}</p>
          <p className="text-[length:var(--fs-micro)] leading-relaxed text-[#93a2bb]">{t("campaign.endorseDesc")}</p>
          <Link
            className="block rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-3 text-center text-[length:var(--fs-caption)] font-bold text-white shadow-[0_14px_28px_rgba(222,64,42,0.25)] transition hover:brightness-[1.05]"
            href={endorseHref}
          >
            {t("campaign.endorseCta")}
          </Link>
          <Link
            className="block rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-[length:var(--fs-micro)] font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            href={settlementHref}
          >
            {t("campaign.settlementPreview")}
          </Link>
          <p className="text-[length:var(--fs-nano)] leading-relaxed text-[#5a6d87]">
            {isCampaignProof ? t("campaign.liveProofDescription") : isDemoProposal ? t("campaign.demoDescription") : t("campaign.liveApiDescription")}
          </p>
        </Panel>
      </div>
    </div>
  );
};

const CampaignSourceNotice = ({
  isDemoProposal,
  viewerRole,
}: {
  isDemoProposal: boolean;
  viewerRole: ProposalDetailResponse["viewerRole"];
}) => {
  const { t } = useI18n();
  return (
    <section
      className={`rounded-2xl border px-4 py-3 ${
        isDemoProposal
          ? "tone-state-warning"
          : "border-[#67b8ff]/20 bg-[#0d1b2a]/55"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("campaign.dataSource")}</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {isDemoProposal ? t("campaign.seededFallback") : t("campaign.liveCampaign")}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[length:var(--fs-micro)] font-semibold ${
            isDemoProposal
              ? "border-[#f3b33e]/30 bg-[#2a1f0b]"
              : "border-[#67b8ff]/25 bg-[#0d2236] text-[#a8d8ff]"
          }`}
        >
          {isDemoProposal ? "SEEDED_DEMO" : viewerRole}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        {isDemoProposal
          ? t("campaign.seededFallbackNotice")
          : t("campaign.liveNotice")}
      </p>
    </section>
  );
};
