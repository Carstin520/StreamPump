import Head from "next/head";
import { useCallback, useMemo, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { compactNumber, findCreator, formatUsd } from "@/lib/public-data";

const creator = findCreator("neo-park");

const TRACK1_BASE = 100_000;
const TRACK2_BUDGET = 1_000_000;
const TRACK3_BUDGET = 300_000;
const TRACK2_TARGET = 1_000;
const TRACK2_CLIFF = 0.5;
const TRACK2_CURRENT = 0;
const FAN_POOL_SHARE = TRACK2_BUDGET * 0.2;
const FAN_BALANCE = 500_000;
const STATUS = "FUNDED";
const DEADLINE = "May 15, 2026";

const ENDORSERS = [
  { name: "0xA7...91", amount: 50_000 },
  { name: "0x4C...8F", amount: 32_000 },
  { name: "0x91...2E", amount: 18_000 },
];

const EXISTING_ENDORSED = ENDORSERS.reduce((s, e) => s + e.amount, 0);

const DIAL_SIZE = 240;
const DIAL_STROKE = 10;
const DIAL_RADIUS = (DIAL_SIZE - DIAL_STROKE) / 2;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

const tracks = [
  { label: "Track 1 · Base", value: TRACK1_BASE, settled: true, color: "#65ecaf" },
  { label: "Track 2 · Performance", value: TRACK2_BUDGET, settled: false, color: "#67b8ff" },
  { label: "Track 3 · Bonus", value: TRACK3_BUDGET, settled: false, color: "#f3b33e" },
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function EndorsePage() {
  const [stakeAmount, setStakeAmount] = useState(10_000);
  const dialRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const fraction = stakeAmount / FAN_BALANCE;
  const dashOffset = DIAL_CIRCUMFERENCE * (1 - fraction);

  const totalEndorsed = EXISTING_ENDORSED + stakeAmount;
  const successUsdc = (stakeAmount / totalEndorsed) * FAN_POOL_SHARE;
  const failLoss = stakeAmount * 0.05;

  const handleDialInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = dialRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let angle = Math.atan2(clientY - cy, clientX - cx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const pct = clamp(angle / (2 * Math.PI), 0.002, 1);
    setStakeAmount(Math.round(pct * FAN_BALANCE));
  }, []);

  const onPointerDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      handleDialInteraction(e);
    },
    [handleDialInteraction],
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current) return;
      handleDialInteraction(e);
    },
    [handleDialInteraction],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const formattedStake = useMemo(() => compactNumber(stakeAmount), [stakeAmount]);

  return (
    <>
      <Head>
        <title>{`StreamPump | Endorse ${creator.name}`}</title>
      </Head>
      <PageShell eyebrow="S2 Endorsement" title={`Endorse ${creator.name}`}>
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* ── Left column ── */}
          <div className="space-y-5">
            {/* ── Staking dial ── */}
            <section className="liquid-card section-enter flex flex-col items-center gap-6 rounded-[28px] p-8">
              <div className="flex items-center gap-3 self-start">
                <span className="liquid-pill rounded-full px-3 py-1 text-xs font-medium text-white">
                  {STATUS}
                </span>
                <span className="text-xs text-[#8ea0ba]">Deadline {DEADLINE}</span>
              </div>

              <div
                className="relative select-none"
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
              >
                <svg
                  ref={dialRef}
                  width={DIAL_SIZE}
                  height={DIAL_SIZE}
                  className="cursor-pointer"
                  style={{ touchAction: "none" }}
                >
                  {/* background track */}
                  <circle
                    cx={DIAL_SIZE / 2}
                    cy={DIAL_SIZE / 2}
                    r={DIAL_RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={DIAL_STROKE}
                  />
                  {/* filled arc */}
                  <circle
                    cx={DIAL_SIZE / 2}
                    cy={DIAL_SIZE / 2}
                    r={DIAL_RADIUS}
                    fill="none"
                    stroke="#de402a"
                    strokeWidth={DIAL_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={DIAL_CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                    className="transition-[stroke-dashoffset] duration-75"
                  />
                </svg>

                {/* center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[36px] font-bold tracking-[-0.05em] text-white">
                    {formattedStake}
                  </span>
                  <span className="text-xs tracking-[0.18em] text-[#8ea0ba]">SPUMP</span>
                </div>
              </div>

              {/* slider fallback */}
              <input
                type="range"
                min={1}
                max={FAN_BALANCE}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(Number(e.target.value))}
                className="w-full max-w-[280px] accent-[#de402a]"
              />

              {/* projection ring */}
              <div className="flex w-full max-w-sm justify-between text-center">
                <div>
                  <p className="text-[20px] font-semibold tracking-[-0.05em] text-[#65ecaf]">
                    {formatUsd(successUsdc)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                    Est. USDC if success
                  </p>
                </div>
                <div>
                  <p className="text-[20px] font-semibold tracking-[-0.05em] text-white">
                    {(fraction * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                    Of balance
                  </p>
                </div>
                <div>
                  <p className="text-[20px] font-semibold tracking-[-0.05em] text-[#de402a]">
                    {compactNumber(failLoss)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                    SPUMP at risk
                  </p>
                </div>
              </div>
            </section>

            {/* ── Outcome simulation cards ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Success */}
              <section className="glass-card section-enter rounded-[28px] border border-[#65ecaf]/20 bg-[#65ecaf]/[0.04] p-6">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#65ecaf]">
                  If Success
                </p>
                <p className="mt-4 text-[32px] font-bold tracking-[-0.05em] text-[#65ecaf]">
                  100%
                </p>
                <p className="text-xs text-[#8ea0ba]">SPUMP returned</p>

                <div className="mt-5 space-y-3">
                  <div className="surface-muted rounded-2xl px-4 py-3">
                    <p className="text-[22px] font-semibold tracking-[-0.05em] text-white">
                      {compactNumber(stakeAmount)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                      SPUMP back
                    </p>
                  </div>
                  <div className="surface-muted rounded-2xl px-4 py-3">
                    <p className="text-[22px] font-semibold tracking-[-0.05em] text-[#65ecaf]">
                      +{formatUsd(successUsdc)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                      USDC share
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[10px] leading-4 text-[#8ea0ba]">
                  Track 2 metric ≥ {TRACK2_CLIFF * 100}% cliff
                </p>
              </section>

              {/* Fail */}
              <section className="glass-card section-enter rounded-[28px] border border-[#de402a]/20 bg-[#de402a]/[0.04] p-6">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#de402a]">
                  If Fail
                </p>
                <p className="mt-4 text-[32px] font-bold tracking-[-0.05em] text-[#de402a]">95%</p>
                <p className="text-xs text-[#8ea0ba]">SPUMP returned</p>

                <div className="mt-5 space-y-3">
                  <div className="surface-muted rounded-2xl px-4 py-3">
                    <p className="text-[22px] font-semibold tracking-[-0.05em] text-white">
                      {compactNumber(stakeAmount * 0.95)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                      SPUMP back
                    </p>
                  </div>
                  <div className="surface-muted rounded-2xl px-4 py-3">
                    <p className="text-[22px] font-semibold tracking-[-0.05em] text-[#de402a]">
                      −{compactNumber(failLoss)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                      SPUMP slashed (5%)
                    </p>
                  </div>
                  <div className="surface-muted rounded-2xl px-4 py-3">
                    <p className="text-[22px] font-semibold tracking-[-0.05em] text-[#8ea0ba]">
                      $0
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#8ea0ba]">
                      USDC share
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[10px] leading-4 text-[#8ea0ba]">
                  Track 2 metric &lt; {TRACK2_CLIFF * 100}% cliff
                </p>
              </section>
            </div>

            {/* ── Track progress rails ── */}
            <section className="liquid-card section-enter rounded-[28px] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8ea0ba]">
                Track Settlement
              </p>
              <div className="mt-5 space-y-4">
                {tracks.map((t) => {
                  const pct = t.settled ? 100 : (TRACK2_CURRENT / TRACK2_TARGET) * 100;
                  return (
                    <div key={t.label}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-[#8ea0ba]">{t.label}</span>
                        <span className="text-sm font-semibold tracking-[-0.05em] text-white">
                          {formatUsd(t.value)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: t.color,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-[#8ea0ba]">
                        {t.settled ? "Settled" : `${TRACK2_CURRENT} / ${compactNumber(TRACK2_TARGET)} views · ${pct.toFixed(0)}%`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">
            {/* ── Creator pill ── */}
            <section className="liquid-card section-enter flex items-center gap-4 rounded-[28px] p-5">
              {creator.avatarSrc ? (
                <img
                  src={creator.avatarSrc}
                  alt={creator.name}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                  {creator.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                <p className="truncate text-xs text-[#8ea0ba]">{creator.handle}</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-[#65ecaf]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#65ecaf]">
                S2 Active
              </span>
            </section>

            {/* ── Endorser list ── */}
            <section className="liquid-card section-enter rounded-[28px] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8ea0ba]">
                Current Endorsers
              </p>
              <div className="mt-4 space-y-3">
                {ENDORSERS.map((e) => (
                  <div
                    key={e.name}
                    className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
                  >
                    <span className="font-mono text-xs text-[#8ea0ba]">{e.name}</span>
                    <span className="text-sm font-semibold tracking-[-0.05em] text-white">
                      {compactNumber(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <span className="text-xs text-[#8ea0ba]">Total endorsed</span>
                <span className="text-sm font-semibold tracking-[-0.05em] text-white">
                  {compactNumber(totalEndorsed)}
                </span>
              </div>
            </section>

            {/* ── Campaign summary ── */}
            <section className="liquid-card section-enter rounded-[28px] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8ea0ba]">
                Campaign
              </p>
              <div className="mt-4 space-y-2.5">
                {[
                  ["Track 2 target", `${compactNumber(TRACK2_TARGET)} views`],
                  ["Cliff", `${TRACK2_CLIFF * 100}%`],
                  ["Fan pool (20%)", formatUsd(FAN_POOL_SHARE)],
                  ["Your balance", `${compactNumber(FAN_BALANCE)} SPUMP`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-[#8ea0ba]">{label}</span>
                    <span className="text-sm font-semibold tracking-[-0.05em] text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Action button ── */}
            <button className="glass-button-primary section-enter w-full rounded-full py-4 text-base font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]">
              Endorse with {compactNumber(stakeAmount)} SPUMP
            </button>
          </div>
        </div>
      </PageShell>
    </>
  );
}
