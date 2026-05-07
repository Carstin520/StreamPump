import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { StagePill } from "@/components/shared/StagePill";
import { CreatorMarketRecord } from "@/lib/api/types";
import { findCreator, formatUsd } from "@/lib/public-data";

/* ─── Mock buyout data ─── */
const MOCK_OFFERS = [
  { sponsor: "Apex Motion", avatar: "AM", amount: 850_000 },
  { sponsor: "Gridline Lab", avatar: "GL", amount: 720_000 },
];

const MOCK_DEADLINE_MS = Date.now() + 36 * 60 * 60 * 1000;
const USER_TOKENS = 25;
const EARLY_POOL_USD = 200_000;
const REGULAR_POOL_USD = 800_000;

type BuyoutPhase = "offers_open" | "offer_accepted" | "rage_quit" | "graduated";

const PHASES: { key: BuyoutPhase; label: string }[] = [
  { key: "offers_open", label: "Offers Open" },
  { key: "offer_accepted", label: "Offer Accepted" },
  { key: "rage_quit", label: "Rage Quit Window" },
  { key: "graduated", label: "Graduated" },
];

function phaseFromState(state: CreatorMarketRecord["state"]): BuyoutPhase {
  switch (state) {
    case "S1_BUYOUT":
      return "rage_quit";
    case "S2_ACTIVE":
      return "graduated";
    default:
      return "offers_open";
  }
}

/* ─── Countdown Ring ─── */
function CountdownRing({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, deadline - now);
  const total = 48 * 60 * 60 * 1000;
  const progress = 1 - remaining / total;

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const SIZE = 280;
  const STROKE = 8;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#de402a"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          style={{ filter: "drop-shadow(0 0 8px rgba(222,64,42,0.5))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] font-semibold tracking-[-0.05em] text-white tabular-nums">
          {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <span className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8ea0ba]">Rage Quit Window</span>
      </div>
    </div>
  );
}

/* ─── Phase Stepper ─── */
function PhaseStepper({ current }: { current: BuyoutPhase }) {
  const currentIdx = PHASES.findIndex((p) => p.key === current);

  return (
    <div className="flex items-center justify-center gap-0">
      {PHASES.map((phase, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;

        return (
          <div key={phase.key} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-[2px] w-8 sm:w-12 ${isDone ? "bg-[#65ecaf]" : "bg-white/10"}`}
              />
            )}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                  isActive
                    ? "border-[#de402a] bg-[#de402a]/20 shadow-[0_0_12px_rgba(222,64,42,0.5)]"
                    : isDone
                      ? "border-[#65ecaf] bg-[#65ecaf]/20"
                      : "border-white/20 bg-transparent"
                }`}
              >
                {isDone && (
                  <svg className="h-3 w-3 text-[#65ecaf]" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {isActive && <div className="h-2 w-2 rounded-full bg-[#de402a]" />}
              </div>
              <span
                className={`whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] ${
                  isActive ? "text-white" : isDone ? "text-[#65ecaf]" : "text-[#8ea0ba]/60"
                }`}
              >
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Offer Card ─── */
function OfferCard({ sponsor, avatar, amount }: { sponsor: string; avatar: string; amount: number }) {
  return (
    <div className="liquid-card flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-bold text-[#67b8ff]">
        {avatar}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{sponsor}</p>
        <p className="mt-0.5 text-xs text-[#8ea0ba]">Sponsor Offer</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold tracking-[-0.03em] text-white">{formatUsd(amount)}</p>
        <p className="text-[10px] uppercase tracking-[0.1em] text-[#65ecaf]">USDC</p>
      </div>
    </div>
  );
}

/* ─── Rage Quit Panel ─── */
function RageQuitPanel({ active }: { active: boolean }) {
  const [tokensToExit, setTokensToExit] = useState(0);
  const exitValue = tokensToExit * (EARLY_POOL_USD / USER_TOKENS);

  return (
    <div
      className={`glass-card relative overflow-hidden rounded-[28px] border p-6 ${
        active ? "border-[#de402a]/30" : "border-white/5 opacity-50"
      }`}
    >
      {active && (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-[28px] bg-[radial-gradient(circle_at_center,rgba(222,64,42,0.08),transparent_70%)]" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#de402a]">Rage Quit</h3>
          <span className="text-xs text-[#8ea0ba]">{USER_TOKENS} tokens held</span>
        </div>

        <div className="mt-5">
          <input
            type="range"
            min={0}
            max={USER_TOKENS}
            value={tokensToExit}
            onChange={(e) => setTokensToExit(Number(e.target.value))}
            disabled={!active}
            className="w-full accent-[#de402a]"
          />
          <div className="mt-2 flex justify-between text-xs text-[#8ea0ba]">
            <span>{tokensToExit} tokens to exit</span>
            <span>≈ {formatUsd(exitValue)}</span>
          </div>
        </div>

        <button
          disabled={!active || tokensToExit === 0}
          className={`mt-5 w-full rounded-full py-3 text-sm font-semibold transition-all ${
            active && tokensToExit > 0
              ? "bg-[#de402a] text-white shadow-[0_0_24px_rgba(222,64,42,0.4)] hover:bg-[#e8553f]"
              : "cursor-not-allowed bg-white/5 text-white/30"
          }`}
        >
          {active ? "Exit Position" : "Window Closed"}
        </button>
      </div>
    </div>
  );
}

/* ─── Claim Panel ─── */
function ClaimPanel() {
  return (
    <div className="glass-card space-y-4 rounded-[28px] p-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#65ecaf]">Claim USDC</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="surface-muted rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#f3b33e]">Early Cohort</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">{formatUsd(EARLY_POOL_USD)}</p>
          <p className="mt-1 text-xs text-[#8ea0ba]">Pool share</p>
        </div>
        <div className="surface-muted rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#67b8ff]">Regular</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">{formatUsd(REGULAR_POOL_USD)}</p>
          <p className="mt-1 text-xs text-[#8ea0ba]">Pool share</p>
        </div>
      </div>

      <div className="surface-muted flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-xs text-[#8ea0ba]">Your position</p>
          <p className="mt-1 text-lg font-semibold text-white">{USER_TOKENS} tokens · Early</p>
        </div>
        <button className="rounded-full bg-[#65ecaf] px-5 py-2.5 text-sm font-semibold text-[#090d14] transition hover:bg-[#7bf0bd]">
          Claim
        </button>
      </div>
    </div>
  );
}

/* ─── Discovery Placeholder ─── */
function DiscoveryState({ creator }: { creator: CreatorMarketRecord }) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
        <svg className="h-8 w-8 text-[#8ea0ba]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Buyout Not Yet Initiated</h2>
        <p className="mt-2 text-sm text-[#8ea0ba]">
          {creator.name} is still in discovery phase
        </p>
      </div>
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-[#8ea0ba]">
          <span>Graduation Progress</span>
          <span>{Math.round(creator.graduationProgress * 100)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] to-[#65ecaf] transition-all"
            style={{ width: `${creator.graduationProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function BuyoutLiveRoom() {
  const router = useRouter();
  const creatorId = router.query.creatorId as string | undefined;
  const creator = useMemo(() => (creatorId ? findCreator(creatorId) : undefined), [creatorId]);

  if (!creator) {
    return (
      <PageShell title="Buyout Room">
        <div className="py-20 text-center text-[#8ea0ba]">Creator not found</div>
      </PageShell>
    );
  }

  const phase = phaseFromState(creator.state);

  return (
    <PageShell
      eyebrow="S1 Buyout"
      title={`${creator.name}`}
      subtitle={`@${creator.handle} · ${creator.niche}`}
      action={<StagePill stage={creator.state} />}
    >
      {creator.state === "S1_DISCOVERY" && <DiscoveryState creator={creator} />}

      {creator.state === "S1_BUYOUT" && (
        <div className="space-y-8">
          <PhaseStepper current={phase} />
          <CountdownRing deadline={MOCK_DEADLINE_MS} />

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8ea0ba]">Sponsor Offers</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {MOCK_OFFERS.map((o) => (
                <OfferCard key={o.sponsor} {...o} />
              ))}
            </div>
          </section>

          <RageQuitPanel active={phase === "rage_quit"} />
        </div>
      )}

      {creator.state === "S2_ACTIVE" && (
        <div className="space-y-8">
          <PhaseStepper current={phase} />
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="liquid-pill px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#65ecaf]">
              Graduated
            </span>
            <p className="text-sm text-[#8ea0ba]">Buyout complete — claim your USDC</p>
          </div>
          <ClaimPanel />
        </div>
      )}
    </PageShell>
  );
}
