import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useMemo, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { DemoActionStatusCard } from "@/components/shared/DemoActionStatusCard";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { useDemoActionFlow } from "@/hooks/useDemoActionFlow";
import { useI18n } from "@/lib/i18n";
import { compactNumber, findCreator, formatUsd } from "@/lib/public-data";

const creator = findCreator("neo-park");

const SPONSOR_NAME = "Nova Screen";
const CAMPAIGN_BRIEF = "Nova Screen's sponsored review video reaches 10,000 likes within the campaign window.";
const TRACK1_BASE = 100_000;
const TRACK2_BUDGET = 1_000_000;
const TRACK3_BUDGET = 300_000;
const TRACK2_TARGET = 10_000;
const TRACK2_METRIC = "Likes";
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

const DIAL_SIZE = 240;
const DIAL_STROKE = 10;
const DIAL_RADIUS = (DIAL_SIZE - DIAL_STROKE) / 2;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

const tracks = [
  { label: "Track 1 · Base", value: TRACK1_BASE, settled: true, color: "#65ecaf" },
  { label: `Track 2 · ${TRACK2_METRIC}`, value: TRACK2_BUDGET, settled: false, color: "#67b8ff" },
  { label: "Track 3 · CPS", value: TRACK3_BUDGET, settled: false, color: "#f3b33e" },
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function EndorsePage() {
  const router = useRouter();
  const { locale } = useI18n();
  const [stakeAmount, setStakeAmount] = useState(10_000);
  const [endorsers, setEndorsers] = useState(ENDORSERS);
  const [demoSummary, setDemoSummary] = useState<string | null>(null);
  const demoFlow = useDemoActionFlow();
  const dialRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const fraction = stakeAmount / FAN_BALANCE;
  const dashOffset = DIAL_CIRCUMFERENCE * (1 - fraction);

  const totalEndorsed = endorsers.reduce((s, e) => s + e.amount, 0);
  const projectedEndorsed = totalEndorsed + stakeAmount;
  const successUsdc = (stakeAmount / projectedEndorsed) * FAN_POOL_SHARE;
  const failLoss = stakeAmount * 0.05;
  const creatorName = locale === "en" ? "Midnight Save" : creator.name;
  const campaignTitle = `${creatorName} × ${SPONSOR_NAME}`;
  const routeProposalId = router.isReady ? String(router.query.proposalId ?? "").trim() : "";

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

  const handleConfirmEndorse = useCallback(
    (options?: { fail?: boolean }) => {
      demoFlow.submit({
        fail: options?.fail,
        onSuccess: () => {
          setEndorsers((items) => {
            const withoutYou = items.filter((item) => item.name !== "You");
            return [{ name: "You", amount: stakeAmount }, ...withoutYou];
          });
          setDemoSummary(`Preview endorsed with ${compactNumber(stakeAmount)} SPUMP.`);
        },
      });
    },
    [demoFlow, stakeAmount],
  );

  return (
    <>
      <Head>
        <title>{`StreamPump | Endorse ${creatorName}`}</title>
      </Head>
      <PageShell eyebrow="S2 Endorsement Preview" title={`Endorse ${creatorName}`}>
        <div className="space-y-5">
          <ProductReadinessBanner
            description="Stake amount, endorser list, and success state update locally. There is no live fan endorsement position, SPUMP burn, endorsement PDA, claim state, or pool distribution wired on this page."
            status="MOCK_PREVIEW"
            title="S2 endorsement is a local interaction preview"
          />
          <EndorsementPreviewNotice proposalId={routeProposalId} />

          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* ── Left column ── */}
          <div className="space-y-5">
            {/* ── Campaign target ── */}
            <section className="liquid-card section-enter rounded-[28px] p-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#67b8ff]">Campaign Target</p>
              <h2 className="mt-2 text-lg font-bold tracking-[-0.03em] text-white">{campaignTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[#9aabc4]">{CAMPAIGN_BRIEF}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-[#5a6d87]">Metric</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{compactNumber(TRACK2_TARGET)} {TRACK2_METRIC}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-[#5a6d87]">Cliff</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{TRACK2_CLIFF * 100}%</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-[#5a6d87]">Fan Pool</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#65ecaf]">{formatUsd(FAN_POOL_SHARE)}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-[#5a6d87]">Deadline</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{DEADLINE}</p>
                </div>
              </div>
            </section>

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
                        {t.settled ? "Settled" : `${compactNumber(TRACK2_CURRENT)} / ${compactNumber(TRACK2_TARGET)} ${TRACK2_METRIC.toLowerCase()} · ${pct.toFixed(0)}%`}
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
                  alt={creatorName}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                  {creatorName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{creatorName}</p>
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
                {endorsers.map((e) => (
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
                  ["Track 2 target", `${compactNumber(TRACK2_TARGET)} ${TRACK2_METRIC.toLowerCase()}`],
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
            <button
              className="glass-button-primary section-enter w-full rounded-full py-4 text-base font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={demoFlow.busy || demoFlow.state.status === "success"}
              onClick={demoFlow.begin}
              type="button"
            >
              {demoFlow.busy
                ? "Simulating..."
                : demoFlow.state.status === "success"
                  ? "Preview endorsed"
                  : `Preview endorse ${compactNumber(stakeAmount)} SPUMP`}
            </button>
            <DemoActionStatusCard
              amountLabel={`${compactNumber(stakeAmount)} SPUMP`}
              confirmLabel="Confirm Preview"
              description="Confirm this mock SPUMP endorsement. No wallet signature, token burn, endorsement PDA, or backend write will occur; the endorser list updates locally."
              onCancel={demoFlow.reset}
              onConfirm={handleConfirmEndorse}
              onRetry={demoFlow.retry}
              state={demoFlow.state}
              successLabel="Preview endorsed"
              title="Mock endorsement confirmation"
            />
            {demoSummary ? (
              <div className="rounded-[18px] border border-[#65ecaf]/20 bg-[#0e1f17]/45 px-4 py-3 text-[12px] font-medium text-[#8df0c4]">
                {demoSummary}
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </PageShell>
    </>
  );
}

const EndorsementPreviewNotice = ({ proposalId }: { proposalId: string }) => (
  <section className="rounded-[20px] border border-[#f3b33e]/25 bg-[#1f1708]/60 px-4 py-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-[#f3c66e]">Local simulator</p>
        <p className="mt-1 text-sm font-semibold text-white">No campaign projection is loaded here</p>
        <p className="mt-2 text-xs leading-5 text-[#a7b2c4]">
          The route keeps the proposal id for context, but this surface currently uses local fixture values only. Real promotion requires SPUMP burn, endorsement PDA creation, reward pool projection, and claim state from the backend/indexer.
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-[#f3b33e]/30 bg-[#2a1f0b] px-3 py-1 font-mono text-[10px] font-semibold text-[#f8d48a]">
        {proposalId || "proposal pending"}
      </span>
    </div>
  </section>
);
