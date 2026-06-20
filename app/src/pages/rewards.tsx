import Head from "next/head";
import { useCallback, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { useManagedWallet } from "@/hooks/useManagedWallet";
import { useS1TransactionFlow } from "@/hooks/useS1TransactionFlow";
import { buildClaimDailySpumpTransaction } from "@/lib/api/s1";
import { useI18n } from "@/lib/i18n";

const SCOUT_TIER_LABEL = "Scout";
const SCOUT_TIER_ZH = "星探";

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
const REWARD_BOUNDARIES = [
  { label: "Daily claim", value: "wallet or managed transaction" },
  { label: "SPUMP balance", value: "on-chain mint path" },
  { label: "Missions", value: "fixture progress" },
  { label: "Production gate", value: "anti-abuse + live reward ledger" },
] as const;

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default function RewardsPage() {
  const { t, locale } = useI18n();
  const [claimed, setClaimed] = useState(false);
  const flow = useS1TransactionFlow();
  const managedWallet = useManagedWallet();

  const completedXP = MISSIONS.filter((m) => m.done).reduce((a, m) => a + m.xp, 0);
  const totalXP = CURRENT_XP + completedXP;
  const xpPct = Math.min((totalXP / LEVEL_XP) * 100, 100);
  const busy =
    flow.state.status === "building" ||
    flow.state.status === "waiting_signature" ||
    flow.state.status === "submitting" ||
    flow.state.status === "syncing_projection";
  const claimLabel = managedWallet.isManagedWallet ? "Claim" : "Claim with Wallet";
  const claimedLabel = "Claimed";

  const handleDailyClaim = useCallback(async () => {
    const submitted = await flow.execute(
      (token) => buildClaimDailySpumpTransaction(token),
      managedWallet.isManagedWallet ? { action: "claim-daily-spump" } : undefined,
    );
    if (submitted) {
      setClaimed(true);
    }
  }, [flow, managedWallet.isManagedWallet]);

  return (
    <>
      <Head>
        <title>{t("page.rewards.title")}</title>
      </Head>

      <PageShell>
        <div className="mx-auto max-w-3xl space-y-5">
          <ProductReadinessBanner
            description="Daily SPUMP claim now uses the live S1 transaction builder: managed wallets submit through backend signing, and external wallets sign through the wallet adapter. Mission cards and streak progress remain fixture preview data."
            status="SEEDED_DEMO"
            title="Daily reward claim is transaction-wired; missions remain preview"
          />

          <section className="glass-card section-enter border-[#f3b33e]/20 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f3b33e]">Mixed rewards ledger</p>
                <p className="mt-1 text-sm font-semibold text-white">Daily claim is live-wired; mission progress is still preview.</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[#95a6bf]">
                  Use a signed-in managed wallet for one-click backend signing, or an external wallet for the normal wallet-sign flow.
                  Mission rewards still need live claim records and abuse controls before they affect holdings.
                </p>
              </div>
              <span className="w-fit rounded-full border border-[#f3b33e]/30 bg-[#f3b33e]/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#f8d48a]">
                SEEDED_DEMO
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REWARD_BOUNDARIES.map((item) => (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2" key={item.label}>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6f8099]">{item.label}</p>
                  <p className="mt-1 text-xs text-[#d7e3f4]">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Row 1: XP bar (left) + New User Boost (right) — parallel */}
          <div className="grid gap-3 md:grid-cols-2">
            <section className="glass-card section-enter px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#67b8ff]/15 text-xs font-bold text-[#67b8ff]">
                    {CURRENT_LEVEL}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white">Level {CURRENT_LEVEL}</p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#67b8ff]/20 bg-[#67b8ff]/8 px-2 py-0.5">
                        <span className="text-[9px] font-medium text-[#8ec8ff]">{locale === "zh" ? SCOUT_TIER_ZH : SCOUT_TIER_LABEL}</span>
                        <span className="rounded border border-[#f3b33e]/20 bg-[#1a1408]/50 px-1 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-[#f3c66e]">
                          Mock
                        </span>
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8ea0ba]">{fmt(totalXP)} / {fmt(LEVEL_XP)} XP</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-[#67b8ff]">Level {CURRENT_LEVEL + 1} →</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] to-[#65ecaf] transition-all duration-700"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </section>

            <section className="glass-card section-enter relative overflow-hidden p-3.5">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f3b33e]/[0.05] to-transparent" />
              <div className="relative flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">⚡</span>
                    <h3 className="text-xs font-bold tracking-[-0.02em] text-white">New User Boost</h3>
                    <span className="rounded-full bg-[#f3b33e]/15 px-1.5 py-0.5 text-[8px] font-bold text-[#f3b33e]">+25%</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#8ea0ba]">{BOOST_DAYS_LEFT} days remaining</p>
                </div>
              </div>
              <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f3b33e] to-[#f3b33e]/40"
                  style={{ width: `${((7 - BOOST_DAYS_LEFT) / 7) * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[8px] text-[#5a6b82]">
                <span>Day 1</span>
                <span>Day 7</span>
              </div>
            </section>
          </div>

          {/* Row 2: Claim button — prominent, centered */}
          <section className="section-enter flex flex-col items-center py-4">
            <div className="relative">
              {!claimed && (
                <>
                  <span className="absolute inset-0 -m-5 animate-ping rounded-full bg-[#de402a]/8" style={{ animationDuration: "2.2s" }} />
                  <span className="absolute inset-0 -m-2.5 animate-pulse rounded-full bg-[#de402a]/12" style={{ animationDuration: "1.6s" }} />
                </>
              )}
              {claimed && (
                <span className="absolute inset-0 -m-3 rounded-full bg-[#65ecaf]/8" />
              )}
              <button
                aria-label="Claim daily SPUMP"
                className={`relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 transition-all duration-500 md:h-36 md:w-36 ${
                  claimed
                    ? "border-[#65ecaf]/40 bg-[#65ecaf]/10 shadow-[0_0_50px_rgba(101,236,175,0.18)]"
                    : "border-[#de402a]/45 bg-[#de402a]/10 shadow-[0_0_70px_rgba(222,64,42,0.22)] hover:scale-[1.04] hover:shadow-[0_0_90px_rgba(222,64,42,0.3)]"
                }`}
                disabled={claimed || busy}
                onClick={() => void handleDailyClaim()}
                type="button"
              >
                {claimed ? (
                  <>
                    <span className="text-2xl">✓</span>
                    <span className="mt-0.5 text-sm font-bold tracking-[-0.03em] text-[#65ecaf]">{claimedLabel}</span>
                    <span className="text-xs font-medium text-[#65ecaf]/70">{fmt(DAILY_AMOUNT)}</span>
                    <span className="text-center text-[8px] uppercase tracking-[0.14em] text-[#65ecaf]/50">
                      {managedWallet.isManagedWallet ? "managed tx" : "wallet tx"}
                    </span>
                  </>
                ) : busy ? (
                  <>
                    <span className="text-2xl">...</span>
                    <span className="mt-1 text-xs font-bold tracking-[-0.02em] text-white">Claiming</span>
                    <span className="mt-0.5 text-lg font-bold tracking-[-0.04em] text-[#de402a]">{fmt(DAILY_AMOUNT)}</span>
                    <span className="text-[8px] uppercase tracking-[0.14em] text-[#8ea0ba]">SPUMP</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl">🪙</span>
                    <span className="mt-1 text-xs font-bold tracking-[-0.02em] text-white">{claimLabel}</span>
                    <span className="mt-0.5 text-lg font-bold tracking-[-0.04em] text-[#de402a]">{fmt(DAILY_AMOUNT)}</span>
                    <span className="text-[8px] uppercase tracking-[0.14em] text-[#8ea0ba]">SPUMP</span>
                  </>
                )}
              </button>
            </div>
            {flow.state.error ? (
              <p className="mt-3 max-w-sm text-center text-xs text-[#ff8a75]">{flow.state.error}</p>
            ) : null}
          </section>

          {/* Row 3: Login Streak — below the claim button */}
          <section className="section-enter">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white">Login Streak</h2>
              <span className="rounded-full bg-[#f3b33e]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#f3b33e]">
                ×{STREAK} Multiplier
              </span>
            </div>
            <div className="mt-2 flex justify-center gap-2 overflow-x-auto scrollbar-none">
              {Array.from({ length: 7 }, (_, i) => {
                const day = i + 1;
                const active = day <= STREAK;
                const current = day === STREAK;
                return (
                  <div
                    className={`liquid-pill flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full transition-all ${
                      current
                        ? "border-[#de402a]/40 bg-[#de402a]/12 text-white shadow-[0_0_18px_rgba(222,64,42,0.18)]"
                        : active
                          ? "border-[#65ecaf]/25 bg-[#65ecaf]/8 text-[#65ecaf]"
                          : "text-[#5a6b82]"
                    }`}
                    key={day}
                  >
                    <span className="text-[8px] uppercase">{active ? "✓" : ""}</span>
                    <span className="text-[10px] font-semibold">D{day}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Row 4: Mission grid */}
          <section className="section-enter">
            <h2 className="mb-3 text-sm font-bold tracking-[-0.04em] text-white">Engagement Missions</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {MISSIONS.map((m) => (
                <div
                  className={`glass-card relative p-3.5 transition-all ${
                    m.done
                      ? "border-[#65ecaf]/20 shadow-[0_0_20px_rgba(101,236,175,0.06)]"
                      : ""
                  }`}
                  key={m.name}
                >
                  {m.done && (
                    <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-[#65ecaf]/20" />
                  )}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-base">
                        {m.emoji}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">{m.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[10px] font-medium text-[#de402a]">{fmt(m.spump)} SPUMP</span>
                          <span className="text-[10px] text-[#8ea0ba]">+{m.xp} XP</span>
                        </div>
                      </div>
                    </div>
                    {m.done ? (
                      <span className="rounded-full bg-[#65ecaf]/15 px-2 py-0.5 text-[9px] font-medium text-[#65ecaf]">
                        Fixture
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-medium text-[#8ea0ba]">
                        Preview
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
}
