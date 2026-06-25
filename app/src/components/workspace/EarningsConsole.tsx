import { useMemo } from "react";

import { ProposalStatus } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { campaigns as seededCampaigns } from "@/lib/mocks/workspace";
import { formatUsd } from "@/lib/public-data";

// Creator Track-2 share (the remaining 20% is the fan endorsement pool).
const TRACK2_CREATOR_BPS = 8000;

type EarningBucket = "settled" | "escrow" | "open";

const statusBucket = (status: ProposalStatus): EarningBucket => {
  if (status === "RESOLVED_SUCCESS") return "settled";
  if (status === "FUNDED") return "escrow";
  return "open";
};

const creatorTake = (track1: number, track2: number) =>
  track1 + Math.round((track2 * TRACK2_CREATOR_BPS) / 10000);

const BUCKET_PILL: Record<EarningBucket, { key: string; cls: string }> = {
  settled: { key: "ws.earnings.status.settled", cls: "border-[#65ecaf]/22 bg-[#0e1f17]/70 text-[#8df0c4]" },
  escrow: { key: "ws.earnings.status.escrow", cls: "border-[#f3b33e]/25 bg-[#2a1f0b]/70 text-[#f3c66e]" },
  open: { key: "ws.earnings.status.open", cls: "border-white/[0.1] bg-white/[0.04] text-[#9aabc4]" },
};

export const EarningsConsole = () => {
  const { t } = useI18n();

  const rows = useMemo(
    () =>
      seededCampaigns.map((c) => {
        const bucket = statusBucket(c.status);
        return {
          ...c,
          bucket,
          take: creatorTake(c.track1BaseUsd, c.track2PoolUsd),
        };
      }),
    [],
  );

  const totals = useMemo(() => {
    const sum = (b: EarningBucket) => rows.filter((r) => r.bucket === b).reduce((acc, r) => acc + r.take, 0);
    return { settled: sum("settled"), escrow: sum("escrow"), open: sum("open") };
  }, [rows]);

  return (
    <div className="space-y-4 pb-4">
      <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-extrabold tracking-[-0.02em] text-white">
        {t("ws.earnings.title")}
        <span className="text-[length:var(--fs-caption)] font-semibold text-[#7486a1]">{t("ws.earnings.subtitle")}</span>
      </h1>

      {/* Summary */}
      <section className="grid gap-2 sm:grid-cols-3">
        <SummaryCard accent="#65ecaf" label={t("ws.earnings.card.settled")} value={formatUsd(totals.settled)} />
        <SummaryCard accent="#f3c66e" label={t("ws.earnings.card.escrow")} value={formatUsd(totals.escrow)} />
        <SummaryCard accent="#9aabc4" label={t("ws.earnings.card.open")} value={formatUsd(totals.open)} />
      </section>

      {/* Withdrawal status */}
      <section className="flex items-start gap-3 rounded-[14px] border border-[#67b8ff]/18 bg-[#0e1726]/60 px-4 py-3">
        <span className="text-lg">🏦</span>
        <div className="min-w-0">
          <p className="text-[length:var(--fs-caption)] font-bold text-white">{t("ws.earnings.withdrawTitle")}</p>
          <p className="mt-0.5 text-[length:var(--fs-micro)] leading-relaxed text-[#93a2bb]">{t("ws.earnings.withdrawNote")}</p>
        </div>
      </section>

      {/* Per-campaign breakdown */}
      <section>
        <p className="mb-2.5 text-[length:var(--fs-base)] font-bold text-white">{t("ws.earnings.detailTitle")}</p>
        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-4 py-10 text-center text-[length:var(--fs-overline)] text-[#7e90aa]">
            {t("ws.earnings.empty")}
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => {
              const pill = BUCKET_PILL[r.bucket];
              const track3Enabled = r.track3PoolUsd > 0 && r.bucket === "settled";
              return (
                <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4" key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[length:var(--fs-base)] font-bold text-white">{r.sponsorName}</p>
                      <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7486a1]">
                        {t("ws.earnings.metricLabel", { metric: r.metric, actual: r.actualValue })}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[length:var(--fs-nano)] font-semibold ${pill.cls}`}>
                      {t(pill.key)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <TrackChip label={t("ws.earnings.track.base")} value={formatUsd(r.track1BaseUsd)} />
                    <TrackChip label={t("ws.earnings.track.perf")} value={formatUsd(Math.round((r.track2PoolUsd * TRACK2_CREATOR_BPS) / 10000))} />
                    <TrackChip dim label={t("ws.earnings.track.cps")} value={track3Enabled ? formatUsd(r.track3PoolUsd) : t("ws.earnings.cpsGated")} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                    <span className="flex items-center gap-1.5 text-[length:var(--fs-micro)] text-[#7486a1]">
                      {t("ws.earnings.chainProof")}
                      <span className="font-mono text-[#8d9cb4]">{r.chainTxShort}</span>
                    </span>
                    <span className="text-[length:var(--fs-caption)]">
                      <span className="text-[#7486a1]">{t("ws.earnings.creatorTake")} </span>
                      <span className="font-extrabold text-white">{formatUsd(r.take)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-[length:var(--fs-micro)] leading-relaxed text-[#7486a1]">
        {t("ws.earnings.note")}
      </p>
    </div>
  );
};

const SummaryCard = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
    <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.14em] text-[#5a6d87]">{label}</p>
    <p className="mt-1 text-2xl font-extrabold tracking-[-0.02em]" style={{ color: accent }}>{value}</p>
  </div>
);

const TrackChip = ({ label, value, dim }: { label: string; value: string; dim?: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[length:var(--fs-micro)] ${dim ? "opacity-60" : ""}`}>
    <span className="text-[#7486a1]">{label}</span>
    <span className="font-semibold text-white">{value}</span>
  </span>
);
