import Link from "next/link";
import { startTransition, useMemo, useState } from "react";

import { MomentumLine } from "@/components/shared/MomentumLine";
import { StagePill } from "@/components/shared/StagePill";
import { CreatorMarketRecord, PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { compactNumber } from "@/lib/public-data";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";
import { CREATOR_CATEGORIES, CreatorCategory, creatorCampaignByName, resolveCreatorMarketSeed } from "@/lib/mocks/marketSeed";

type DiscoverTab = "trending" | "new" | "graduating" | "s2";

const GRADUATION_THRESHOLD = 80;
const MOVERS_COUNT = 4;
const ALL_CATEGORIES = "__all__";

// Join by id or stable display name (feed slugifies CJK names → id won't match).
const creatorCategory = (creator: CreatorMarketRecord): CreatorCategory | null =>
  resolveCreatorMarketSeed(creator.id, creator.name)?.category ?? null;
const creatorDelta = (creator: CreatorMarketRecord): number => creator.momentumDelta7d ?? 0;

const DerivedBadge = ({ label }: { label: string }) => (
  <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.14em] text-[#7486a1]">
    {label}
  </span>
);

// A projection timestamp distinguishes a real on-chain zero from missing data.
// Numeric checks cannot do that because a newly registered creator legitimately
// starts at zero supply, holders, and graduation progress.
const hasMarketProjection = (creator: CreatorMarketRecord) =>
  Boolean(creator.marketProjectionUpdatedAt);

// Deterministic momentum wave from contentPool length + momentumScore.
// No Math.random() — a stable sparkline that reads as a signal, not a price.
const momentumPoints = (creator: CreatorMarketRecord): number[] => {
  if (creator.momentumScore <= 0 || creator.contentPool.length < 2) return [];
  const n = creator.contentPool.length;
  return creator.contentPool.map((_, i) => {
    const phase = (i / (n - 1)) * Math.PI;
    return Math.max(0, Math.min(100, creator.momentumScore * (0.85 + 0.15 * Math.sin(phase + i * 0.7))));
  });
};

// Where can this card route? Only resolvable-wallet creators are backable
// (→ real /market). Everyone else gets an honest "view creator" link.
const creatorHref = (creator: CreatorMarketRecord) => {
  const wallet = resolveCreatorWalletForRoute(creator.id);
  return wallet ? `/market/${wallet}` : `/creators/${creator.id}`;
};
// S2 creators with a seeded campaign route to the on-chain proof page; everyone
// else routes to their market/creator page.
const resolveCardHref = (creator: CreatorMarketRecord) => {
  if (creator.state === "S2_ACTIVE") {
    const campaignId = creatorCampaignByName[creator.name];
    if (campaignId) return `/campaigns/${campaignId}`;
  }
  return creatorHref(creator);
};
const isBackable = (creator: CreatorMarketRecord) => resolveCreatorWalletForRoute(creator.id) !== null;

export const DiscoverBoard = ({
  creators,
}: {
  creators: CreatorMarketRecord[];
  postsByCreator?: Map<string, PostRecord[]>;
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<DiscoverTab>("trending");
  const [activeCategory, setActiveCategory] = useState<CreatorCategory | typeof ALL_CATEGORIES>(ALL_CATEGORIES);

  const sorted = useMemo(
    () => [...creators].sort((a, b) => b.momentumScore - a.momentumScore),
    [creators],
  );

  // Featured: highest graduation if any has a real projection, else highest
  // momentum. The badge copy adapts so we never claim "graduating" falsely.
  const featured = useMemo(() => {
    const byGraduation = [...creators]
      .filter((c) => c.state !== "S2_ACTIVE" && c.graduationProgress > 0)
      .sort((a, b) => b.graduationProgress - a.graduationProgress);
    return byGraduation[0] ?? sorted[0] ?? null;
  }, [creators, sorted]);

  const movers = useMemo(() => sorted.slice(0, MOVERS_COUNT), [sorted]);

  // Real category chips (fixed enum) — only categories actually present among
  // the loaded creators are shown, in the canonical CREATOR_CATEGORIES order.
  const categories = useMemo(() => {
    const present = new Set(sorted.map((c) => creatorCategory(c)).filter(Boolean) as CreatorCategory[]);
    return CREATOR_CATEGORIES.filter((cat) => present.has(cat));
  }, [sorted]);

  const tabFiltered = useMemo(() => {
    if (activeTab === "new") {
      return sorted.filter((c) => c.state === "S1_DISCOVERY");
    }
    if (activeTab === "graduating") {
      return sorted.filter((c) => c.state !== "S2_ACTIVE" && c.graduationProgress >= GRADUATION_THRESHOLD);
    }
    if (activeTab === "s2") {
      return sorted.filter((c) => c.state === "S2_ACTIVE");
    }
    return sorted;
  }, [sorted, activeTab]);

  const visible = useMemo(
    () =>
      activeCategory === ALL_CATEGORIES
        ? tabFiltered
        : tabFiltered.filter((c) => creatorCategory(c) === activeCategory),
    [tabFiltered, activeCategory],
  );

  const tabs: { id: DiscoverTab; label: string; sub?: string }[] = [
    { id: "trending", label: t("discover.tab.trending"), sub: "Trending" },
    { id: "new", label: t("discover.tab.new"), sub: "New" },
    { id: "graduating", label: t("discover.tab.graduating"), sub: "Graduating" },
    { id: "s2", label: t("discover.tab.s2") },
  ];

  if (sorted.length === 0) {
    return (
      <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.02] p-6 text-center text-xs text-[#8ea0ba]">
        {t("discover.noCreators")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div className="px-1">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-white">
          {t("discover.slogan")}
        </h1>
        <p className="mt-1 text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          Spot them early. Back them with conviction, not cash. · {t("discover.sloganSub")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              className={`rounded-full border px-4 py-2 text-[length:var(--fs-caption)] font-semibold transition ${
                active
                  ? "border-[color:color-mix(in_srgb,var(--brand)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand)_16%,transparent)] text-[#f5b8ab]"
                  : "border-white/[0.08] bg-white/[0.04] text-[#c8d2e3] hover:border-white/[0.16] hover:text-white"
              }`}
              key={tab.id}
              onClick={() => startTransition(() => setActiveTab(tab.id))}
              type="button"
            >
              {tab.label}
              {tab.sub ? <span className="ml-1.5 text-[length:var(--fs-nano)] opacity-55">{tab.sub}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Featured hero + movers */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {featured ? <FeaturedCard creator={featured} /> : null}
        {movers.length > 0 ? (
          <div className="shrink-0 rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(20,28,41,0.84)_0%,rgba(11,16,25,0.80)_100%)] p-4 lg:w-64">
            <p className="mb-3 text-[length:var(--fs-caption)] font-semibold text-[#93a2bb]">
              {t("discover.moversHeadingMomentum")}
            </p>
            <div className="divide-y divide-white/[0.04]">
              {movers.map((mover) => (
                <Link
                  className="flex items-center gap-2.5 py-2.5 transition hover:opacity-80"
                  href={resolveCardHref(mover)}
                  key={mover.id}
                >
                  <img alt={mover.name} className="h-7 w-7 shrink-0 rounded-lg object-cover" src={mover.avatarSrc} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[length:var(--fs-micro)] font-semibold text-white">{mover.name}</p>
                    <p className="truncate text-[length:var(--fs-nano)] text-[#7e90aa]">{mover.niche}</p>
                  </div>
                  <span className="shrink-0 text-[length:var(--fs-micro)] font-bold text-white">{mover.momentumScore}</span>
                </Link>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[length:var(--fs-nano)] text-[#5a6d87]">
              <DerivedBadge label={t("feed.trending.derived")} />
              <span>{t("discover.trendCaption")}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Category chips (real categories, not hashtags) */}
      {categories.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[length:var(--fs-nano)] text-[#5a6d87]">{t("discover.filterBy")}</span>
          <button
            className={`rounded-full border px-3.5 py-1 text-[length:var(--fs-micro)] font-medium transition ${
              activeCategory === ALL_CATEGORIES
                ? "border-white/[0.25] bg-white/[0.12] text-white"
                : "border-white/[0.08] bg-white/[0.02] text-[#8ea0ba] hover:border-white/[0.14] hover:text-white"
            }`}
            onClick={() => startTransition(() => setActiveCategory(ALL_CATEGORIES))}
            type="button"
          >
            {t("discover.allNiches")}
          </button>
          {categories.map((cat) => (
            <button
              className={`rounded-full border px-3.5 py-1 text-[length:var(--fs-micro)] font-medium transition ${
                activeCategory === cat
                  ? "border-[color:color-mix(in_srgb,var(--brand)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand)_12%,transparent)] text-[color:var(--brand)]"
                  : "border-white/[0.08] bg-white/[0.02] text-[#8ea0ba] hover:border-white/[0.14] hover:text-white"
              }`}
              key={cat}
              onClick={() => startTransition(() => setActiveCategory(cat))}
              type="button"
            >
              {t(`discover.category.${cat}`)}
            </button>
          ))}
        </div>
      ) : null}

      {/* Card grid */}
      {visible.length === 0 ? (
        <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.02] p-6 text-center text-xs text-[#8ea0ba]">
          {activeTab === "graduating"
            ? t("discover.emptyGraduating")
            : activeTab === "s2"
              ? t("discover.emptyS2")
              : t("discover.noCreators")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((creator) => (
            <CreatorCard creator={creator} key={creator.id} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────  Featured hero  ────────────────────────────── */

const FeaturedCard = ({ creator }: { creator: CreatorMarketRecord }) => {
  const { t } = useI18n();
  const projection = hasMarketProjection(creator);
  const graduating = creator.state !== "S2_ACTIVE" && creator.graduationProgress > 0;
  const href = resolveCardHref(creator);

  return (
    <div className="relative flex-1 overflow-hidden rounded-[24px] border border-white/[0.14] bg-[linear-gradient(160deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.3)]">
      <div className="flex flex-col gap-4 sm:flex-row">
        <img
          alt={creator.name}
          className="h-[120px] w-[120px] shrink-0 rounded-[16px] border border-white/[0.1] object-cover sm:h-[150px] sm:w-[150px]"
          src={creator.heroSrc || creator.avatarSrc}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#de402a] shadow-[0_0_10px_#de402a]" />
            <span className="text-[length:var(--fs-micro)] font-semibold text-[#f0a08f]">
              {graduating ? t("discover.featuredGraduating") : t("discover.featuredMomentum")}
            </span>
            <StagePill compact stage={creator.state} />
          </div>
          <p className="mt-1.5 truncate text-[28px] font-extrabold leading-none tracking-[-0.02em] text-white">{creator.name}</p>
          <p className="mt-1 truncate text-[length:var(--fs-caption)] text-[#93a2bb]">{creator.niche} · {creator.city}</p>
          {creator.teaser ? <p className="mt-2 line-clamp-1 text-[length:var(--fs-caption)] italic text-[#c8d2e3]">“{creator.teaser}”</p> : null}

          <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3">
            <div>
              <p className="text-[length:var(--fs-nano)] text-[#5a6d87]">{t("discover.momentumLabel")}</p>
              <p className="text-[26px] font-extrabold leading-none text-white">{creator.momentumScore || "—"}</p>
            </div>
            <div>
              <p className="text-[length:var(--fs-nano)] text-[#5a6d87]">{t("discover.backersLabel")}</p>
              <p className="text-[26px] font-extrabold leading-none text-white">
                {projection ? compactNumber(creator.holderCount) : "—"}
              </p>
            </div>
            <div className="min-w-[120px] flex-1">
              <p className="mb-1.5 text-[length:var(--fs-nano)] text-[#5a6d87]">
                {t("discover.graduationLabel")} {projection ? `${creator.graduationProgress}%` : "—"}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] via-[#ffb38a] to-[#de402a]"
                  style={{ width: `${Math.min(100, creator.graduationProgress)}%` }}
                />
              </div>
            </div>
            <Link
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-6 text-[length:var(--fs-caption)] font-bold text-white shadow-[0_14px_30px_rgba(222,64,42,0.3)] transition hover:brightness-110"
              href={href}
            >
              {isBackable(creator) ? t("discover.backCta") : `${t("backing.viewCreator")} →`}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────  Creator card  ────────────────────────────── */

const CreatorCard = ({ creator }: { creator: CreatorMarketRecord }) => {
  const { t } = useI18n();
  const projection = hasMarketProjection(creator);
  const points = momentumPoints(creator);
  const href = resolveCardHref(creator);
  const backable = isBackable(creator);
  const isS2 = creator.state === "S2_ACTIVE";
  const delta = creatorDelta(creator);

  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-[18px] border border-white/[0.1] bg-[linear-gradient(160deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.025)_100%)] shadow-[0_14px_40px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:border-white/[0.22]"
      href={href}
    >
      {/* Cover */}
      <div className="relative h-[84px] overflow-hidden">
        <img
          alt={creator.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          src={creator.heroSrc || creator.avatarSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(15,21,32,0.85)_100%)]" />
        <div className="absolute left-2.5 top-2.5">
          <StagePill compact stage={creator.state} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-2.5">
          <img alt={creator.name} className="h-[30px] w-[30px] shrink-0 rounded-[9px] border border-white/[0.12] object-cover" src={creator.avatarSrc} />
          <div className="min-w-0">
            <p className="truncate text-[length:var(--fs-caption)] font-bold text-white">{creator.name}</p>
            <p className="truncate text-[length:var(--fs-nano)] text-[#7e90aa]">{creator.niche}</p>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[length:var(--fs-nano)] text-[#7e90aa]">{t("discover.momentumLabel")}</p>
            <p className="text-[20px] font-extrabold leading-none text-white">{creator.momentumScore || "—"}</p>
          </div>
          {isS2 ? (
            <span className="text-[length:var(--fs-micro)] font-bold text-[#7ce0b0]">{t("discover.sponsoring")}</span>
          ) : delta > 0 ? (
            <div className="text-right">
              <p className="text-[length:var(--fs-nano)] text-[#7e90aa]">{t("discover.thisWeek")}</p>
              <p className="text-[length:var(--fs-caption)] font-bold text-[#2fbf71]">↗ +{delta}</p>
            </div>
          ) : (
            <DerivedBadge label={t("feed.trending.derived")} />
          )}
        </div>

        {points.length > 1 ? (
          <div className="mt-2.5">
            <MomentumLine height={26} points={points} />
          </div>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between text-[length:var(--fs-nano)] text-[#7e90aa]">
          <span>👥 {projection ? compactNumber(creator.holderCount) : "—"} {t("discover.backersLabel")}</span>
          <span>{t("discover.graduationLabel")} {projection ? `${creator.graduationProgress}%` : "—"}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
          <div
            className={`h-full rounded-full ${isS2 ? "bg-[#65ecaf]" : "bg-gradient-to-r from-[#67b8ff] to-[#de402a]"}`}
            style={{ width: `${Math.min(100, creator.graduationProgress)}%` }}
          />
        </div>

        <span
          className={`mt-3 flex h-9 items-center justify-center gap-1.5 rounded-full text-[length:var(--fs-caption)] font-bold transition ${
            isS2
              ? "border border-white/[0.16] bg-white/[0.05] text-[#f5f7fb]"
              : backable
                ? "bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] text-white"
                : "border border-white/[0.12] bg-white/[0.03] text-[#8ea0ba] group-hover:text-white"
          }`}
        >
          {isS2 ? t("discover.viewCampaign") : backable ? t("discover.backCta") : `${t("backing.viewCreator")} →`}
        </span>
      </div>
    </Link>
  );
};
