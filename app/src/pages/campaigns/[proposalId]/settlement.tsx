import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { getPublicCampaignProof, PublicCampaignProofResponse } from "@/lib/api/workspace";
import { publicDemoEnabled } from "@/lib/feature-flags";
import { formatUsdcAtomic } from "@/lib/formatting";
import { useI18n } from "@/lib/i18n";
import { findCreator, formatUsd } from "@/lib/public-data";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TrackStatus = "PENDING" | "SETTLED" | "VOIDED";

type Track1Evidence = {
  budgetUsd: number;
  status: TrackStatus;
  creatorWallet: string;
  // Optional dedicated settlement tx signature. Rendered as a verifiable link
  // when present, and as an unavailable dash otherwise — never fabricated.
  settlementTxSignature: string | null;
};

type SettlementData = {
  proposalId: string;
  status: string;
  track1: Track1Evidence;
  // Track 2/3 are not part of the current Pilot. We keep the committed budget only
  // so the closed rows can show what was funded — never a simulated payout split.
  track2Budget: number;
  track3Budget: number;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

/* ------------------------------------------------------------------ */
/*  Seeded legacy-demo fixture (Track 1 evidence only)                 */
/* ------------------------------------------------------------------ */

const MOCK: SettlementData = {
  proposalId: "prop-neo-park-2026q2",
  status: "RESOLVED_SUCCESS",
  track1: {
    budgetUsd: 100_000,
    status: "SETTLED",
    creatorWallet: "5Yk3...R8wF",
    settlementTxSignature: null,
  },
  track2Budget: 1_000_000,
  track3Budget: 300_000,
};

const usdcAtomicToUsdNumber = (value: string | number | bigint | null | undefined) => {
  const label = formatUsdcAtomic(value);
  const parsed = Number(label.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const deriveTrackStatus = (settled: boolean, proofStatus: PublicCampaignProofResponse["proofStatus"]): TrackStatus => {
  if (proofStatus === "VOIDED" || proofStatus === "CANCELLED") {
    return "VOIDED";
  }
  return settled ? "SETTLED" : "PENDING";
};

const mapCampaignProofToSettlement = (proof: PublicCampaignProofResponse): SettlementData => ({
  proposalId: proof.proposalId,
  status: proof.status,
  track1: {
    budgetUsd: usdcAtomicToUsdNumber(proof.budgetTracks.track1BaseUsdc),
    // Prefer the backend integrity confirmation when present — a claim marker
    // alone is not "settled" once the server ships a verified checklist.
    status: deriveTrackStatus(
      proof.integrity ? proof.integrity.track1SettlementConfirmed : proof.budgetTracks.track1Claimed,
      proof.proofStatus,
    ),
    creatorWallet: `${proof.creatorWallet.slice(0, 4)}...${proof.creatorWallet.slice(-4)}`,
    settlementTxSignature: proof.proof.latestSettlementTxSignature ?? null,
  },
  track2Budget: usdcAtomicToUsdNumber(proof.budgetTracks.track2UsdcDeposited),
  track3Budget: usdcAtomicToUsdNumber(proof.budgetTracks.track3UsdcDeposited),
});

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                     */
/* ------------------------------------------------------------------ */

const C = {
  accent: "#de402a",
  success: "#65ecaf",
  info: "#67b8ff",
  dim: "#1e2536",
  dimBorder: "#2a3348",
  text2: "#8ea0ba",
} as const;

const trackStatusLabel = (t: Translate, status: TrackStatus) =>
  status === "SETTLED"
    ? t("settlement.status.settled")
    : status === "VOIDED"
      ? t("settlement.status.voided")
      : t("settlement.status.pending");

const trackStatusColor = (status: TrackStatus) =>
  status === "SETTLED" ? C.success : status === "VOIDED" ? C.accent : C.text2;

/* ------------------------------------------------------------------ */
/*  Cards                                                              */
/* ------------------------------------------------------------------ */

const explorerTxUrl = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

const shortenSignature = (signature: string) =>
  signature.length > 12 ? `${signature.slice(0, 6)}...${signature.slice(-6)}` : signature;

function EvidenceRow({ label, value, color, href }: { color?: string; href?: string; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs text-[#8ea0ba]">{label}</span>
      {href ? (
        <a
          className="font-mono text-sm font-medium text-[#9fd0ff] transition hover:text-white"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {value} ↗
        </a>
      ) : (
        <span className="text-sm font-medium" style={{ color: color ?? "white" }}>{value}</span>
      )}
    </div>
  );
}

function Track1EvidenceCard({ track1 }: { track1: Track1Evidence }) {
  const { t } = useI18n();
  const isSettled = track1.status === "SETTLED";
  return (
    <div
      className="glass-card relative overflow-hidden rounded-[28px] p-6"
      style={{ borderTop: `2px solid ${isSettled ? C.info : C.dimBorder}` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{t("settlement.track1Title")}</h3>
        <span
          className="rounded-full px-3 py-1 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.12em]"
          style={{
            background: isSettled ? `${C.info}22` : track1.status === "VOIDED" ? `${C.accent}22` : C.dim,
            color: trackStatusColor(track1.status),
          }}
        >
          {track1.status}
        </span>
      </div>
      <EvidenceRow color={C.info} label={t("settlement.committedBase")} value={formatUsd(track1.budgetUsd)} />
      {/* "Paid to" only once the Track 1 base is settled on-chain; otherwise the
          wallet is just the intended recipient, not a confirmed payout. */}
      <EvidenceRow label={isSettled ? t("settlement.paidTo") : t("settlement.recipient")} value={track1.creatorWallet} />
      <EvidenceRow
        color={trackStatusColor(track1.status)}
        label={t("settlement.claimMarker")}
        value={trackStatusLabel(t, track1.status)}
      />
      <EvidenceRow
        href={track1.settlementTxSignature ? explorerTxUrl(track1.settlementTxSignature) : undefined}
        label={t("settlement.settlementTx")}
        value={track1.settlementTxSignature ? shortenSignature(track1.settlementTxSignature) : t("settlement.evidenceUnavailable")}
      />
      <p className="mt-3 text-[length:var(--fs-micro)] leading-5 text-[#8ea0ba]">{t("settlement.track1Note")}</p>
    </div>
  );
}

function ClosedTrackCard({ budgetUsd, sub, title }: { budgetUsd: number; sub: string; title: string }) {
  const { t } = useI18n();
  return (
    <div
      className="glass-card relative overflow-hidden rounded-[28px] p-6 opacity-70"
      style={{ borderTop: `2px solid ${C.dimBorder}` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{title}</h3>
        <span
          className="rounded-full px-3 py-1 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.12em]"
          style={{ background: C.dim, color: C.text2 }}
        >
          {t("settlement.closedInPilot")}
        </span>
      </div>
      <EvidenceRow label={t("settlement.committedBudget")} value={budgetUsd > 0 ? formatUsd(budgetUsd) : "—"} />
      <p className="mt-3 text-[length:var(--fs-micro)] leading-5 text-[#8ea0ba]">{sub}</p>
    </div>
  );
}

function SettlementSourceNotice({
  hasError,
  isLive,
  proposalId,
}: {
  hasError: boolean;
  isLive: boolean;
  proposalId: string;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-[20px] border tone-state-warning px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em]">
            {isLive ? t("settlement.sourceLabelLive") : t("settlement.sourceLabel")}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {isLive ? t("settlement.sourceHeadingLive") : t("settlement.sourceHeading")}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#a7b2c4]">
            {isLive ? t("settlement.sourceBodyLive") : t("settlement.sourceBody")}
            {hasError ? t("settlement.apiReason") : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#f3b33e]/30 bg-[#2a1f0b] px-3 py-1 font-mono text-[length:var(--fs-micro)] font-semibold">
          {proposalId || t("settlement.proposalPending")}
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SettlementPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  // Pilot scope: settlement is read-only Track 1 evidence. The local MOCK is a
  // seeded legacy-demo Track 1 fixture only. Off the public demo flag, this page
  // never seeds MOCK — it loads live campaign-proof fields or an honest unavailable
  // state. Track 2/3 tri-track simulation has been removed entirely.
  const demoAllowed = publicDemoEnabled();
  const [data, setData] = useState<SettlementData | null>(demoAllowed ? MOCK : null);
  const [source, setSource] = useState<"live" | "mock" | "loading" | "unavailable">(
    demoAllowed ? "mock" : "loading",
  );
  // Never store raw backend/API error text in rendered state — only a boolean so
  // the UI can show a localized generic "campaign proof unavailable" reason.
  const [loadError, setLoadError] = useState<boolean>(false);
  const creator = useMemo(() => findCreator("neo-park"), []);
  const creatorName = locale === "en" ? "Midnight Save" : creator.name;
  // In live mode the creator identity is the on-chain wallet, not the seeded
  // neo-park demo persona. Only the labeled legacy MOCK fixture keeps that name.
  const subtitle =
    source === "live" && data
      ? t("settlement.subtitleLive", { wallet: data.track1.creatorWallet })
      : t("settlement.subtitle", { name: creatorName, handle: creator.handle });
  const routeProposalId = router.isReady ? String(router.query.proposalId ?? "").trim() : "";

  useEffect(() => {
    if (!router.isReady || !routeProposalId) {
      return;
    }

    let cancelled = false;
    setLoadError(false);
    // Fail closed on every new proposal request so financial values from a
    // previously loaded proposal can never render under a new URL while this
    // fetch is pending. Non-demo shows an honest loading state with no data.
    // Demo clears any previous live proposal data and falls back to the
    // labeled legacy MOCK fixture only — never the prior proposal's live data.
    if (demoAllowed) {
      setData(MOCK);
      setSource("mock");
    } else {
      setData(null);
      setSource("loading");
    }
    getPublicCampaignProof(routeProposalId)
      .then((proof) => {
        if (!cancelled) {
          setData(mapCampaignProofToSettlement(proof));
          setSource("live");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          if (demoAllowed) {
            setData(MOCK);
            setSource("mock");
          } else {
            setData(null);
            setSource("unavailable");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demoAllowed, router.isReady, routeProposalId]);

  if (!data) {
    return (
      <>
        <Head>
          <title>{`StreamPump | ${t("settlement.headTitle")}`}</title>
        </Head>
        <PageShell eyebrow={t("settlement.eyebrow")} subtitle={subtitle} title={t("settlement.pageTitle")}>
          <div className="space-y-6">
            <SettlementSourceNotice hasError={loadError} isLive={false} proposalId={routeProposalId} />
            <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-5 py-10 text-center">
              <p className="text-sm font-semibold text-white">
                {source === "unavailable" ? t("settlement.noProjectionTitle") : t("settlement.loadingTitle")}
              </p>
              <p className="mx-auto mt-2 max-w-[460px] text-xs leading-6 text-[#8ea0ba]">
                {t("settlement.noProjectionBody")}
                {loadError ? t("settlement.apiReason") : ""}
              </p>
            </section>
          </div>
        </PageShell>
      </>
    );
  }

  const statusColor = data.status === "VOIDED" ? C.accent : C.success;

  return (
    <>
      <Head>
        <title>{`StreamPump | ${t("settlement.headTitle")}`}</title>
      </Head>

      <PageShell eyebrow={t("settlement.eyebrow")} subtitle={subtitle} title={t("settlement.pageTitle")}>
        <div className="relative space-y-6">
          <ProductReadinessBanner
            description={source === "live" ? t("settlement.bannerDescLive") : t("settlement.bannerDescMock")}
            status={source === "live" ? "SEEDED_DEMO" : "MOCK_PREVIEW"}
            title={source === "live" ? t("settlement.bannerTitleLive") : t("settlement.bannerTitleMock")}
          />
          <SettlementSourceNotice hasError={loadError} isLive={source === "live"} proposalId={routeProposalId} />

          {/* ---- Top stats ---- */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t("settlement.statTrack1Base"), value: formatUsd(data.track1.budgetUsd), color: C.info },
              { label: t("settlement.statTrack1Status"), value: trackStatusLabel(t, data.track1.status), color: trackStatusColor(data.track1.status) },
              { label: t("settlement.statProposalStatus"), value: data.status.replace(/_/g, " "), color: statusColor },
            ].map((s) => (
              <div className="surface-muted flex flex-col items-center rounded-[28px] p-5 text-center" key={s.label}>
                <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.24em] text-[#7486a1]">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ---- Track 1 evidence + closed Track 2/3 ---- */}
          <div className="grid gap-5 md:grid-cols-3">
            <Track1EvidenceCard track1={data.track1} />
            <ClosedTrackCard budgetUsd={data.track2Budget} sub={t("settlement.track2Sub")} title={t("settlement.track2Title")} />
            <ClosedTrackCard budgetUsd={data.track3Budget} sub={t("settlement.track3Sub")} title={t("settlement.track3Title")} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
