import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { findCreator, formatUsd } from "@/lib/public-data";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TrackStatus = "PENDING" | "SETTLED" | "VOIDED";

type Track1 = {
  label: string;
  budgetUsd: number;
  status: TrackStatus;
  creatorWallet: string;
};

type Track2 = {
  label: string;
  budgetUsd: number;
  target: number;
  actual: number;
  cliffPct: number;
  fanPoolPct: number;
  status: TrackStatus;
  creatorPayoutUsd: number;
  fanPoolUsd: number;
  sponsorRefundUsd: number;
};

type Track3 = {
  label: string;
  budgetUsd: number;
  approvedCpsUsd: number;
  status: TrackStatus;
  creatorPayoutUsd: number;
  sponsorRefundUsd: number;
  delayed: boolean;
};

type SettlementData = {
  proposalId: string;
  status: "RESOLVED_SUCCESS" | "RESOLVED_FAIL" | "VOIDED";
  track1: Track1;
  track2: Track2;
  track3: Track3;
};

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK: SettlementData = {
  proposalId: "prop-neo-park-2026q2",
  status: "RESOLVED_SUCCESS",
  track1: {
    label: "Fixed Base",
    budgetUsd: 100_000,
    status: "SETTLED",
    creatorWallet: "5Yk3...R8wF",
  },
  track2: {
    label: "Performance",
    budgetUsd: 1_000_000,
    target: 1000,
    actual: 800,
    cliffPct: 50,
    fanPoolPct: 20,
    status: "SETTLED",
    creatorPayoutUsd: 640_000,
    fanPoolUsd: 160_000,
    sponsorRefundUsd: 200_000,
  },
  track3: {
    label: "CPS Commission",
    budgetUsd: 300_000,
    approvedCpsUsd: 250_000,
    status: "SETTLED",
    creatorPayoutUsd: 250_000,
    sponsorRefundUsd: 50_000,
    delayed: false,
  },
};

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                     */
/* ------------------------------------------------------------------ */

const C = {
  accent: "#de402a",
  success: "#65ecaf",
  warning: "#f3b33e",
  info: "#67b8ff",
  dim: "#1e2536",
  dimBorder: "#2a3348",
  text2: "#8ea0ba",
  bg: "#090d14",
  card: "#121826",
  creator: "#67b8ff",
  fan: "#f3b33e",
  sponsor: "#8ea0ba",
  refund: "#de402a",
} as const;

/* ------------------------------------------------------------------ */
/*  Radial gauge (Track 2)                                             */
/* ------------------------------------------------------------------ */

function AchievementGauge({ target, actual, cliffPct }: { actual: number; cliffPct: number; target: number }) {
  const pct = Math.min(actual / target, 1);
  const aboveCliff = pct >= cliffPct / 100;

  const r = 82;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;

  const startAngle = -90;
  const fillAngle = pct * 360;
  const cliffAngle = (cliffPct / 100) * 360;

  const polarToCart = (angleDeg: number, radius: number) => ({
    x: cx + radius * Math.cos(((angleDeg + startAngle) * Math.PI) / 180),
    y: cy + radius * Math.sin(((angleDeg + startAngle) * Math.PI) / 180),
  });

  const cliffOuter = polarToCart(cliffAngle, r + 10);
  const cliffInner = polarToCart(cliffAngle, r - 10);

  return (
    <div className="flex flex-col items-center">
      <svg className="drop-shadow-[0_0_24px_rgba(101,236,175,0.15)]" height="200" viewBox="0 0 200 200" width="200">
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={r}
          stroke={C.dim}
          strokeWidth="14"
        />

        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={r}
          stroke={aboveCliff ? C.success : C.accent}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          strokeWidth="14"
          style={{ transition: "stroke-dashoffset 1.2s ease-out", transform: "rotate(-90deg)", transformOrigin: "center" }}
        />

        <line
          stroke={C.warning}
          strokeDasharray="4 3"
          strokeWidth="2"
          x1={cliffInner.x}
          x2={cliffOuter.x}
          y1={cliffInner.y}
          y2={cliffOuter.y}
        />
        <text
          dominantBaseline="central"
          fill={C.warning}
          fontSize="9"
          textAnchor="middle"
          x={polarToCart(cliffAngle, r + 20).x}
          y={polarToCart(cliffAngle, r + 20).y}
        >
          cliff
        </text>

        <text dominantBaseline="central" fill="white" fontSize="22" fontWeight="600" textAnchor="middle" x={cx} y={cy - 8}>
          {actual.toLocaleString()} / {target.toLocaleString()}
        </text>
        <text dominantBaseline="central" fill={aboveCliff ? C.success : C.accent} fontSize="16" fontWeight="700" textAnchor="middle" x={cx} y={cy + 18}>
          {Math.round(pct * 100)}%
        </text>
      </svg>

      <p className="mt-2 text-xs text-[#8ea0ba]">
        {aboveCliff ? "Above cliff — creator qualifies" : "Below cliff — no payout"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail pipeline                                                      */
/* ------------------------------------------------------------------ */

function RailPipeline({ data }: { data: SettlementData }) {
  const total = data.track1.budgetUsd + data.track2.budgetUsd + data.track3.budgetUsd;
  const tracks = [
    { key: "T1", ...data.track1, budget: data.track1.budgetUsd, color: C.info },
    { key: "T2", ...data.track2, budget: data.track2.budgetUsd, color: C.success },
    { key: "T3", ...data.track3, budget: data.track3.budgetUsd, color: C.warning },
  ];

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.24em] text-[#7486a1]">Settlement pipeline</p>
        <p className="text-xs text-[#8ea0ba]">Total {formatUsd(total)}</p>
      </div>

      <div className="flex h-14 w-full gap-1 overflow-hidden rounded-full">
        {tracks.map((t, i) => {
          const widthPct = (t.budget / total) * 100;
          const settled = t.status === "SETTLED";
          const voided = t.status === "VOIDED";

          return (
            <div
              className="relative flex items-center justify-center overflow-hidden transition-all duration-1000 ease-out"
              key={t.key}
              style={{
                width: animate ? `${widthPct}%` : "0%",
                transitionDelay: `${i * 200}ms`,
                background: settled
                  ? `linear-gradient(135deg, ${t.color}22, ${t.color}44)`
                  : voided
                    ? `linear-gradient(135deg, ${C.accent}22, ${C.accent}44)`
                    : C.dim,
                borderLeft: i > 0 ? `1px solid ${C.dimBorder}` : undefined,
              }}
            >
              {settled && (
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: `radial-gradient(ellipse at center, ${t.color}55, transparent 70%)`,
                  }}
                />
              )}

              <div className="relative z-10 text-center">
                <p className="text-[11px] font-semibold text-white">{t.key}</p>
                <p className="text-[10px]" style={{ color: settled ? t.color : C.text2 }}>
                  {formatUsd(t.budget)}
                </p>
              </div>

              {settled && (
                <div
                  className="absolute bottom-1 right-2 h-1.5 w-1.5 rounded-full"
                  style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-4">
        {tracks.map((t) => (
          <div className="flex items-center gap-1.5" key={t.key}>
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: t.status === "SETTLED" ? t.color : C.dimBorder }}
            />
            <span className="text-[10px] text-[#8ea0ba]">
              {t.key} {t.label} — {t.status === "SETTLED" ? "Settled" : t.status === "VOIDED" ? "Voided" : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Money-flow stacked bars                                            */
/* ------------------------------------------------------------------ */

type FlowSegment = { label: string; amount: number; color: string };

function MoneyFlow({ data }: { data: SettlementData }) {
  const flows: { label: string; total: number; segments: FlowSegment[] }[] = [
    {
      label: "Track 1 — Fixed",
      total: data.track1.budgetUsd,
      segments: [{ label: "Creator", amount: data.track1.budgetUsd, color: C.creator }],
    },
    {
      label: "Track 2 — Performance",
      total: data.track2.budgetUsd,
      segments: [
        { label: "Creator", amount: data.track2.creatorPayoutUsd, color: C.creator },
        { label: "Fan pool", amount: data.track2.fanPoolUsd, color: C.fan },
        { label: "Sponsor refund", amount: data.track2.sponsorRefundUsd, color: C.sponsor },
      ],
    },
    {
      label: "Track 3 — CPS",
      total: data.track3.budgetUsd,
      segments: [
        { label: "Creator", amount: data.track3.creatorPayoutUsd, color: C.creator },
        { label: "Sponsor refund", amount: data.track3.sponsorRefundUsd, color: C.sponsor },
      ],
    },
  ];

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[#7486a1]">Money flow — USDC distribution</p>

      {flows.map((flow) => (
        <div key={flow.label}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-sm font-medium text-white">{flow.label}</p>
            <p className="text-xs text-[#8ea0ba]">{formatUsd(flow.total)}</p>
          </div>

          <div className="flex h-8 w-full overflow-hidden rounded-full" style={{ background: C.dim }}>
            {flow.segments.map((seg, i) => {
              const pct = (seg.amount / flow.total) * 100;
              return (
                <div
                  className="relative flex items-center justify-center overflow-hidden transition-all duration-1000 ease-out"
                  key={seg.label}
                  style={{
                    width: animate ? `${pct}%` : "0%",
                    transitionDelay: `${i * 150}ms`,
                    background: `${seg.color}33`,
                    borderRight: i < flow.segments.length - 1 ? `1px solid ${C.card}` : undefined,
                  }}
                >
                  {pct > 12 && (
                    <span className="relative z-10 truncate px-2 text-[10px] font-medium" style={{ color: seg.color }}>
                      {seg.label} {formatUsd(seg.amount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex flex-wrap gap-3">
            {flow.segments.map((seg) => (
              <span className="flex items-center gap-1 text-[10px] text-[#8ea0ba]" key={seg.label}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: seg.color }} />
                {seg.label}: {formatUsd(seg.amount)}
              </span>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-4 pt-2">
        {[
          { label: "Creator", color: C.creator },
          { label: "Fan pool", color: C.fan },
          { label: "Sponsor refund", color: C.sponsor },
        ].map((leg) => (
          <span className="flex items-center gap-1.5 text-xs text-[#8ea0ba]" key={leg.label}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: leg.color }} />
            {leg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Track detail cards                                                 */
/* ------------------------------------------------------------------ */

function TrackCard({ children, color, status, title }: { children: React.ReactNode; color: string; status: TrackStatus; title: string }) {
  return (
    <div
      className="glass-card relative overflow-hidden rounded-[28px] p-6 transition-shadow duration-500"
      style={{
        boxShadow: status === "SETTLED" ? `0 0 40px ${color}12` : undefined,
        borderTop: `2px solid ${status === "SETTLED" ? color : C.dimBorder}`,
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{title}</h3>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            background: status === "SETTLED" ? `${color}22` : status === "VOIDED" ? `${C.accent}22` : `${C.dim}`,
            color: status === "SETTLED" ? color : status === "VOIDED" ? C.accent : C.text2,
          }}
        >
          {status}
        </span>
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value, color }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs text-[#8ea0ba]">{label}</span>
      <span className="text-sm font-medium" style={{ color: color ?? "white" }}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Void overlay                                                       */
/* ------------------------------------------------------------------ */

function VoidOverlay({ total }: { total: number }) {
  return (
    <div className="section-enter absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[28px] bg-[#090d14]/85 backdrop-blur-sm">
      <div className="rounded-full bg-[#de402a]/15 px-6 py-2">
        <span className="text-lg font-bold tracking-[-0.03em] text-[#de402a]">VOIDED</span>
      </div>
      <p className="mt-3 text-sm text-[#8ea0ba]">Emergency void — full refund to sponsor</p>
      <p className="mt-1 text-2xl font-semibold text-white">{formatUsd(total)}</p>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#de402a]" />
        <span className="text-xs text-[#de402a]">All tracks returned to vault</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SettlementPage() {
  const data = MOCK;
  const creator = useMemo(() => findCreator("neo-park"), []);
  const isVoided = data.status === "VOIDED";
  const totalBudget = data.track1.budgetUsd + data.track2.budgetUsd + data.track3.budgetUsd;
  const totalCreatorPayout = data.track1.budgetUsd + data.track2.creatorPayoutUsd + data.track3.creatorPayoutUsd;

  return (
    <>
      <Head>
        <title>StreamPump | Settlement — {creator.name}</title>
      </Head>

      <PageShell
        eyebrow="S2 Settlement"
        subtitle={`Oracle-resolved tri-track settlement for ${creator.name} (${creator.handle})`}
        title="Settlement Dashboard"
      >
        <div className="relative space-y-6">
          {/* ---- Top stats ---- */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total budget", value: formatUsd(totalBudget), color: "white" },
              { label: "Creator payout", value: formatUsd(totalCreatorPayout), color: C.success },
              { label: "Status", value: data.status.replace(/_/g, " "), color: data.status === "VOIDED" ? C.accent : C.success },
            ].map((s) => (
              <div className="surface-muted flex flex-col items-center rounded-[28px] p-5 text-center" key={s.label}>
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#7486a1]">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ---- Rail pipeline ---- */}
          <section className="liquid-card rounded-[28px] p-6">
            <RailPipeline data={data} />
          </section>

          {/* ---- Money flow ---- */}
          <section className="liquid-card rounded-[28px] p-6">
            <MoneyFlow data={data} />
          </section>

          {/* ---- Track 2 gauge + Track cards ---- */}
          <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
            <section className="liquid-card flex flex-col items-center justify-center rounded-[28px] p-6">
              <p className="mb-4 text-xs uppercase tracking-[0.24em] text-[#7486a1]">Track 2 achievement</p>
              <AchievementGauge actual={data.track2.actual} cliffPct={data.track2.cliffPct} target={data.track2.target} />
            </section>

            <div className="grid gap-5 md:grid-cols-3">
              {/* Track 1 */}
              <TrackCard color={C.info} status={data.track1.status} title="Track 1">
                <DetailRow label="Type" value="Fixed base pay" />
                <DetailRow label="Amount" value={formatUsd(data.track1.budgetUsd)} color={C.info} />
                <DetailRow label="Paid to" value={data.track1.creatorWallet} />
                <DetailRow label="Status" value={data.track1.status === "SETTLED" ? "Paid" : "Pending"} color={data.track1.status === "SETTLED" ? C.success : C.text2} />
              </TrackCard>

              {/* Track 2 */}
              <TrackCard color={C.success} status={data.track2.status} title="Track 2">
                <DetailRow label="Budget" value={formatUsd(data.track2.budgetUsd)} />
                <DetailRow label="Target" value={data.track2.target.toLocaleString() + " views"} />
                <DetailRow label="Actual" value={data.track2.actual.toLocaleString() + " views"} />
                <DetailRow label="Achievement" value={Math.round((data.track2.actual / data.track2.target) * 100) + "%"} color={C.success} />
                <DetailRow label="Creator share" value={formatUsd(data.track2.creatorPayoutUsd)} color={C.creator} />
                <DetailRow label="Fan pool" value={formatUsd(data.track2.fanPoolUsd)} color={C.fan} />
                <DetailRow label="Sponsor refund" value={formatUsd(data.track2.sponsorRefundUsd)} color={C.sponsor} />
              </TrackCard>

              {/* Track 3 */}
              <TrackCard color={C.warning} status={data.track3.status} title="Track 3">
                <DetailRow label="Budget" value={formatUsd(data.track3.budgetUsd)} />
                <DetailRow label="Approved CPS" value={formatUsd(data.track3.approvedCpsUsd)} />
                <DetailRow label="Creator payout" value={formatUsd(data.track3.creatorPayoutUsd)} color={C.creator} />
                <DetailRow label="Sponsor refund" value={formatUsd(data.track3.sponsorRefundUsd)} color={C.sponsor} />
                <DetailRow label="Delay" value={data.track3.delayed ? "Delayed" : "On time"} color={data.track3.delayed ? C.warning : C.success} />
              </TrackCard>
            </div>
          </div>

          {/* ---- Void overlay ---- */}
          {isVoided && <VoidOverlay total={totalBudget} />}
        </div>
      </PageShell>
    </>
  );
}
