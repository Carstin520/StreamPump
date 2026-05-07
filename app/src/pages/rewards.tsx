import Head from "next/head";
import { useState } from "react";

import { PageShell } from "@/components/layout/PageShell";

const MISSIONS = [
  { name: "Complete Profile", emoji: "👤", spump: 20_000, xp: 20, done: true },
  { name: "First S1 Buy", emoji: "💎", spump: 50_000, xp: 30, done: false },
  { name: "Endorse a Proposal", emoji: "✅", spump: 30_000, xp: 25, done: false },
  { name: "Share a Post", emoji: "📤", spump: 10_000, xp: 10, done: true },
  { name: "Follow 5 Creators", emoji: "👥", spump: 15_000, xp: 15, done: false },
  { name: "Daily Login Streak ×7", emoji: "🔥", spump: 100_000, xp: 50, done: false },
] as const;

const DAILY_AMOUNT = 1_250_000;
const CURRENT_XP = 80;
const LEVEL_XP = 200;
const CURRENT_LEVEL = 3;
const STREAK = 3;
const BOOST_DAYS_LEFT = 5;

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default function RewardsPage() {
  const [claimed, setClaimed] = useState(false);

  const completedXP = MISSIONS.filter((m) => m.done).reduce((a, m) => a + m.xp, 0);
  const totalXP = CURRENT_XP + completedXP;
  const xpPct = Math.min((totalXP / LEVEL_XP) * 100, 100);

  return (
    <>
      <Head>
        <title>Daily Rewards — StreamPump</title>
      </Head>

      <PageShell eyebrow="Rewards" title="Daily SPUMP & Missions">
        {/* XP progress bar */}
        <section className="liquid-card section-enter px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#67b8ff]/15 text-sm font-bold text-[#67b8ff]">
                {CURRENT_LEVEL}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Level {CURRENT_LEVEL}</p>
                <p className="text-xs text-[#8ea0ba]">{fmt(totalXP)} / {fmt(LEVEL_XP)} XP</p>
              </div>
            </div>
            <span className="text-xs font-medium text-[#67b8ff]">Level {CURRENT_LEVEL + 1} →</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] to-[#65ecaf] transition-all duration-700"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </section>

        {/* Daily claim hero */}
        <section className="section-enter flex flex-col items-center py-6">
          <div className="relative">
            {/* Outer glow rings */}
            {!claimed && (
              <>
                <span className="absolute inset-0 -m-6 animate-ping rounded-full bg-[#de402a]/10" style={{ animationDuration: "2s" }} />
                <span className="absolute inset-0 -m-3 animate-pulse rounded-full bg-[#de402a]/15" style={{ animationDuration: "1.5s" }} />
              </>
            )}
            {claimed && (
              <span className="absolute inset-0 -m-4 rounded-full bg-[#65ecaf]/10" />
            )}

            <button
              className={`relative z-10 flex h-44 w-44 flex-col items-center justify-center rounded-full border-2 transition-all duration-500 md:h-52 md:w-52 ${
                claimed
                  ? "border-[#65ecaf]/40 bg-[#65ecaf]/10 shadow-[0_0_60px_rgba(101,236,175,0.2)]"
                  : "border-[#de402a]/50 bg-[#de402a]/10 shadow-[0_0_80px_rgba(222,64,42,0.25)] hover:scale-[1.04] hover:shadow-[0_0_100px_rgba(222,64,42,0.35)]"
              }`}
              disabled={claimed}
              onClick={() => setClaimed(true)}
              type="button"
            >
              {claimed ? (
                <>
                  <span className="text-3xl">✓</span>
                  <span className="mt-1 text-lg font-bold tracking-[-0.04em] text-[#65ecaf]">Claimed!</span>
                  <span className="mt-0.5 text-sm font-medium text-[#65ecaf]/70">{fmt(DAILY_AMOUNT)}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[#65ecaf]/50">SPUMP</span>
                </>
              ) : (
                <>
                  <span className="text-4xl">🪙</span>
                  <span className="mt-2 text-sm font-bold tracking-[-0.03em] text-white">Claim Daily</span>
                  <span className="mt-0.5 text-xl font-bold tracking-[-0.05em] text-[#de402a]">{fmt(DAILY_AMOUNT)}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[#8ea0ba]">SPUMP</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Streak counter */}
        <section className="section-enter">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Login Streak</h2>
            <span className="rounded-full bg-[#f3b33e]/15 px-3 py-1 text-xs font-bold text-[#f3b33e]">
              ×{STREAK} Multiplier
            </span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
            {Array.from({ length: 7 }, (_, i) => {
              const day = i + 1;
              const active = day <= STREAK;
              const current = day === STREAK;
              return (
                <div
                  className={`liquid-pill flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full transition-all ${
                    current
                      ? "border-[#de402a]/50 bg-[#de402a]/15 text-white shadow-[0_0_24px_rgba(222,64,42,0.2)]"
                      : active
                        ? "border-[#65ecaf]/30 bg-[#65ecaf]/10 text-[#65ecaf]"
                        : "text-[#5a6b82]"
                  }`}
                  key={day}
                >
                  <span className="text-[10px] uppercase tracking-wider">{active ? "✓" : ""}</span>
                  <span className="text-xs font-semibold">D{day}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* New user boost banner */}
        <section className="glass-card section-enter relative overflow-hidden p-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f3b33e]/[0.06] to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h3 className="text-sm font-bold tracking-[-0.03em] text-white">New User Boost</h3>
                <span className="rounded-full bg-[#f3b33e]/15 px-2 py-0.5 text-[10px] font-bold text-[#f3b33e]">
                  +25%
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8ea0ba]">{BOOST_DAYS_LEFT} days remaining at boosted emission rate</p>
            </div>
          </div>
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f3b33e] to-[#f3b33e]/40"
              style={{ width: `${((7 - BOOST_DAYS_LEFT) / 7) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#5a6b82]">
            <span>Day 1</span>
            <span>Day 7</span>
          </div>
        </section>

        {/* Mission grid */}
        <section className="section-enter">
          <h2 className="mb-4 text-lg font-bold tracking-[-0.05em] text-white">Engagement Missions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {MISSIONS.map((m) => (
              <div
                className={`glass-card relative p-5 transition-all ${
                  m.done
                    ? "border-[#65ecaf]/20 shadow-[0_0_30px_rgba(101,236,175,0.08)]"
                    : ""
                }`}
                key={m.name}
              >
                {m.done && (
                  <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-[#65ecaf]/25" />
                )}
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-xl">
                      {m.emoji}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.name}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs font-medium text-[#de402a]">{fmt(m.spump)} SPUMP</span>
                        <span className="text-xs text-[#8ea0ba]">+{m.xp} XP</span>
                      </div>
                    </div>
                  </div>
                  {m.done ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#65ecaf]/15 text-sm text-[#65ecaf]">
                      ✓
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-[#8ea0ba]">
                      TODO
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </PageShell>
    </>
  );
}
