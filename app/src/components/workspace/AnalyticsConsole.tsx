import { useMemo, useState } from "react";

import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { LockedPanel } from "@/components/shared/LockedPanel";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { TierBadge } from "@/components/shared/TierBadge";
import { useI18n } from "@/lib/i18n";
import {
  ACCOUNT_FOLLOWER_SERIES,
  ACCOUNT_KPIS,
  ACCOUNT_PERCENTILES,
  ACCOUNT_TRAFFIC,
  AnalyticsTier,
  KpiCell,
  PaidTier,
  PercentileRow,
  PlayRange,
  POST_FUNNEL,
  POST_KPIS,
  POST_PERCENTILES,
  POST_RETENTION,
  POST_TRAFFIC,
  TIER_FROM_PER_MONTH,
  TIER_ORDER,
  TIER_PRICING,
  TOP_CONTENT_BACKERS,
  TOP_CONTENT_ENGAGE,
  TOP_CONTENT_PLAYS,
  TrafficRow,
  WEEK_ACTIVITY,
  WEEK_ACTIVITY_HOT,
  followerSeries,
  formatTierPrice,
  genSeries,
  playSeries,
} from "@/lib/mocks/analytics";
import { WorkspaceContentItem, WorkspacePersona } from "@/lib/mocks/workspace";

const ELIGIBLE_STATUSES = ["READY", "ANCHORED", "PUBLISHED", "LOCKED"];

/* ────────────────────────────  Root  ──────────────────────────── */

export const AnalyticsConsole = ({ persona }: { persona: WorkspacePersona }) => {
  const [tier, setTier] = useState<AnalyticsTier>("free");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  const published = useMemo(
    () => persona.contentItems.filter((c) => ELIGIBLE_STATUSES.includes(c.status)),
    [persona.contentItems],
  );
  const selected = selectedId ? published.find((c) => c.id === selectedId) ?? null : null;

  const openPricing = () => setPricingOpen(true);

  return (
    <div className="space-y-4 pb-4">
      {selected ? (
        <PostAnalytics
          item={selected}
          onBack={() => setSelectedId(null)}
          onTier={setTier}
          onUnlock={openPricing}
          tier={tier}
        />
      ) : (
        <AccountData
          onOpenPost={setSelectedId}
          onTier={setTier}
          onUnlock={openPricing}
          posts={published}
          tier={tier}
        />
      )}

      {pricingOpen ? (
        <PricingModal currentTier={tier} onChoose={setTier} onClose={() => setPricingOpen(false)} />
      ) : null}
    </div>
  );
};

/* ────────────────────────────  Shared bits  ──────────────────────────── */

const TierSwitcher = ({
  tier,
  onTier,
}: {
  tier: AnalyticsTier;
  onTier: (t: AnalyticsTier) => void;
}) => {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-1">
      <span className="px-1.5 text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.14em] text-[#6f8099]">
        {t("ws.data.demoTier")}
      </span>
      {TIER_ORDER.map((it) => (
        <button
          className={`rounded-full px-2.5 py-1 text-[length:var(--fs-micro)] capitalize transition ${
            tier === it ? "bg-white/[0.08] text-white" : "text-[#7e90aa] hover:text-white"
          }`}
          key={it}
          onClick={() => onTier(it)}
          type="button"
        >
          {it}
        </button>
      ))}
    </div>
  );
};

const KpiRow = ({ cells }: { cells: KpiCell[] }) => {
  const { t } = useI18n();
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c) => (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5" key={c.labelKey}>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.12em] text-[#5a6d87]">{t(c.labelKey)}</p>
          <p className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-white">{c.value}</p>
        </div>
      ))}
    </section>
  );
};

const UpsellBanner = ({ onOpen }: { onOpen: () => void }) => {
  const { t } = useI18n();
  return (
    <button
      className="flex w-full items-center gap-3 rounded-[14px] border border-[#f3b33e]/22 bg-[#2a1f0b]/45 px-4 py-3 text-left transition hover:border-[#f3b33e]/40"
      onClick={onOpen}
      type="button"
    >
      <span className="text-xl">📊</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--fs-caption)] font-bold text-white">{t("ws.data.upsell.title")}</span>
        <span className="mt-0.5 block text-[length:var(--fs-micro)] leading-relaxed text-[#d8c4a0]">{t("ws.data.upsell.body")}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[length:var(--fs-base)] font-extrabold text-[#ffd9a0]">$12.50<span className="text-[length:var(--fs-nano)] text-[#c9b48f]">{t("ws.data.upsell.perMo")}</span></span>
      </span>
      <span className="shrink-0 rounded-full bg-[linear-gradient(180deg,#f05540,#de402a)] px-3.5 py-1.5 text-[length:var(--fs-micro)] font-bold text-white">{t("ws.data.upsell.cta")}</span>
    </button>
  );
};

const Panel = ({
  title,
  badge,
  className = "",
  children,
}: {
  title: React.ReactNode;
  badge?: PaidTier;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={`rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 ${className}`}>
    <div className="mb-2.5 flex items-center gap-2">
      <h3 className="text-[length:var(--fs-caption)] font-bold text-white">{title}</h3>
      {badge ? <TierBadge tier={badge} /> : null}
    </div>
    {children}
  </section>
);

const Cap = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2.5 text-[length:var(--fs-micro)] leading-relaxed text-[#93a2bb]">{children}</p>
);

const AreaTrend = ({ points, color, fill, height = 130 }: { points: number[]; color: string; fill: string; height?: number }) => (
  <SparklineChart className="h-auto w-full" color={color} fillColor={fill} height={height} points={points} strokeWidth={2.2} width={600} />
);

const TrafficBars = ({ rows }: { rows: TrafficRow[] }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div className="flex items-center gap-2.5" key={r.labelKey}>
          <span className="w-12 shrink-0 text-[length:var(--fs-micro)] text-[#93a2bb]">{t(r.labelKey)}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <span className="block h-full rounded-full bg-[#67b8ff]" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="w-9 shrink-0 text-right text-[length:var(--fs-micro)] font-bold text-white">{r.pct}%</span>
        </div>
      ))}
    </div>
  );
};

const PercentileRows = ({ rows }: { rows: PercentileRow[] }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.labelKey}>
          <div className="flex items-center justify-between text-[length:var(--fs-micro)]">
            <span className="text-[#93a2bb]">{t(r.labelKey)}</span>
            <span className="font-bold text-[#7ce0b0]">{t("ws.metric.percentile", { pct: String(r.pct) })}</span>
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.08]">
            <span className="absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded-full bg-[#7ce0b0]" style={{ left: `calc(${r.pct}% - 2px)` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const WeekBars = () => {
  const { t } = useI18n();
  const days = [t("ws.day.mon"), t("ws.day.tue"), t("ws.day.wed"), t("ws.day.thu"), t("ws.day.fri"), t("ws.day.sat"), t("ws.day.sun")];
  return (
    <>
      <p className="text-[length:var(--fs-caption)] text-[#dbe3ef]">
        {t("ws.metric.peakLabel")} <b className="text-white">{t("ws.metric.peakValue")}</b>
      </p>
      <div className="mt-3 flex h-14 items-end gap-1">
        {WEEK_ACTIVITY.map((v, i) => (
          <span
            className="flex-1 rounded-[3px]"
            key={i}
            style={{ height: `${v}%`, background: i === WEEK_ACTIVITY_HOT ? "linear-gradient(180deg,#f0795f,#de402a)" : "rgba(255,255,255,0.12)" }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[length:var(--fs-nano)] text-[#5d6b82]">
        {days.map((d, i) => <span key={i}>{d}</span>)}
      </div>
    </>
  );
};

/* ────────────────────────────  Account view (数据)  ──────────────────────────── */

const AccountData = ({
  posts,
  tier,
  onTier,
  onOpenPost,
  onUnlock,
}: {
  posts: WorkspaceContentItem[];
  tier: AnalyticsTier;
  onTier: (t: AnalyticsTier) => void;
  onOpenPost: (id: string) => void;
  onUnlock: () => void;
}) => {
  const { t } = useI18n();
  const starterUnlock = t("ws.pricing.unlock", { tier: "Starter", price: formatTierPrice(TIER_FROM_PER_MONTH.starter) });
  const growthUnlock = t("ws.pricing.unlock", { tier: "Growth", price: formatTierPrice(TIER_FROM_PER_MONTH.growth) });
  const studioUnlock = t("ws.pricing.unlock", { tier: "Studio", price: formatTierPrice(TIER_FROM_PER_MONTH.studio) });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-baseline gap-2 text-2xl font-extrabold tracking-[-0.02em] text-white">
          {t("ws.data.title")}
          <span className="text-[length:var(--fs-caption)] font-semibold text-[#7486a1]">{t("ws.data.subtitle")}</span>
        </h1>
        <TierSwitcher onTier={onTier} tier={tier} />
      </div>

      <KpiRow cells={ACCOUNT_KPIS} />

      {tier === "free" ? <UpsellBanner onOpen={onUnlock} /> : null}

      <Panel title={t("ws.data.momentumTitle")}>
        <AreaTrend color="#2fbf71" fill="rgba(47,191,113,0.18)" points={genSeries(3, 26, 30, 92)} />
        <Cap>{t("ws.data.momentumCap")}</Cap>
      </Panel>

      <Panel title={<>{t("ws.data.topTitle")} <span className="text-[length:var(--fs-nano)] font-normal text-[#7486a1]">{t("ws.data.topHint")}</span></>}>
        {posts.length === 0 ? (
          <p className="py-4 text-center text-[length:var(--fs-micro)] text-[#7e90aa]">{t("ws.data.topEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {posts.slice(0, 3).map((p, i) => (
              <button
                className="flex w-full items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/[0.14]"
                key={p.id}
                onClick={() => onOpenPost(p.id)}
                type="button"
              >
                <span className="w-6 text-center text-[length:var(--fs-caption)] font-extrabold text-[#7486a1]">#{i + 1}</span>
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#0d1420]">
                  <ProgressiveImage alt={p.title} className="h-full w-full object-cover" fill sizes="40px" src={p.coverSrc} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--fs-caption)] font-semibold text-white">{p.title}</span>
                  <span className="mt-0.5 block truncate text-[length:var(--fs-micro)] text-[#7486a1]">
                    {t("ws.data.topRowMeta", { plays: TOP_CONTENT_PLAYS[i] ?? "—", backers: TOP_CONTENT_BACKERS[i] ?? "—" })}
                  </span>
                </span>
                <span className="shrink-0 text-[length:var(--fs-micro)] font-bold text-[#67b8ff]">{t("ws.data.seeAnalysis")}</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="starter" unlockLabel={starterUnlock}>
          <Panel badge="starter" title={t("ws.data.followerTitle")}>
            <AreaTrend color="#67b8ff" fill="rgba(103,184,255,0.18)" height={120} points={ACCOUNT_FOLLOWER_SERIES} />
            <Cap>{t("ws.data.followerCap")}</Cap>
          </Panel>
        </LockedPanel>

        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="starter" unlockLabel={starterUnlock}>
          <Panel badge="starter" title={t("ws.data.trafficTitle")}>
            <TrafficBars rows={ACCOUNT_TRAFFIC} />
            <Cap>{t("ws.data.trafficCap")}</Cap>
          </Panel>
        </LockedPanel>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="growth" unlockLabel={growthUnlock}>
          <Panel badge="growth" title={t("ws.data.rankTitle")}>
            <p className="mb-2 text-[length:var(--fs-micro)] text-[#93a2bb]">{t("ws.data.rankSub")}</p>
            <PercentileRows rows={ACCOUNT_PERCENTILES} />
            <Cap>{t("ws.data.rankCap")}</Cap>
          </Panel>
        </LockedPanel>

        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="growth" unlockLabel={growthUnlock}>
          <Panel badge="growth" title={t("ws.data.activeTitle")}>
            <WeekBars />
          </Panel>
        </LockedPanel>
      </div>

      <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="studio" unlockLabel={studioUnlock}>
        <Panel badge="studio" title={t("ws.data.studioTitle")}>
          <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-white/[0.06] pb-2 text-[length:var(--fs-micro)] text-[#7486a1]">
            <span>{t("ws.data.col.content")}</span>
            <span>{t("ws.data.col.plays")}</span>
            <span>{t("ws.data.col.engage")}</span>
            <span>{t("ws.data.col.backers")}</span>
          </div>
          {posts.slice(0, 3).map((p, i) => (
            <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-white/[0.04] py-2 text-[length:var(--fs-micro)]" key={p.id}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="relative h-4 w-6 shrink-0 overflow-hidden rounded bg-[#0d1420]">
                  <ProgressiveImage alt="" className="h-full w-full object-cover" fill sizes="24px" src={p.coverSrc} />
                </span>
                <span className="truncate text-[#cbd6e7]">{p.title}</span>
              </span>
              <span className="text-white">{TOP_CONTENT_PLAYS[i] ?? "—"}</span>
              <span className="text-white">{TOP_CONTENT_ENGAGE[i] ?? "—"}</span>
              <span className="font-bold text-[#f5b8ab]">{TOP_CONTENT_BACKERS[i] ?? "—"}</span>
            </div>
          ))}
          <div className="mt-3 flex gap-2">
            <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] text-[#cbd6e7]">{t("ws.data.exportCsv")}</span>
            <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] text-[#cbd6e7]">{t("ws.data.fullHistory")}</span>
          </div>
        </Panel>
      </LockedPanel>
    </div>
  );
};

/* ────────────────────────────  Per-post analytics  ──────────────────────────── */

const PostAnalytics = ({
  item,
  tier,
  onTier,
  onBack,
  onUnlock,
}: {
  item: WorkspaceContentItem;
  tier: AnalyticsTier;
  onTier: (t: AnalyticsTier) => void;
  onBack: () => void;
  onUnlock: () => void;
}) => {
  const { t } = useI18n();
  const [range, setRange] = useState<PlayRange>("24h");
  const starterUnlock = t("ws.pricing.unlock", { tier: "Starter", price: formatTierPrice(TIER_FROM_PER_MONTH.starter) });
  const growthUnlock = t("ws.pricing.unlock", { tier: "Growth", price: formatTierPrice(TIER_FROM_PER_MONTH.growth) });
  const studioUnlock = t("ws.pricing.unlock", { tier: "Studio", price: formatTierPrice(TIER_FROM_PER_MONTH.studio) });
  const rangeCap = range === "24h" ? t("ws.analytics.playCap24h") : range === "7d" ? t("ws.analytics.playCap7d") : t("ws.analytics.playCapAll");

  return (
    <div className="space-y-3.5">
      <button className="inline-flex items-center gap-1.5 text-[length:var(--fs-caption)] text-[#93a2bb] transition hover:text-white" onClick={onBack} type="button">
        {t("ws.analytics.back")}
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#0d1420]">
          <ProgressiveImage alt={item.title} className="h-full w-full object-cover" fill sizes="48px" src={item.coverSrc} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold leading-tight text-white">{item.title}</h2>
          <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7486a1]">{item.updatedAtLabel} · <span className="text-[#ffcaa0]">{t("ws.analytics.wasTrending")}</span></p>
        </div>
        <TierSwitcher onTier={onTier} tier={tier} />
      </div>

      <KpiRow cells={POST_KPIS} />

      {tier === "free" ? <UpsellBanner onOpen={onUnlock} /> : null}

      <Panel
        title={
          <span className="flex w-full items-center justify-between gap-2">
            {t("ws.analytics.playTitle")}
            <span className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
              {(["24h", "7d", "all"] as PlayRange[]).map((r) => (
                <button
                  className={`rounded-full px-2.5 py-0.5 text-[length:var(--fs-nano)] transition ${range === r ? "bg-white/[0.1] text-white" : "text-[#7e90aa] hover:text-white"}`}
                  key={r}
                  onClick={() => setRange(r)}
                  type="button"
                >
                  {t(`ws.analytics.range.${r}`)}
                </button>
              ))}
            </span>
          </span>
        }
      >
        <AreaTrend color="#2fbf71" fill="rgba(47,191,113,0.18)" points={playSeries(item.id, range)} />
        <Cap>{rangeCap}</Cap>
      </Panel>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Panel title={t("ws.analytics.hotTitle")}>
          <p className="text-[length:var(--fs-caption)]"><b className="text-[#ffcaa0]">{t("ws.analytics.hotMark")}</b> · {t("ws.analytics.hotBoard")}</p>
          <p className="mt-1.5 text-[length:var(--fs-micro)] text-[#93a2bb]">{t("ws.analytics.hotMeta")}</p>
          <div className="mt-2.5 h-2 rounded-full bg-white/[0.06]">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#f0795f,#de402a)]" style={{ marginLeft: "30%", width: "24%" }} />
          </div>
        </Panel>

        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="starter" unlockLabel={starterUnlock}>
          <Panel badge="starter" title={t("ws.analytics.trafficTitle")}>
            <TrafficBars rows={POST_TRAFFIC} />
            <Cap>{t("ws.analytics.trafficCap")}</Cap>
          </Panel>
        </LockedPanel>
      </div>

      <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="starter" unlockLabel={starterUnlock}>
        <Panel badge="starter" title={t("ws.analytics.followerTitle")}>
          <AreaTrend color="#67b8ff" fill="rgba(103,184,255,0.18)" height={120} points={followerSeries(item.id)} />
          <Cap>{t("ws.analytics.followerCap")}</Cap>
        </Panel>
      </LockedPanel>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="growth" unlockLabel={growthUnlock}>
          <Panel badge="growth" title={t("ws.analytics.rankTitle")}>
            <p className="mb-2 text-[length:var(--fs-micro)] text-[#93a2bb]">{t("ws.analytics.rankSub")}</p>
            <PercentileRows rows={POST_PERCENTILES} />
            <Cap>{t("ws.analytics.rankCap")}</Cap>
          </Panel>
        </LockedPanel>

        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="growth" unlockLabel={growthUnlock}>
          <Panel badge="growth" title={t("ws.analytics.retentionTitle")}>
            <AreaTrend color="#67b8ff" fill="rgba(103,184,255,0.18)" height={110} points={POST_RETENTION} />
            <Cap>{t("ws.analytics.retentionCap")}</Cap>
          </Panel>
        </LockedPanel>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="growth" unlockLabel={growthUnlock}>
          <Panel badge="growth" title={t("ws.analytics.funnelTitle")}>
            <div className="space-y-1.5">
              {POST_FUNNEL.map((r) => (
                <div className="flex items-center gap-2.5" key={r.labelKey}>
                  <span className="w-14 shrink-0 text-[length:var(--fs-micro)] text-[#93a2bb]">{t(r.labelKey)}</span>
                  <span className="h-6 flex-1 overflow-hidden rounded-[7px] bg-white/[0.05]">
                    <span className="block h-full rounded-[7px]" style={{ width: `${Math.max(r.pct, 5)}%`, background: r.color }} />
                  </span>
                  <span className="w-12 shrink-0 text-right text-[length:var(--fs-micro)] font-bold text-white">{r.value}</span>
                </div>
              ))}
            </div>
            <Cap>{t("ws.analytics.funnelCap")}</Cap>
          </Panel>
        </LockedPanel>

        <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="growth" unlockLabel={growthUnlock}>
          <Panel badge="growth" title={t("ws.analytics.bestTimeTitle")}>
            <WeekBars />
            <Cap>{t("ws.analytics.bestTimeCap")}</Cap>
          </Panel>
        </LockedPanel>
      </div>

      <LockedPanel currentTier={tier} onUnlock={onUnlock} requiredTier="studio" unlockLabel={studioUnlock}>
        <Panel badge="studio" title={t("ws.analytics.studioTitle")}>
          <p className="text-[length:var(--fs-micro)] leading-relaxed text-[#93a2bb]">{t("ws.analytics.studioBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["ws.analytics.chip1", "ws.analytics.chip2", "ws.analytics.chip3", "ws.analytics.chip4", "ws.analytics.chip5"].map((k) => (
              <span className="rounded-full border border-[#b890ff]/28 bg-[#b890ff]/[0.10] px-2.5 py-1 text-[length:var(--fs-micro)] text-[#cbb3ff]" key={k}>{t(k)}</span>
            ))}
          </div>
        </Panel>
      </LockedPanel>
    </div>
  );
};

/* ────────────────────────────  Pricing modal  ──────────────────────────── */

const PricingModal = ({
  currentTier,
  onChoose,
  onClose,
}: {
  currentTier: AnalyticsTier;
  onChoose: (t: AnalyticsTier) => void;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  const [annual, setAnnual] = useState(false);
  const [promo, setPromo] = useState(false);

  const choose = (tier: AnalyticsTier) => {
    onChoose(tier);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="my-8 w-full max-w-[920px] rounded-[20px] border border-white/[0.08] bg-[#0c121d] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xl font-extrabold text-white">{t("ws.pricing.title")}</p>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
              <button className={`rounded-full px-3 py-1 text-[length:var(--fs-micro)] transition ${!annual ? "bg-white/[0.1] text-white" : "text-[#93a2bb]"}`} onClick={() => setAnnual(false)} type="button">{t("ws.pricing.monthly")}</button>
              <button className={`rounded-full px-3 py-1 text-[length:var(--fs-micro)] transition ${annual ? "bg-white/[0.1] text-white" : "text-[#93a2bb]"}`} onClick={() => setAnnual(true)} type="button">{t("ws.pricing.annual")}</button>
            </div>
            <button
              className={`rounded-full border px-3 py-1.5 text-[length:var(--fs-micro)] font-bold transition ${promo ? "border-transparent bg-[#de402a] text-white" : "border-white/[0.1] bg-white/[0.04] text-[#93a2bb]"}`}
              onClick={() => setPromo((p) => !p)}
              type="button"
            >
              {t("ws.pricing.promoToggle")}
            </button>
            <button className="text-lg text-[#7486a1] transition hover:text-white" onClick={onClose} type="button" aria-label="close">✕</button>
          </div>
        </div>

        {promo ? (
          <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[#de402a]/30 bg-[#de402a]/[0.10] px-3.5 py-2.5">
            <span className="text-lg">🔥</span>
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--fs-micro)] font-bold text-[#f5b8ab]">{t("ws.pricing.promoBar")}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.1]">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,#f0795f,#de402a)]" style={{ width: "62%" }} />
              </div>
            </div>
            <p className="shrink-0 whitespace-nowrap text-right text-[length:var(--fs-nano)] text-[#f0a08f]">{t("ws.pricing.promoLock")}</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {TIER_ORDER.map((tier) => (
            <TierCard annual={annual} current={currentTier === tier} key={tier} onChoose={choose} promo={promo} tier={tier} />
          ))}
        </div>

        <p className="mt-4 text-[length:var(--fs-nano)] leading-relaxed text-[#7486a1]">{t("ws.pricing.footnote")}</p>
      </div>
    </div>
  );
};

const TierCard = ({
  tier,
  current,
  annual,
  promo,
  onChoose,
}: {
  tier: AnalyticsTier;
  current: boolean;
  annual: boolean;
  promo: boolean;
  onChoose: (t: AnalyticsTier) => void;
}) => {
  const { t } = useI18n();
  const def = TIER_PRICING[tier];
  const isFree = tier === "free";

  const perMo = annual ? (promo ? def.promoAnnualPerMo : def.annualPerMo) : promo ? def.promoMonthly : def.monthly;
  const annLine = annual
    ? t("ws.pricing.annualTotal", { total: formatTierPrice(promo ? def.promoAnnualTotal : def.annualTotal) })
    : t("ws.pricing.annualHint", { perMo: formatTierPrice(def.annualPerMo) });

  return (
    <div className={`flex flex-col rounded-[14px] border p-3.5 ${def.popular ? "border-[#de402a]/35 bg-[#de402a]/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[length:var(--fs-base)] font-extrabold capitalize text-white">{def.tier}</span>
        {def.popular ? <span className="rounded-full bg-[#de402a]/[0.18] px-2 py-0.5 text-[length:var(--fs-nano)] font-bold text-[#ff8a78]">{t("ws.pricing.popular")}</span> : null}
      </div>
      <p className="text-[length:var(--fs-nano)] text-[#7486a1]">{t(`ws.pricing.sub.${tier}`)}</p>

      <div className="mt-2">
        <p className="text-2xl font-extrabold text-white">{formatTierPrice(perMo)}<span className="text-[length:var(--fs-micro)] font-normal text-[#7486a1]">{t("ws.pricing.perMo")}</span></p>
        {isFree ? (
          <p className="mt-0.5 text-[length:var(--fs-nano)] text-[#7486a1]">{t("ws.pricing.foreverFree")}</p>
        ) : (
          <>
            <p className="mt-0.5 min-h-[16px] text-[length:var(--fs-nano)]">
              {promo ? (
                <>
                  <span className="text-[#7486a1] line-through">{formatTierPrice(def.monthly)}{t("ws.pricing.perMo")}</span>{" "}
                  <span className="rounded-full bg-[#de402a]/[0.16] px-1.5 py-px font-bold text-[#ff8a78]">{t("ws.pricing.save", { pct: annual ? "50%" : "40%" })}</span>
                </>
              ) : null}
            </p>
            <p className="mt-0.5 text-[length:var(--fs-nano)] text-[#7486a1]">{annLine}</p>
          </>
        )}
      </div>

      <ul className="mt-2.5 flex-1 space-y-1 text-[length:var(--fs-micro)] text-[#cbd6e7]">
        {def.featureKeys.map((k) => <li key={k}>{t(k)}</li>)}
      </ul>

      {current ? (
        <span className="mt-3 rounded-lg border border-white/[0.16] bg-white/[0.06] py-2 text-center text-[length:var(--fs-micro)] font-semibold text-[#9fb4d0]">{t("ws.pricing.current")}</span>
      ) : (
        <button
          className={`mt-3 rounded-lg py-2 text-center text-[length:var(--fs-micro)] font-bold capitalize transition ${isFree ? "border border-white/[0.16] bg-white/[0.06] text-[#c8d2e3] hover:bg-white/[0.1]" : "bg-[linear-gradient(180deg,#f05540,#de402a)] text-white hover:brightness-110"}`}
          onClick={() => onChoose(tier)}
          type="button"
        >
          {isFree ? t("ws.pricing.keepFree") : t("ws.pricing.choose", { tier: def.tier })}
        </button>
      )}
    </div>
  );
};
