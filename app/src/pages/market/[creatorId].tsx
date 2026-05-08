import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { StagePill } from "@/components/shared/StagePill";
import { CreatorMarketRecord } from "@/lib/api/types";
import { compactNumber, findCreator, formatUsd } from "@/lib/public-data";

const BASE_PRICE = 0.001;
const MAX_SUPPLY = 50_000;
const CURVE_POINTS = 120;
const DAILY_LIMIT = 15_000_000;
const MOCK_SPENT = 850;
const MOCK_HOLDING = 25;
const BONDING_VIEW_BOX = { w: 800, h: 320 } as const;
const BONDING_PAD = { t: 24, r: 32, b: 40, l: 56 } as const;

function bondingPrice(supply: number): number {
  return BASE_PRICE * Math.pow(1 + supply / MAX_SUPPLY, 2);
}

/* ---------- Bonding Curve Hero ---------- */
function BondingCurveHero({ creator }: { creator: CreatorMarketRecord }) {
  const { path, fillPath, dot, maxP } = useMemo(() => {
    const pts: { x: number; y: number; supply: number; price: number }[] = [];
    for (let i = 0; i <= CURVE_POINTS; i++) {
      const s = (i / CURVE_POINTS) * MAX_SUPPLY;
      const p = bondingPrice(s);
      pts.push({ supply: s, price: p, x: 0, y: 0 });
    }
    const maxP = pts[pts.length - 1].price;
    const chartW = BONDING_VIEW_BOX.w - BONDING_PAD.l - BONDING_PAD.r;
    const chartH = BONDING_VIEW_BOX.h - BONDING_PAD.t - BONDING_PAD.b;

    pts.forEach((pt) => {
      pt.x = BONDING_PAD.l + (pt.supply / MAX_SUPPLY) * chartW;
      pt.y = BONDING_PAD.t + chartH - (pt.price / maxP) * chartH;
    });

    const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
    const fillD = `${d} L${pts[pts.length - 1].x},${BONDING_PAD.t + chartH} L${pts[0].x},${BONDING_PAD.t + chartH} Z`;

    const dotSupply = creator.supply;
    const dotPrice = bondingPrice(dotSupply);
    const dotX = BONDING_PAD.l + (dotSupply / MAX_SUPPLY) * chartW;
    const dotY = BONDING_PAD.t + chartH - (dotPrice / maxP) * chartH;

    return { path: d, fillPath: fillD, dot: { x: dotX, y: dotY }, maxP };
  }, [creator.supply]);

  const chartH = BONDING_VIEW_BOX.h - BONDING_PAD.t - BONDING_PAD.b;

  return (
    <div className="liquid-glass-shell section-enter relative overflow-hidden p-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(222,64,42,0.12),transparent_60%)]" />

      <div className="relative px-5 pt-5 pb-2 md:px-8 md:pt-7">
        <div className="flex items-center gap-3">
          <Link
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[#8ea0ba] transition hover:bg-white/10"
            href="/trending"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {creator.avatarSrc && (
            <img alt="" className="h-9 w-9 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
            <p className="text-xs text-[#8ea0ba]">{creator.handle}</p>
          </div>
          <StagePill className="ml-auto" stage={creator.state} />
        </div>
      </div>

      <svg
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${BONDING_VIEW_BOX.w} ${BONDING_VIEW_BOX.h}`}
      >
        <defs>
          <linearGradient id="curve-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#de402a" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#de402a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="line-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#de402a" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#de402a" />
            <stop offset="100%" stopColor="#f3b33e" />
          </linearGradient>
          <filter id="dot-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
          <filter id="dot-glow-sm">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = BONDING_PAD.t + chartH * (1 - frac);
          return (
            <g key={frac}>
              <line stroke="rgba(255,255,255,0.05)" strokeDasharray="4 6" x1={BONDING_PAD.l} x2={BONDING_VIEW_BOX.w - BONDING_PAD.r} y1={y} y2={y} />
              <text fill="#5a6d87" fontSize={10} textAnchor="end" x={BONDING_PAD.l - 8} y={y + 3}>
                {(maxP * frac).toFixed(3)}
              </text>
            </g>
          );
        })}

        <path d={fillPath} fill="url(#curve-grad)" />
        <path d={path} fill="none" stroke="url(#line-grad)" strokeLinecap="round" strokeWidth={2.5} />

        <circle cx={dot.x} cy={dot.y} fill="#de402a" filter="url(#dot-glow)" opacity={0.6} r={12}>
          <animate attributeName="opacity" dur="2s" repeatCount="indefinite" values="0.6;0.25;0.6" />
          <animate attributeName="r" dur="2s" repeatCount="indefinite" values="12;18;12" />
        </circle>
        <circle cx={dot.x} cy={dot.y} fill="#de402a" filter="url(#dot-glow-sm)" r={6} />
        <circle cx={dot.x} cy={dot.y} fill="#fff" r={3.5} />

        <text fill="#5a6d87" fontSize={10} textAnchor="middle" x={BONDING_VIEW_BOX.w / 2} y={BONDING_VIEW_BOX.h - 6}>
          SUPPLY
        </text>
      </svg>
    </div>
  );
}

/* ---------- Price Header ---------- */
function PriceHeader({ creator }: { creator: CreatorMarketRecord }) {
  const change24h = 12.4;
  const sparkline = useMemo(() => {
    const pts = 24;
    const data: number[] = [];
    let v = creator.tokenPrice * 0.9;
    for (let i = 0; i < pts; i++) {
      v += (Math.random() - 0.42) * 0.12;
      data.push(Math.max(0.01, v));
    }
    data[pts - 1] = creator.tokenPrice;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map((v, i) => ({ x: (i / (pts - 1)) * 100, y: 28 - ((v - min) / range) * 24 }));
  }, [creator.tokenPrice]);

  const sparkD = sparkline.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5a6d87]">SPUMP PRICE</p>
        <p className="mt-1 text-[52px] font-bold leading-none tracking-[-0.05em] text-white md:text-[64px]">
          {formatUsd(creator.tokenPrice)}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#65ecaf]">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" fillRule="evenodd" transform="rotate(180 10 10)" />
          </svg>
          +{change24h}% 24h
        </p>
      </div>
      <svg className="h-8 w-28 opacity-80" viewBox="0 0 100 32">
        <path d={sparkD} fill="none" stroke="#65ecaf" strokeLinecap="round" strokeWidth={1.8} />
      </svg>
    </div>
  );
}

/* ---------- Trade Panel ---------- */
function TradePanel({ creator }: { creator: CreatorMarketRecord }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(10);

  const slippage = side === "buy" ? 1.02 : 0.98;
  const cost = amount * creator.tokenPrice * slippage;

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value));
  }, []);

  return (
    <div className="liquid-card section-enter space-y-5 p-5 md:p-6">
      {/* Buy / Sell toggle */}
      <div className="flex gap-1 rounded-full border border-white/8 bg-white/4 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${
              side === s
                ? s === "buy"
                  ? "glass-button-primary"
                  : "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                : "text-[#5a6d87] hover:text-white"
            }`}
            key={s}
            onClick={() => setSide(s)}
            type="button"
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* Amount slider */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#5a6d87]">Amount</span>
          <span className="text-2xl font-bold tracking-[-0.04em] text-white">{amount}</span>
        </div>
        <input
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/8 accent-[#de402a] outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#de402a] [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(222,64,42,0.5)]"
          max={100}
          min={1}
          onChange={handleSlider}
          type="range"
          value={amount}
        />
        <div className="mt-1 flex justify-between text-[10px] text-[#5a6d87]">
          <span>1</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Cost preview */}
      <div className="surface-muted space-y-2 p-4">
        <div className="flex justify-between text-xs text-[#8ea0ba]">
          <span>Unit Price</span>
          <span className="text-white">{formatUsd(creator.tokenPrice)}</span>
        </div>
        <div className="flex justify-between text-xs text-[#8ea0ba]">
          <span>Slippage ({side === "buy" ? "+2%" : "-2%"})</span>
          <span className="text-white">{formatUsd(Math.abs(cost - amount * creator.tokenPrice))}</span>
        </div>
        <div className="h-px bg-white/6" />
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-[#8ea0ba]">Total {side === "buy" ? "Cost" : "Return"}</span>
          <span className="text-white">{formatUsd(cost)} SPUMP</span>
        </div>
      </div>

      {/* Submit */}
      <button
        className={`glass-button-primary w-full py-3.5 text-sm font-bold tracking-wide ${
          side === "sell" ? "!bg-gradient-to-b !from-white/16 !to-white/10 !shadow-[0_18px_34px_rgba(0,0,0,0.22)]" : ""
        }`}
        type="button"
      >
        {side === "buy" ? "Buy S1 Token" : "Sell S1 Token"}
      </button>
    </div>
  );
}

/* ---------- Position Card ---------- */
function PositionCard({ creator }: { creator: CreatorMarketRecord }) {
  const value = MOCK_HOLDING * creator.tokenPrice;
  const pnl = 18.6;

  return (
    <div className="liquid-pill flex items-center gap-4 rounded-[28px] px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#65ecaf]/12 text-[#65ecaf]">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#5a6d87]">YOUR POSITION</p>
        <p className="text-lg font-bold tracking-[-0.03em] text-white">
          {MOCK_HOLDING} tokens
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">{formatUsd(value)}</p>
        <p className="text-xs font-semibold text-[#65ecaf]">+{pnl}%</p>
      </div>
    </div>
  );
}

/* ---------- Daily Limit Bar ---------- */
function DailyLimitBar() {
  const pct = (MOCK_SPENT / DAILY_LIMIT) * 100;
  const nearLimit = pct > 75;

  return (
    <div className="surface-muted space-y-2.5 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#5a6d87]">DAILY SPUMP LIMIT</span>
        <span className={`text-xs font-semibold ${nearLimit ? "text-[#f3b33e]" : "text-[#8ea0ba]"}`}>
          {compactNumber(MOCK_SPENT)} / {compactNumber(DAILY_LIMIT)}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/6">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${
            nearLimit
              ? "bg-gradient-to-r from-[#f3b33e] to-[#de402a] shadow-[0_0_14px_rgba(243,179,62,0.4)]"
              : "bg-gradient-to-r from-[#67b8ff] to-[#65ecaf]"
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Stats Grid ---------- */
function StatsGrid({ creator }: { creator: CreatorMarketRecord }) {
  const stats = [
    {
      label: "Price",
      value: formatUsd(creator.tokenPrice),
      sub: `Target ${formatUsd(creator.targetGraduationPrice)}`,
      color: "text-white",
    },
    {
      label: "Holders",
      value: compactNumber(creator.holderCount),
      sub: `${creator.topHolders[0]?.share ?? "—"} top wallet`,
      color: "text-[#67b8ff]",
    },
    {
      label: "Supply",
      value: compactNumber(creator.supply),
      sub: `of ${compactNumber(MAX_SUPPLY)} max`,
      color: "text-white",
    },
    {
      label: "Graduation",
      value: `${creator.graduationProgress}%`,
      sub: creator.graduationProgress >= 100 ? "Complete" : `${100 - creator.graduationProgress}% remaining`,
      color: creator.graduationProgress >= 100 ? "text-[#65ecaf]" : "text-[#f3b33e]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div className="surface-muted space-y-1 p-4" key={s.label}>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5a6d87]">{s.label}</p>
          <p className={`text-2xl font-bold tracking-[-0.04em] ${s.color}`}>{s.value}</p>
          <p className="text-[11px] text-[#5a6d87]">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export default function S1TokenTradingPage() {
  const router = useRouter();
  const creatorId = String(router.query.creatorId ?? "");
  const creator = findCreator(creatorId);

  if (!creatorId) {
    return (
      <>
        <Head>
          <title>StreamPump | Market</title>
        </Head>
        <PageShell>
          <div className="py-10 text-sm text-[#8ea0ba]">Loading...</div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`StreamPump | ${creator.name} Market`}</title>
      </Head>
      <PageShell>
        <div className="mx-auto max-w-5xl space-y-5">
          {/* Hero curve */}
          <BondingCurveHero creator={creator} />

          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            {/* Left column */}
            <div className="space-y-5">
              <div className="liquid-card section-enter p-5 md:p-7">
                <PriceHeader creator={creator} />
              </div>
              <StatsGrid creator={creator} />
            </div>

            {/* Right column - trade controls */}
            <div className="space-y-4">
              <TradePanel creator={creator} />
              <PositionCard creator={creator} />
              <DailyLimitBar />
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}
