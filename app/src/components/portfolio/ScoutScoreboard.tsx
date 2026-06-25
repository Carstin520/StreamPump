import Link from "next/link";

import { StagePill } from "@/components/shared/StagePill";
import { findCreator } from "@/lib/public-data";
import { scoutScoreboard } from "@/lib/mocks/portfolio";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";
import { useI18n } from "@/lib/i18n";
import type { ScoutBackingRowRecord } from "@/lib/api/types";

const creatorHref = (creatorId: string) => {
  const wallet = resolveCreatorWalletForRoute(creatorId);
  return wallet ? `/market/${wallet}` : `/creators/${creatorId}`;
};

const SummaryCard = ({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "blue" | "red";
}) => {
  const toneClass =
    tone === "blue"
      ? "border-[#67b8ff]/30 bg-[#67b8ff]/[0.08]"
      : tone === "red"
        ? "border-dashed border-[#de402a]/40 bg-[#de402a]/[0.08]"
        : "border-white/[0.06] bg-[linear-gradient(180deg,rgba(20,28,41,0.84)_0%,rgba(11,16,25,0.80)_100%)]";
  const labelColor = tone === "blue" ? "text-[#9fd0ff]" : tone === "red" ? "text-[#f0a08f]" : "text-[#5a6d87]";
  const valueColor = tone === "blue" ? "text-[#9fd0ff]" : tone === "red" ? "text-[#f5b8ab]" : "text-white";

  return (
    <div className={`flex-1 rounded-[16px] border px-4 py-3.5 ${toneClass}`}>
      <p className={`text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.14em] ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-xl font-extrabold tracking-[-0.03em] ${valueColor}`}>{value}</p>
    </div>
  );
};

const identityBadge = (identity: ScoutBackingRowRecord["identity"], t: (k: string) => string) => {
  if (identity === "founding") {
    return <span className="text-[length:var(--fs-nano)] font-semibold text-[#7ce0b0]">{t("portfolio.scout.founding")}</span>;
  }
  if (identity === "early") {
    return <span className="text-[length:var(--fs-nano)] font-semibold text-[#f5b8ab]">{t("portfolio.scout.early")}</span>;
  }
  return null;
};

const actionLabelKey: Record<ScoutBackingRowRecord["action"], string> = {
  claim: "portfolio.scout.actionClaim",
  add: "portfolio.scout.actionAdd",
  view: "portfolio.scout.actionView",
};

export const ScoutScoreboard = () => {
  const { t } = useI18n();
  const data = scoutScoreboard;
  const rediscover = findCreator(data.rediscoverCreatorId);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-white">
          {t("portfolio.scout.title")} <span className="text-base font-semibold text-[#5a6d87]">Portfolio</span>
        </h1>
        <p className="mt-1 text-[length:var(--fs-caption)] text-[#93a2bb]">{t("portfolio.scout.subtitle")}</p>
      </div>

      {/* MOCK_PREVIEW notice */}
      <div className="tone-state-warning flex items-start justify-between gap-3 rounded-[14px] border px-4 py-2.5">
        <p className="text-[length:var(--fs-micro)] leading-5">{t("portfolio.scout.readiness")}</p>
        <span className="shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[length:var(--fs-nano)] font-semibold">
          MOCK_PREVIEW
        </span>
      </div>

      {/* Summary cards */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SummaryCard label={t("portfolio.scout.backing")} value={t("portfolio.scout.backingValue", { count: String(data.backingCount) })} />
        <SummaryCard
          tone="blue"
          label={t("portfolio.scout.hits")}
          value={`${t("portfolio.scout.hitsValue", { count: String(data.graduatedHits) })} ★`}
        />
        <SummaryCard label={t("portfolio.scout.reputation")} value={`${data.reputationFrom} → ${data.reputationTo}`} />
        <SummaryCard
          tone="red"
          label={t("portfolio.scout.claimable")}
          value={t("portfolio.scout.claimableValue", { count: String(data.claimableCount), window: data.claimWindowLabel })}
        />
      </div>

      {/* Track-record table */}
      <div className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(20,28,41,0.70)_0%,rgba(11,16,25,0.66)_100%)]">
        <div className="hidden grid-cols-[1.8fr_1fr_1.2fr_0.9fr_1fr_92px] gap-3 border-b border-white/[0.07] px-4 py-3 text-[length:var(--fs-nano)] uppercase tracking-[0.12em] text-[#5a6d87] sm:grid">
          <span>{t("portfolio.scout.colCreator")}</span>
          <span>{t("portfolio.scout.colBackedAt")}</span>
          <span>{t("portfolio.scout.colEntry")}</span>
          <span>{t("portfolio.scout.colMomentum")}</span>
          <span>{t("portfolio.scout.colStatus")}</span>
          <span />
        </div>
        <div className="divide-y divide-white/[0.04]">
          {data.rows.map((row) => {
            const creator = findCreator(row.creatorId);
            return (
              <Link
                className="grid grid-cols-2 items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] sm:grid-cols-[1.8fr_1fr_1.2fr_0.9fr_1fr_92px]"
                href={creatorHref(row.creatorId)}
                key={row.creatorId}
              >
                <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
                  <img alt={creator.name} className="h-8 w-8 shrink-0 rounded-[9px] border border-white/[0.12] object-cover" src={creator.avatarSrc} />
                  <span className="truncate text-[length:var(--fs-caption)] font-bold text-white">{creator.name}</span>
                </div>
                <div className="text-[length:var(--fs-micro)] text-[#93a2bb]">{row.backedAtLabel}</div>
                <div className="text-[length:var(--fs-micro)] text-[#cbd6e7]">
                  {t("portfolio.scout.entryRank", { rank: String(row.entryRank) })} {identityBadge(row.identity, t)}
                </div>
                <div className="text-[length:var(--fs-caption)] font-bold text-white">{creator.momentumScore || "—"}</div>
                <div><StagePill compact stage={creator.state} /></div>
                <div className="flex justify-start sm:justify-end">
                  <span
                    className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-[length:var(--fs-micro)] font-bold ${
                      row.action === "claim"
                        ? "bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] text-white"
                        : "border border-white/[0.16] bg-white/[0.04] text-[#c8d2e3] group-hover:text-white"
                    }`}
                  >
                    {t(actionLabelKey[row.action])}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Rediscover nudge */}
      <Link
        className="flex items-center gap-3 rounded-[14px] border border-dashed border-[#67b8ff]/35 bg-[#67b8ff]/[0.07] px-4 py-3.5 transition hover:border-[#67b8ff]/55"
        href={creatorHref(data.rediscoverCreatorId)}
      >
        <span className="text-lg">👀</span>
        <span className="flex-1 text-[length:var(--fs-caption)] text-[#9fd0ff]">
          {t("portfolio.scout.rediscover", { name: rediscover.name })}
        </span>
        <span className="shrink-0 rounded-full border border-[#67b8ff]/50 px-4 py-1.5 text-[length:var(--fs-micro)] font-bold text-[#9fd0ff]">
          {t("portfolio.scout.goLook")}
        </span>
      </Link>
    </section>
  );
};
