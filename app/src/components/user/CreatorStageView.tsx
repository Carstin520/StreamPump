import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ArrowDownIcon, ArrowUpIcon, FollowCheckIcon, FollowPlusIcon } from "@/components/shared/AppIcons";
import { MomentumLine } from "@/components/shared/MomentumLine";
import { MomentumMeter } from "@/components/shared/MomentumMeter";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { CreatorMarketRecord, PostRecord } from "@/lib/api/types";
import { requireInteractiveSession } from "@/lib/interaction-auth";
import { compactNumber } from "@/lib/public-data";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";
import { useI18n } from "@/lib/i18n";

type ProfileTab = "Posts" | "Investment File" | "Signals";

const TABS: ProfileTab[] = ["Posts", "Investment File", "Signals"];

const TAB_I18N_KEYS: Record<ProfileTab, string> = {
  "Posts": "creator.tabs.posts",
  "Investment File": "creator.tabs.investmentFile",
  "Signals": "creator.tabs.signals",
};

const SPUMP_PER_USD = 40;

export const CreatorStageView = ({
  creator,
  posts = [],
}: {
  creator: CreatorMarketRecord;
  posts?: PostRecord[];
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("Posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [buyAmount, setBuyAmount] = useState(5);

  const creatorPosts = useMemo(
    () => posts.filter((post) => post.creatorId === creator.id),
    [creator.id, posts],
  );

  const market = useMemo(() => buildMarketModel(creator), [creator]);
  const buyPreview = useMemo(
    () => previewBuy(market, buyAmount),
    [market, buyAmount],
  );

  return (
    <div className="space-y-3.5 pb-10">
      <ProfileHero
        creator={creator}
        isFollowing={isFollowing}
        market={market}
        onToggleFollow={() => {
          if (!requireInteractiveSession(router)) {
            return;
          }

          setIsFollowing((value) => !value);
        }}
      />

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3.5">
          <MomentumPanel creator={creator} market={market} />
          <MarketStatsBar creator={creator} market={market} />
          <LifecycleTimeline creator={creator} market={market} />
          <ContentSurface
            activeTab={activeTab}
            creator={creator}
            posts={creatorPosts}
            onTabChange={setActiveTab}
          />
        </div>

        <aside className="space-y-3.5 lg:sticky lg:top-6 lg:self-start">
          <BuyPanel
            buyAmount={buyAmount}
            buyPreview={buyPreview}
            creator={creator}
            market={market}
            onBuyAmountChange={setBuyAmount}
            onRequireAuth={() => requireInteractiveSession(router)}
          />
          {creator.state === "S1_BUYOUT" && creator.buyoutOfferUsd ? <BuyoutOfferCard creator={creator} /> : null}
          <TopHoldersCard creator={creator} />
        </aside>
      </div>
    </div>
  );
};

/* ──────────────────────────  Market model  ────────────────────────── */

type MarketModel = {
  priceSpump: number;
  nextPriceSpump: number;
  change24hPct: number;
  supply: number;
  maxSupply: number;
  graduationPct: number;
  holders: number;
  fans: number;
  supporterPoolUsd: number;
  targetPriceSpump: number;
  liquiditySpump: number;
  state: CreatorMarketRecord["state"];
  level: number;
  levelLabel: string;
  levelKey: string;
};

const buildMarketModel = (creator: CreatorMarketRecord): MarketModel => {
  const hasMarketProjection = creator.tokenPrice > 0 && creator.supply > 0;
  const priceSpump = hasMarketProjection ? Math.round(creator.tokenPrice * SPUMP_PER_USD) : 0;
  const targetPriceSpump = hasMarketProjection
    ? Math.max(priceSpump + 8, Math.round(creator.targetGraduationPrice * SPUMP_PER_USD))
    : 0;
  const supply = creator.supply;
  const maxSupply = hasMarketProjection ? Math.max(supply * 1.6, supply + 5_000) : 1;
  const change24hPct = hasMarketProjection
    ? Number(((creator.momentumScore - 70) * 0.18).toFixed(2))
    : 0;
  const nextPriceSpump = hasMarketProjection ? Math.round(priceSpump * 1.012) : 0;
  const supporterPoolUsd = creator.supporterDistributableUsd ?? 0;
  const liquiditySpump = Math.round(priceSpump * supply * 0.18);
  const level = creator.state === "S2_ACTIVE" ? 5 : creator.state === "S1_BUYOUT" ? 3 : 2;
  const levelLabel = levelDescriptor(creator);
  const levelKeyValue = levelKey(creator);

  return {
    priceSpump,
    nextPriceSpump,
    change24hPct,
    supply,
    maxSupply,
    graduationPct: creator.graduationProgress,
    holders: creator.holderCount,
    fans: creator.followersCount,
    supporterPoolUsd,
    targetPriceSpump,
    liquiditySpump,
    state: creator.state,
    level,
    levelLabel,
    levelKey: levelKeyValue,
  };
};

const LEVEL_KEYS: Record<string, string> = {
  "S2_ACTIVE": "creator.level.graduatedSponsorActive",
  "S1_BUYOUT": "creator.level.buyoutWatch",
  "rising": "creator.level.risingCreator",
  "discovery": "creator.level.discoveryStage",
  "early": "creator.level.earlyDiscovery",
};

const levelDescriptor = (creator: CreatorMarketRecord): string => {
  if (creator.state === "S2_ACTIVE") return "Graduated · Sponsor Active";
  if (creator.state === "S1_BUYOUT") return "Buyout Watch";
  if (creator.graduationProgress >= 60) return "Rising Creator";
  if (creator.graduationProgress >= 30) return "Discovery Stage";
  return "Early Discovery";
};

const levelKey = (creator: CreatorMarketRecord): string => {
  if (creator.state === "S2_ACTIVE") return LEVEL_KEYS["S2_ACTIVE"];
  if (creator.state === "S1_BUYOUT") return LEVEL_KEYS["S1_BUYOUT"];
  if (creator.graduationProgress >= 60) return LEVEL_KEYS["rising"];
  if (creator.graduationProgress >= 30) return LEVEL_KEYS["discovery"];
  return LEVEL_KEYS["early"];
};

const previewBuy = (market: MarketModel, amount: number) => {
  const safe = Math.max(0, Math.min(Math.floor(amount), 200));
  const slippageMultiplier = 1 + safe * 0.0008;
  const avgPrice = market.priceSpump * slippageMultiplier;
  const cost = Math.round(avgPrice * safe);
  const newSupply = market.supply + safe;
  const priceAfter = Math.round(market.priceSpump * (1 + safe * 0.0016));

  return {
    amount: safe,
    avgPrice: Math.round(avgPrice),
    cost,
    priceAfter,
    newSupply,
  };
};

type BuyPreview = ReturnType<typeof previewBuy>;

/* ──────────────────────────  Hero  ────────────────────────── */

const ProfileHero = ({
  creator,
  isFollowing,
  market,
  onToggleFollow,
}: {
  creator: CreatorMarketRecord;
  isFollowing: boolean;
  market: MarketModel;
  onToggleFollow: () => void;
}) => {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,20,30,0.94)_0%,rgba(9,13,20,0.94)_100%)]">
      <div className="relative h-36 md:h-44">
        <ProgressiveImage
          alt={`${creator.name} banner`}
          className="h-full w-full object-cover"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
          src={creator.heroSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,18,0.05)_0%,rgba(7,11,18,0.42)_55%,rgba(7,11,18,0.96)_100%)]" />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <StatusBadge market={market} />
        </div>
      </div>

      <div className="relative -mt-10 flex flex-col gap-3 px-5 pb-5 md:flex-row md:items-end md:gap-5 md:px-6 md:pb-5">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#0b1119] bg-[#0b1119] shadow-[0_14px_36px_rgba(0,0,0,0.5)] md:h-22 md:w-22">
          <img alt={creator.name} className="h-full w-full object-cover" src={creator.avatarSrc} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[length:var(--fs-nano)] uppercase tracking-[0.22em] text-[#7486a1]">
            <span>{t("creator.levelLabel", { level: market.level })}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span className="truncate">{t(market.levelKey)}</span>
          </div>
          <h1 className="type-h3 mt-1.5 truncate font-semibold text-white">
            {creator.name}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-[#92a3bc]">
            <span className="truncate">{creator.handle}</span>
            <span className="text-[#3e4a5e]">·</span>
            <span className="truncate">{creator.city}</span>
            <span className="text-[#3e4a5e]">·</span>
            <span className="truncate text-[#7486a1]">{creator.niche}</span>
          </div>
          <p className="mt-2 line-clamp-2 max-w-[640px] text-xs leading-5 text-[#bcc8de]">
            {creator.intro}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            className="liquid-glass-btn rounded-full px-4 py-2 text-xs text-white transition hover:bg-white/[0.08]"
            type="button"
          >
            {t("creator.message")}
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
              isFollowing
                ? "border border-white/10 bg-[#13291f] text-[#90efac]"
                : "bg-[#de402a] text-white hover:bg-[#ea523e]"
            }`}
            onClick={onToggleFollow}
            type="button"
          >
            {isFollowing ? <FollowCheckIcon className="h-3.5 w-3.5" /> : <FollowPlusIcon className="h-3.5 w-3.5" />}
            {isFollowing ? t("creator.following") : t("creator.follow")}
          </button>
        </div>
      </div>
    </section>
  );
};

const StatusBadge = ({ market }: { market: MarketModel }) => {
  if (market.state === "S2_ACTIVE") {
    return (
      <span className="tone-stage-s2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--stage-s2)]" />
        S2 Profile
      </span>
    );
  }
  if (market.state === "S1_BUYOUT") {
    return (
      <span className="tone-stage-buyout flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--stage-buyout)] opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--stage-buyout)]" />
        </span>
        Buyout Watch
      </span>
    );
  }
  return (
    <span className="tone-stage-s1 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--stage-s1)]" />
      S1 Profile · {market.graduationPct}%
    </span>
  );
};

/* ──────────────────────────  Market stats  ────────────────────────── */

const MarketStatsBar = ({
  creator,
  market,
}: {
  creator: CreatorMarketRecord;
  market: MarketModel;
}) => {
  const { t } = useI18n();
  const positive = market.change24hPct >= 0;

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,22,33,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
      <div className="grid grid-cols-3 divide-x divide-white/[0.05] lg:grid-cols-6">
        {/* Momentum is the real primary stat */}
        <MomentumCell creator={creator} />
        <PriceCell market={market} />
        <StatCell label={t("market.holders")}>{compactNumber(market.holders)}</StatCell>
        <StatCell label={t("market.s1Supply")}>{compactNumber(market.supply)}</StatCell>
        <StatCell label={t("market.pool")}>
          {market.supporterPoolUsd ? `$${compactNumber(market.supporterPoolUsd)}` : "—"}
        </StatCell>
        <StatCell label={t("market.graduation")}>
          <span className="flex items-center gap-1.5">
            <span>{market.graduationPct}%</span>
            <span className="h-1 w-8 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-[#de402a] to-[#ff8a78]"
                style={{ width: `${Math.min(100, market.graduationPct)}%` }}
              />
            </span>
          </span>
        </StatCell>
      </div>
      <div className="border-t border-white/[0.04] px-4 py-1.5 text-[length:var(--fs-micro)] text-[#6f8099]">
        <span className="text-[#7486a1]">Niche</span>
        <span className="ml-2 text-[#c8d3e6]">{creator.niche}</span>
        <span className="ml-4 text-[#7486a1]">Tags</span>
        <span className="ml-2 text-[#c8d3e6]">{creator.tags.slice(0, 3).map((tag) => `#${tag}`).join("  ")}</span>
      </div>
    </section>
  );
};

const MomentumCell = ({ creator }: { creator: CreatorMarketRecord }) => {
  const { t } = useI18n();

  return (
    <div className="min-w-0 px-3.5 py-2.5">
      <p className="truncate text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
        {t("creator.momentumHeadline")}
      </p>
      <p className="mt-1 whitespace-nowrap text-lg font-semibold tracking-[-0.04em]" style={{ color: "var(--brand)" }}>
        {creator.momentumScore}
        <span className="ml-1 text-[length:var(--fs-micro)] font-medium text-[#7486a1]">/100</span>
      </p>
    </div>
  );
};

const PriceCell = ({ market }: { market: MarketModel }) => {
  const { t } = useI18n();

  return (
    <div className="min-w-0 px-3.5 py-2.5">
      <p className="truncate text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
        {t("market.positionPrice")}
      </p>
      <p className="mt-1 whitespace-nowrap text-sm font-semibold tracking-[-0.03em] text-white">
        {market.priceSpump > 0 ? (
          <>
            {market.priceSpump}
            <span className="ml-1 text-[length:var(--fs-micro)] font-medium text-[#7486a1]">SPUMP</span>
          </>
        ) : (
          <span className="text-[#7486a1]">—</span>
        )}
      </p>
      <p className="mt-0.5 text-[length:var(--fs-micro)] leading-tight text-[#5a6b82]">
        {t("market.positionPriceDisclaimer")}
      </p>
    </div>
  );
};

const StatCell = ({
  children,
  label,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  tone?: "neutral" | "positive" | "negative";
}) => (
  <div className="min-w-0 px-3.5 py-2.5">
    <p className="truncate text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">{label}</p>
    <div
      className={`mt-1 whitespace-nowrap text-sm font-semibold tracking-[-0.02em] ${
        tone === "positive"
          ? "text-[color:var(--state-success)]"
          : tone === "negative"
            ? "text-[color:var(--state-danger)]"
            : "text-white"
      }`}
    >
      {children}
    </div>
  </div>
);

/* ──────────────────────────  Momentum panel (replaces price chart)  ────────────────────────── */

/**
 * Build a deterministic momentum trend from momentumScore + contentPool length.
 * NO Math.random — points are derived from stable creator fields only.
 */
const buildMomentumPoints = (momentumScore: number, contentCount: number): number[] => {
  const base = Math.max(10, Math.min(100, momentumScore));
  const count = Math.max(2, Math.min(8, contentCount));
  // Spread over 24 fixed steps, seeded from base + count
  const points: number[] = [];
  for (let i = 0; i < 24; i++) {
    // Deterministic oscillation around base using trigonometry seeded by count
    const phase = (i / 23) * Math.PI * 2 * (1 + (count % 3) * 0.25);
    const wave = Math.sin(phase + count) * (base * 0.14);
    const trend = (i / 23) * (base * 0.08); // slight upward drift toward current score
    points.push(Math.max(1, Math.min(100, Math.round(base - base * 0.18 + wave + trend))));
  }
  // Last point = actual current momentum
  points[points.length - 1] = base;
  return points;
};

const MomentumPanel = ({
  creator,
  market,
}: {
  creator: CreatorMarketRecord;
  market: MarketModel;
}) => {
  const { t } = useI18n();
  const hasMarketProjection = market.priceSpump > 0 && market.supply > 0;
  const momentumPoints = useMemo(
    () => buildMomentumPoints(creator.momentumScore, creator.contentPool.length),
    [creator.momentumScore, creator.contentPool.length],
  );

  if (!hasMarketProjection) {
    return (
      <section className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,22,33,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
        <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <div>
            <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.2em] text-[#7486a1]">
              {t("creator.momentumHeadline")}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">{t("creator.noProjection")}</h3>
          </div>
          <span className="tone-state-warning rounded-full border px-2.5 py-1 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.14em]">
            {t("creator.contentOnly")}
          </span>
        </header>
        <div className="px-4 py-10 text-center text-xs leading-5 text-[#8ea0ba]">
          This public profile is derived from feed content. S1 势能/供应, holders, and graduation history require CreatorMarketProjection from the market API.
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,21,32,0.88)_0%,rgba(10,15,23,0.88)_100%)] p-4 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
            {t("creator.momentumSubhead")}
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-white">
            {t("creator.momentumProjection")}
          </h2>
        </div>
        {/* Momentum score as primary headline number */}
        <div className="flex items-end gap-3">
          <div className="text-right">
            <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.16em] text-[#6f8099]">
              {t("creator.momentumHeadline")}
            </p>
            <p className="mt-0.5 text-xl font-semibold tracking-[-0.03em]" style={{ color: "var(--brand)" }}>
              {creator.momentumScore}
              <span className="ml-1 text-[length:var(--fs-micro)] font-medium text-[#7486a1]">/100</span>
            </p>
          </div>
          <MomentumMeter
            className="w-24"
            value={creator.momentumScore}
            max={100}
            tone="momentum"
          />
        </div>
      </header>

      <div className="mt-4">
        <MomentumLine
          caption={t("creator.momentumChartCaption")}
          height={180}
          points={momentumPoints}
        />
      </div>
    </section>
  );
};

/* ──────────────────────────  Buy panel  ────────────────────────── */

const BuyPanel = ({
  buyAmount,
  buyPreview,
  creator,
  market,
  onBuyAmountChange,
  onRequireAuth,
}: {
  buyAmount: number;
  buyPreview: BuyPreview;
  creator: CreatorMarketRecord;
  market: MarketModel;
  onBuyAmountChange: (value: number) => void;
  onRequireAuth: () => boolean;
}) => {
  const { t } = useI18n();
  const [pulse, setPulse] = useState(false);
  const disabled = market.state !== "S1_DISCOVERY";
  const hasMarketProjection = market.priceSpump > 0 && market.supply > 0;
  const previewDisabled = disabled || !hasMarketProjection;
  const liveCreatorWallet = resolveCreatorWalletForRoute(creator.id);
  const currentHolding = 0;
  const futureHolding = currentHolding + buyPreview.amount;

  useEffect(() => {
    if (!pulse) return;
    const id = window.setTimeout(() => setPulse(false), 320);
    return () => window.clearTimeout(id);
  }, [pulse]);

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(18,25,37,0.92)_0%,rgba(11,17,27,0.92)_100%)]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
            {t("market.positionAccess")}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">
            {liveCreatorWallet ? t("market.seededMarket") : !hasMarketProjection ? t("market.contentSignalsOnly") : disabled ? t("market.previewMode") : t("market.previewPosition")}
          </h3>
        </div>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#8ea0ba]">
          {hasMarketProjection ? `1 S1 ≈ ${market.priceSpump} SPUMP` : t("market.projectionPending")}
        </span>
      </header>

      <div className="space-y-3 px-4 py-4">
        <div>
          <div className="flex items-center justify-between text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-[#6f8099]">
            <span>{t("market.amount")}</span>
            <span className="text-[#8ea0ba]">{t("market.maxAmount")}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              className="liquid-glass-btn h-8 w-8 shrink-0 rounded-xl text-base text-white transition hover:bg-white/[0.08]"
              onClick={() => onBuyAmountChange(Math.max(1, buyAmount - 1))}
              type="button"
            >
              −
            </button>
            <input
              className="input-glass h-10 w-full rounded-xl bg-transparent px-3 text-center text-xl font-semibold tracking-[-0.02em] text-white outline-none"
              max={200}
              min={1}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                onBuyAmountChange(Math.max(0, Math.min(200, Math.floor(next))));
              }}
              type="number"
              value={buyAmount}
            />
            <button
              className="liquid-glass-btn h-8 w-8 shrink-0 rounded-xl text-base text-white transition hover:bg-white/[0.08]"
              onClick={() => onBuyAmountChange(Math.min(200, buyAmount + 1))}
              type="button"
            >
              +
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {[5, 10, 25, 50].map((preset) => (
              <button
                className={`flex-1 rounded-full border px-2 py-1 text-[length:var(--fs-micro)] font-medium transition ${
                  buyAmount === preset
                    ? "border-[#de402a]/40 bg-[#de402a]/[0.12] text-[#ff8a78]"
                    : "border-white/[0.06] bg-white/[0.03] text-[#8ea0ba] hover:bg-white/[0.06] hover:text-white"
                }`}
                key={preset}
                onClick={() => onBuyAmountChange(preset)}
                type="button"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <SummaryRow label="平均投入" value={hasMarketProjection ? `${buyPreview.avgPrice} SPUMP` : "—"} />
          <SummaryRow accent label={t("market.estCost")} value={hasMarketProjection ? `${buyPreview.cost} SPUMP` : "—"} />
          <SummaryRow
            label={t("market.willHold")}
            value={hasMarketProjection ? `${futureHolding} S1` : "—"}
            sublabel={hasMarketProjection ? `+${buyPreview.amount} ${t("market.newHolding")}` : undefined}
          />
          <SummaryRow
            label="投入后档位"
            value={hasMarketProjection ? `${buyPreview.priceAfter} SPUMP` : "—"}
            sublabel={
              hasMarketProjection
                ? `${(((buyPreview.priceAfter - market.priceSpump) / market.priceSpump) * 100).toFixed(2)}%`
                : undefined
            }
          />
        </div>

        {liveCreatorWallet ? (
          <div className="grid gap-2">
            <Link
              className="block rounded-xl bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-3 py-2.5 text-center text-xs font-semibold text-white shadow-[0_14px_28px_rgba(222,64,42,0.32)] transition hover:brightness-[1.05]"
              href={`/market/${creator.id}`}
              onClick={(event) => {
                if (!onRequireAuth()) {
                  event.preventDefault();
                }
              }}
            >
              {t("market.openSeededMarket")}
            </Link>
            <Link
              className="glass-button-ghost block px-3 py-2 text-center text-xs font-medium"
              href={`/buyout/${creator.id}`}
              onClick={(event) => {
                if (!onRequireAuth()) {
                  event.preventDefault();
                }
              }}
            >
              {t("market.openSeededBuyout")}
            </Link>
          </div>
        ) : (
          <>
            <button
              className={`relative w-full overflow-hidden rounded-xl py-2.5 text-xs font-semibold transition ${
                previewDisabled
                  ? "border border-white/[0.08] bg-white/[0.04] text-[#8ea0ba]"
                  : "bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] text-white shadow-[0_14px_28px_rgba(222,64,42,0.32)] hover:brightness-[1.05]"
              } ${pulse ? "tap-bounce-active" : ""}`}
              onClick={() => {
                if (!onRequireAuth()) {
                  return;
                }

                setPulse(true);
              }}
              disabled={previewDisabled}
              type="button"
            >
              {!hasMarketProjection
                ? t("market.projectionPending")
                : disabled
                ? market.state === "S1_BUYOUT"
                  ? t("creator.gradPaused")
                  : t("market.graduatedS2")
                : t("market.previewBack")}
            </button>

            <button
              className="glass-button-ghost w-full px-3 py-2 text-xs font-medium"
              onClick={() => {
                if (!onRequireAuth()) {
                  return;
                }

                setPulse(true);
              }}
              type="button"
            >
              {t("market.addWatchlist")}
            </button>
          </>
        )}

        {!liveCreatorWallet && !disabled ? (
          <p className="text-center text-[length:var(--fs-micro)] text-[#5a6b82]">
            {hasMarketProjection ? t("market.localPreviewNote") : t("market.contentOnlyNote")}
          </p>
        ) : null}

        <p
          className="rounded-xl px-3 py-2 text-[length:var(--fs-micro)] leading-5 text-[#8ea0ba]"
          style={{ background: "color-mix(in srgb, var(--brand) 6%, transparent)" }}
        >
          {t("market.cappedDisclaimer")}
        </p>
      </div>
    </section>
  );
};

const SummaryRow = ({
  accent = false,
  label,
  sublabel,
  value,
}: {
  accent?: boolean;
  label: string;
  sublabel?: string;
  value: string;
}) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-[#7e90a8]">{label}</span>
    <div className="flex items-center gap-1.5">
      {sublabel ? <span className="text-[length:var(--fs-micro)] text-[#5a6b82]">{sublabel}</span> : null}
      <span className={`font-semibold ${accent ? "text-[#ff8a78]" : "text-white"}`}>{value}</span>
    </div>
  </div>
);

/* ──────────────────────────  Lifecycle  ────────────────────────── */

const LIFECYCLE_STEPS: Array<{ id: string; label: string; minProgress: number }> = [
  { id: "discovery", label: "Discovery", minProgress: 0 },
  { id: "growth", label: "Growth", minProgress: 30 },
  { id: "buyout", label: "Buyout Watch", minProgress: 65 },
  { id: "graduation", label: "Graduation", minProgress: 100 },
];

const LifecycleTimeline = ({
  creator,
  market,
}: {
  creator: CreatorMarketRecord;
  market: MarketModel;
}) => {
  const activeIndex = useMemo(() => resolveLifecycleIndex(creator, market), [creator, market]);

  return (
    <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)] px-4 py-3.5 md:px-5">
      <header className="flex items-center justify-between">
        <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
          S1 lifecycle projection
        </p>
        <span className="text-[length:var(--fs-micro)] text-[#7486a1]">{market.levelLabel}</span>
      </header>

      <div className="mt-3 flex items-center gap-2 md:gap-3">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;
          const isUpcoming = idx > activeIndex;

          return (
            <div className="flex flex-1 items-center" key={step.id}>
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[length:var(--fs-nano)] font-semibold ${
                    isActive
                      ? "bg-[#de402a] text-white shadow-[0_0_18px_rgba(222,64,42,0.45)]"
                      : isPast
                        ? "bg-[#65ecaf]/20 text-[#8df0c4]"
                        : "border border-white/10 bg-white/[0.04] text-[#5a6b82]"
                  }`}
                >
                  {isPast ? "✓" : idx + 1}
                </div>
                <p
                  className={`text-[length:var(--fs-micro)] font-medium ${
                    isActive ? "text-white" : isPast ? "text-[#8df0c4]" : "text-[#6f8099]"
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {idx < LIFECYCLE_STEPS.length - 1 ? (
                <div className="h-px w-full">
                  <div
                    className={`h-full w-full ${
                      isUpcoming
                        ? "bg-white/[0.06]"
                        : "bg-gradient-to-r from-[#65ecaf]/30 via-[#de402a]/30 to-[#de402a]/40"
                    }`}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const resolveLifecycleIndex = (creator: CreatorMarketRecord, market: MarketModel): number => {
  if (creator.state === "S2_ACTIVE") return 3;
  if (creator.state === "S1_BUYOUT") return 2;
  if (market.graduationPct >= 30) return 1;
  return 0;
};

/* ──────────────────────────  Buyout offer card  ────────────────────────── */

const BuyoutOfferCard = ({ creator }: { creator: CreatorMarketRecord }) => {
  const sponsor = creator.potentialSponsors[0] ?? "Sponsor TBD";
  const amount = creator.buyoutOfferUsd ?? 0;
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#de402a]/20 bg-[linear-gradient(180deg,rgba(40,16,16,0.82)_0%,rgba(15,12,18,0.94)_100%)]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#de402a] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#de402a]" />
          </span>
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.2em] text-[#ff8a78]">
            Buyout Offer Projection
          </p>
        </div>
        <span className="text-[length:var(--fs-nano)] uppercase tracking-[0.18em] text-[#7486a1]">Seeded</span>
      </header>
      <div className="space-y-2.5 px-4 py-3">
        <div>
          <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-[#7486a1]">Sponsor</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-white">{sponsor}</p>
        </div>
        <div>
          <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-[#7486a1]">Latest offer</p>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-white">
            ${compactNumber(amount)}
          </p>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
          <div>
            <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.16em] text-[#7486a1]">Deadline</p>
            <p className="mt-0.5 text-xs font-medium text-white">36h 14m</p>
          </div>
          <Link
            className="rounded-full bg-[#de402a] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-white transition hover:bg-[#ea523e]"
            href={`/buyout/${creator.id}`}
          >
            Open buyout preview
          </Link>
        </div>
      </div>
    </section>
  );
};

/* ──────────────────────────  Top holders  ────────────────────────── */

const TopHoldersCard = ({ creator }: { creator: CreatorMarketRecord }) => (
  <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,22,33,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
    <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
      <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.2em] text-[#7486a1]">Top holders</p>
      <span className="text-[length:var(--fs-nano)] uppercase tracking-[0.16em] text-[#5a6b82]">
        {compactNumber(creator.holderCount)} total
      </span>
    </header>
    <div className="space-y-0.5 px-2.5 py-2">
      {creator.topHolders.length > 0 ? creator.topHolders.map((holder) => (
        <div
          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition hover:bg-white/[0.03]"
          key={holder.rank}
        >
          <span className="flex items-center gap-1.5 text-[#c8d3e6]">
            <span className="text-[length:var(--fs-micro)] font-medium text-[#5a6b82]">#{holder.rank}</span>
            <span className="font-mono text-[length:var(--fs-micro)]">{holder.label}</span>
          </span>
          <span className="text-xs font-semibold text-white">{holder.share}</span>
        </div>
      )) : (
        <div className="rounded-lg px-2.5 py-3 text-xs leading-5 text-[#8ea0ba]">
          Holder data is unavailable on content-only public profiles.
        </div>
      )}
    </div>
  </section>
);

/* ──────────────────────────  Content surface  ────────────────────────── */

const ContentSurface = ({
  activeTab,
  creator,
  posts,
  onTabChange,
}: {
  activeTab: ProfileTab;
  creator: CreatorMarketRecord;
  posts: PostRecord[];
  onTabChange: (tab: ProfileTab) => void;
}) => (
  <section className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,20,30,0.82)_0%,rgba(9,13,20,0.82)_100%)]">
    <div className="flex items-center gap-0.5 border-b border-white/[0.05] px-2.5">
      {TABS.map((tab) => (
        <button
          className={`relative px-3 py-2.5 text-xs transition ${
            activeTab === tab ? "font-semibold text-white" : "text-[#7f90aa] hover:text-white"
          }`}
          key={tab}
          onClick={() => onTabChange(tab)}
          type="button"
        >
          {tab}
          {activeTab === tab ? (
            <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-[#de402a]" />
          ) : null}
        </button>
      ))}
    </div>

    <div className="px-3.5 py-4 md:px-4 md:py-4">
      {activeTab === "Posts" ? <PostGrid creator={creator} posts={posts} /> : null}
      {activeTab === "Investment File" ? <InvestmentFile creator={creator} /> : null}
      {activeTab === "Signals" ? <SignalsPanel creator={creator} /> : null}
    </div>
  </section>
);

const PostGrid = ({
  creator,
  posts,
}: {
  creator: CreatorMarketRecord;
  posts: PostRecord[];
}) => {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-5 py-8 text-center text-sm text-[#7e90a8]">
        No posts imported yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
      {posts.map((post, index) => (
        <Link className="group block" href={`/posts/${post.id}`} key={post.id}>
          <article className="overflow-hidden rounded-[18px] border border-white/[0.05] bg-[#0d131e] transition hover:border-white/[0.1]">
            <div className="relative aspect-[4/5] overflow-hidden">
              <ProgressiveImage
                alt={post.title}
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                fill
                priority={index < 2}
                sizes="(max-width: 768px) 50vw, 33vw"
                src={post.coverSrc}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(7,11,18,0.8)_100%)]" />
              {post.type === "VIDEO" ? (
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.14em] text-white backdrop-blur-md">
                  <span className="h-0 w-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white" />
                  Video
                  {post.durationLabel ? <span className="text-[#a4b3cb]">·</span> : null}
                  {post.durationLabel ? <span>{post.durationLabel}</span> : null}
                </div>
              ) : null}
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-[length:var(--fs-micro)] text-white">
                <span className="truncate font-medium">{post.title}</span>
                <span className="ml-2 shrink-0 text-[#cbd6e8]">♡ {compactNumber(post.likes)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-[length:var(--fs-micro)]">
              <div className="flex items-center gap-1.5 text-[#8ea0ba]">
                <img alt={creator.name} className="h-4 w-4 rounded-full object-cover" src={creator.avatarSrc} />
                <span className="truncate">{creator.name}</span>
              </div>
              <span className="text-[#5a6b82]">{post.timeLabel}</span>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
};

const InvestmentFile = ({ creator }: { creator: CreatorMarketRecord }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <FileBlock
      label="Content pool"
      rows={creator.contentPool.map((item) => ({ key: item, value: item }))}
    />
    <FileBlock
      label="Likely sponsors"
      rows={creator.potentialSponsors.map((item) => ({ key: item, value: item }))}
    />
    <FileBlock
      label="Tags"
      rows={creator.tags.map((tag) => ({ key: tag, value: `#${tag}` }))}
    />
    <FileBlock
      label="Signal"
      rows={[
        { key: "momentum", value: `Momentum score · ${creator.momentumScore}` },
        { key: "buyout", value: `Buyout status · ${creator.buyoutStatus}` },
        { key: "teaser", value: creator.teaser },
      ]}
    />
  </div>
);

const FileBlock = ({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ key: string; value: string }>;
}) => (
  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
    <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">{label}</p>
    <ul className="mt-1.5 space-y-1">
      {rows.map((row) => (
        <li className="text-xs text-[#c8d3e6]" key={row.key}>
          {row.value}
        </li>
      ))}
    </ul>
  </div>
);

const SignalsPanel = ({ creator }: { creator: CreatorMarketRecord }) => (
  <div className="grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
      <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Momentum</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-white">
        {creator.momentumScore}
        <span className="ml-1 text-[length:var(--fs-micro)] font-medium text-[#7486a1]">/100</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] via-[#ffb38a] to-[#de402a]"
          style={{ width: `${Math.min(100, creator.momentumScore)}%` }}
        />
      </div>
    </div>
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
      <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Activity</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-white">
        {creator.activityScore ?? Math.round(creator.momentumScore * 0.92)}
      </p>
      <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7486a1]">Engagement velocity score</p>
    </div>
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 lg:col-span-2">
      <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Teaser</p>
      <p className="mt-1.5 text-xs leading-5 text-[#cbd6e8]">{creator.teaser}</p>
    </div>
  </div>
);
