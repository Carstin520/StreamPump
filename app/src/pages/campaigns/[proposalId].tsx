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
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";
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
    const mockProposal = findMockProposalDetail(proposalId);
    if (mockProposal) {
      setState({ kind: "ready", data: mockProposal, source: "demo-fallback" });
      return;
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
        subtitle={t("campaign.pageSubtitle")}
        title={t("campaign.pageTitle")}
      >
        <ProductReadinessBanner
          description={t("campaign.readinessBannerDesc")}
          status="SEEDED_DEMO"
          title={t("campaign.readinessBannerTitle")}
        />

        {state.kind === "loading" ? <AsyncStateCard body={t("campaign.loadingBody")} title={t("campaign.loading")} /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title={t("campaign.requestFailed")} /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <CampaignSourceNotice isDemoProposal={isDemoProposal} viewerRole={state.data.viewerRole} />

              <Panel className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("campaign.proposalLabel")}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {campaignHeading}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {isDemoProposal
                        ? t("campaign.demoFallbackNote")
                        : t("campaign.viewerMode", { role: state.data.viewerRole })}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-100">{localizeEnum(t, "campaign.statusLabel", state.data.proposal.status)}</span>
                </div>
                {state.proofStatus ? (
                  <div className="rounded-2xl border border-[#67b8ff]/20 bg-[#0d1b2a]/55 px-4 py-3 text-sm text-slate-300">
                    {t("campaign.proofProjection")} <span className="font-semibold text-white">{state.proofStatus}</span>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("campaign.track1Label")}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {state.data.proposal.track1BaseUsdc ? formatUsdcAtomic(state.data.proposal.track1BaseUsdc) : t("campaign.privateValue")}
                    </p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("campaign.track2Label")}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatUsdcAtomic(state.data.proposal.track2UsdcDeposited)}</p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {t("campaign.track3Label")}
                      <span className="ml-2 rounded-full border border-[#f3b33e]/30 bg-[#2a1f0b] px-2 py-0.5 font-mono text-[length:var(--fs-micro)] font-semibold text-[#f3b33e]">
                        {t("campaign.track3Gated")}
                      </span>
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {state.data.proposal.track3UsdcDeposited ? formatUsdcAtomic(state.data.proposal.track3UsdcDeposited) : t("campaign.privateValue")}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t("campaign.bindingSettlement")}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs text-slate-400">{t("campaign.contentHash")}</p>
                    <p className="mt-2 break-all text-sm text-white">{state.data.proposal.contentHashHex ?? t("campaign.publicHideHash")}</p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs text-slate-400">{t("campaign.contentAnchor")}</p>
                    <p className="mt-2 break-all text-sm text-white">{state.data.proposal.contentAnchorPda ?? t("campaign.pendingPrivate")}</p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs text-slate-400">{t("campaign.onChainTx")}</p>
                    <p className="mt-2 break-all text-sm text-white">{state.data.proposal.onChainTxSignature ?? t("campaign.pendingPrivate")}</p>
                  </div>
                </div>
                <div className="surface-muted rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("campaign.metricProgress")}</p>
                  <p className="mt-2 text-sm text-slate-200">
                    {localizeEnum(t, "campaign.metricLabel", state.data.proposal.track2MetricType)}: {state.data.proposal.track2ActualValue ?? t("campaign.pendingReport")} / {state.data.proposal.track2TargetValue}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{t("campaign.deadline")} {formatIsoLabel(state.data.proposal.deadlineAt, dateLocale)}</p>
                </div>
              </Panel>
            </div>

            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t("campaign.sharedStatus")}</p>
              <p className="text-sm leading-7 text-slate-300">
                {isDemoProposal
                  ? t("campaign.demoDescription")
                  : isCampaignProof
                    ? t("campaign.liveProofDescription")
                  : t("campaign.liveApiDescription")}
              </p>
              <div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">
                <p>{t("campaign.oracleSync")} {state.data.proposal.oracleSyncStatus ? localizeEnum(t, "campaign.oracleLabel", state.data.proposal.oracleSyncStatus) : t("campaign.oracleSyncPublic")}</p>
                <p className="mt-2">{t("campaign.track2Settled")} {state.data.proposal.track2SettledAt ? formatIsoLabel(state.data.proposal.track2SettledAt, dateLocale) : t("campaign.notSettled")}</p>
                <p className="mt-2">{t("campaign.track3Settled")} {state.data.proposal.track3SettledAt ? formatIsoLabel(state.data.proposal.track3SettledAt, dateLocale) : t("campaign.notSettledPrivate")}</p>
              </div>
              <div className="grid gap-3">
                {isDemoProposal ? (
                  <Link
                    className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                    href={DEMO_S2_ENDORSE_PATH}
                  >
                    {t("campaign.endorseDemo")}
                  </Link>
                ) : null}
                <Link
                  className="block rounded-2xl bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_28px_rgba(222,64,42,0.25)] transition hover:brightness-[1.05]"
                  href={settlementHref}
                >
                  {t("campaign.settlementPreview")}
                </Link>
                <p className="text-xs leading-5 text-slate-500">
                  {t("campaign.settlementPreviewCaption")}
                </p>
              </div>
            </Panel>
          </div>
        ) : null}
      </PageShell>
    </>
  );
}

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
