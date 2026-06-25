import Link from "next/link";
import { useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { formatUsd } from "@/lib/public-data";
import { WORKSPACE_BUYOUT_PATH } from "@/lib/routes";
import {
  WorkspacePersona,
  WorkspaceSponsorshipItem,
} from "@/lib/mocks/workspace";

/* ────────────────────────────  View model  ──────────────────────────── */

type OppKind = "campaign" | "buyout";
type OppBucket = "pending" | "active" | "done";

type Opportunity = {
  id: string;
  kind: OppKind;
  bucket: OppBucket;
  title: string;
  sponsorName: string;
  deadlineLabel: string;
  signed: boolean;
  // campaign only
  track1?: number;
  track2?: number;
  track3?: number;
  metric?: string;
  // buyout only
  budgetUsd?: number;
  // routing
  signHref: string;
};

const BUYOUT_CREATOR_BPS = 7000;
const BUYOUT_DISCOVERY_BPS = 2000;
const BUYOUT_PLATFORM_BPS = 1000;

const campaignBucket = (item: WorkspaceSponsorshipItem): OppBucket => {
  if (item.status === "SUBMITTED" || item.status === "CONFIRMED") return "done";
  if (item.actionOwner === "creator") return "pending";
  return "active";
};

const buildOpportunities = (persona: WorkspacePersona): Opportunity[] => {
  const opps: Opportunity[] = persona.sponsorshipItems.map((item) => {
    const bucket = campaignBucket(item);
    return {
      id: item.id,
      kind: "campaign" as const,
      bucket,
      title: item.manifestTitle,
      sponsorName: item.sponsorName,
      deadlineLabel: item.deadlineLabel,
      signed: bucket === "done",
      track1: item.track1BaseUsd,
      track2: item.track2PoolUsd,
      track3: item.track3PoolUsd,
      metric: item.metric,
      signHref: item.href ?? `/workspace/intents/${item.id}?demo=1`,
    };
  });

  if (persona.buyoutOffer) {
    opps.unshift({
      id: `buyout-${persona.wallet}`,
      kind: "buyout",
      bucket: "pending",
      title: persona.displayName,
      sponsorName: persona.buyoutOffer.sponsorName,
      deadlineLabel: persona.buyoutOffer.deadline,
      signed: false,
      budgetUsd: persona.buyoutOffer.budgetUsd,
      signHref: WORKSPACE_BUYOUT_PATH,
    });
  }

  return opps;
};

/* ────────────────────────────  Inbox (list + detail)  ──────────────────────────── */

export const OpportunityInbox = ({ persona }: { persona: WorkspacePersona }) => {
  const { t } = useI18n();
  const opps = useMemo(() => buildOpportunities(persona), [persona]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<OppBucket>("pending");

  const selected = selectedId ? opps.find((o) => o.id === selectedId) ?? null : null;

  if (selected) {
    return <OppDetail opp={selected} onBack={() => setSelectedId(null)} />;
  }

  const counts: Record<OppBucket, number> = {
    pending: opps.filter((o) => o.bucket === "pending").length,
    active: opps.filter((o) => o.bucket === "active").length,
    done: opps.filter((o) => o.bucket === "done").length,
  };
  const visible = opps.filter((o) => o.bucket === tab);

  const TABS: Array<{ id: OppBucket; label: string }> = [
    { id: "pending", label: t("ws.opps.tab.pending") },
    { id: "active", label: t("ws.opps.tab.active") },
    { id: "done", label: t("ws.opps.tab.done") },
  ];

  return (
    <div className="space-y-4 pb-4">
      <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-extrabold tracking-[-0.02em] text-white">
        {t("ws.opps.title")}
        <span className="text-[length:var(--fs-caption)] font-semibold text-[#7486a1]">{t("ws.opps.subtitle")}</span>
      </h1>

      <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] p-1">
        {TABS.map((it) => (
          <button
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[length:var(--fs-micro)] transition ${
              tab === it.id ? "bg-[#de402a]/[0.18] text-[#ff8a78] ring-1 ring-[#de402a]/30" : "text-[#9aabc4] hover:bg-white/[0.05] hover:text-white"
            }`}
            key={it.id}
            onClick={() => setTab(it.id)}
            type="button"
          >
            <span className="font-medium">{it.label}</span>
            <span className={`rounded-full px-1.5 py-px font-mono text-[length:var(--fs-micro)] ${tab === it.id ? "bg-[#de402a]/[0.16] text-[#ff8a78]" : "bg-white/[0.05] text-[#9aabc4]"}`}>
              {counts[it.id]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-4 py-10 text-center text-[length:var(--fs-overline)] text-[#7e90aa]">
          {t("ws.opps.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((opp) => (
            <OppCard key={opp.id} onOpen={() => setSelectedId(opp.id)} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
};

const KIND_META: Record<OppKind, { icon: string; iconBg: string; kindKey: string; kindColor: string }> = {
  campaign: { icon: "🎬", iconBg: "linear-gradient(135deg,#4a6cd4,#67b8ff)", kindKey: "ws.opps.kind.campaign", kindColor: "#9fd0ff" },
  buyout: { icon: "🎓", iconBg: "linear-gradient(135deg,#de7a2a,#e8a35a)", kindKey: "ws.opps.kind.buyout", kindColor: "#f0a08f" },
};

const STATUS_PILL: Record<OppBucket, { key: string; cls: string }> = {
  pending: { key: "ws.opps.status.pending", cls: "border-[#de402a]/30 bg-[#1f120e]/70 text-[#ff8a78]" },
  active: { key: "ws.opps.status.active", cls: "border-[#67b8ff]/25 bg-[#0e1726]/70 text-[#8ad0ff]" },
  done: { key: "ws.opps.status.done", cls: "border-[#65ecaf]/22 bg-[#0e1f17]/70 text-[#8df0c4]" },
};

const OppCard = ({ opp, onOpen }: { opp: Opportunity; onOpen: () => void }) => {
  const { t } = useI18n();
  const meta = KIND_META[opp.kind];
  const pill = STATUS_PILL[opp.bucket];
  const sub = opp.kind === "buyout"
    ? t("ws.opps.card.buyoutSub", { amount: formatUsd(opp.budgetUsd ?? 0) })
    : t("ws.opps.card.campaignSub", { sponsor: opp.sponsorName, deadline: opp.deadlineLabel });

  return (
    <button
      className={`flex w-full items-center gap-3 rounded-[16px] border px-3.5 py-3 text-left transition ${
        opp.bucket === "pending"
          ? "border-[#de402a]/25 bg-[#de402a]/[0.07] hover:border-[#de402a]/45"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]"
      }`}
      onClick={onOpen}
      type="button"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: meta.iconBg }}>
        {meta.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--fs-micro)]" style={{ color: meta.kindColor }}>{t(meta.kindKey)}</span>
        <span className="mt-0.5 block truncate text-[length:var(--fs-base)] font-bold text-white">{opp.title}</span>
        <span className="mt-0.5 block truncate text-[length:var(--fs-micro)] text-[#7486a1]">{sub}</span>
      </span>
      <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[length:var(--fs-nano)] font-semibold sm:inline ${pill.cls}`}>
        {t(pill.key)}
      </span>
      <span className="shrink-0 rounded-full border border-white/[0.16] px-3.5 py-1.5 text-[length:var(--fs-micro)] font-bold text-white">
        {t("ws.opps.view")}
      </span>
    </button>
  );
};

/* ────────────────────────────  Detail  ──────────────────────────── */

const OppDetail = ({ opp, onBack }: { opp: Opportunity; onBack: () => void }) => {
  const { t } = useI18n();
  const meta = KIND_META[opp.kind];
  const isBuyout = opp.kind === "buyout";

  return (
    <div className="space-y-4 pb-4">
      <button
        className="inline-flex items-center gap-1.5 text-[length:var(--fs-caption)] text-[#93a2bb] transition hover:text-white"
        onClick={onBack}
        type="button"
      >
        {t("ws.opps.back")}
      </button>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Left: human-readable terms */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: meta.iconBg }}>
              {meta.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[length:var(--fs-micro)]" style={{ color: meta.kindColor }}>
                {t(meta.kindKey)} · {t("ws.opps.from", { sponsor: opp.sponsorName })}
              </p>
              <h2 className="mt-0.5 text-xl font-extrabold leading-tight text-white">{opp.title}</h2>
            </div>
          </div>

          <Panel>
            <p className="mb-2 text-[length:var(--fs-micro)] text-[#93a2bb]">
              {isBuyout ? t("ws.opps.want.buyoutTitle") : t("ws.opps.want.campaignTitle")}
            </p>
            {isBuyout ? (
              <p className="text-[length:var(--fs-caption)] leading-relaxed text-[#dbe3ef]">
                {t("ws.opps.want.buyoutBody", { sponsor: opp.sponsorName, amount: formatUsd(opp.budgetUsd ?? 0) })}
              </p>
            ) : (
              <p className="text-[length:var(--fs-caption)] leading-relaxed text-[#dbe3ef]">
                {t("ws.opps.want.campaignBody")}
              </p>
            )}
          </Panel>

          {isBuyout ? <BuyoutSplit budgetUsd={opp.budgetUsd ?? 0} /> : <TrackBreakdown opp={opp} />}
        </div>

        {/* Right: action rail */}
        <ActionRail isBuyout={isBuyout} opp={opp} />
      </div>
    </div>
  );
};

const Panel = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4">{children}</section>
);

const BuyoutSplit = ({ budgetUsd }: { budgetUsd: number }) => {
  const { t } = useI18n();
  const creator = Math.round((budgetUsd * BUYOUT_CREATOR_BPS) / 10000);
  const discovery = Math.round((budgetUsd * BUYOUT_DISCOVERY_BPS) / 10000);
  const platform = budgetUsd - creator - discovery;

  return (
    <Panel>
      <p className="mb-3 text-[length:var(--fs-micro)] text-[#93a2bb]">
        {t("ws.opps.split.title", { amount: formatUsd(budgetUsd) })}
      </p>
      <div className="flex gap-2.5">
        <SplitCard accent highlight label={t("ws.opps.split.creator")} value={formatUsd(creator)} />
        <SplitCard label={t("ws.opps.split.discovery")} value={formatUsd(discovery)} />
        <SplitCard label={t("ws.opps.split.platform")} value={formatUsd(platform)} />
      </div>
      <p className="mt-3 rounded-[10px] border border-dashed border-white/[0.16] px-3 py-2.5 text-[length:var(--fs-micro)] leading-relaxed text-[#93a2bb]">
        {t("ws.opps.split.note")}
      </p>
      <p className="mt-2 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.16em] text-[#7e90aa]">
        {t("ws.opps.split.estimate")}
      </p>
    </Panel>
  );
};

const SplitCard = ({ label, value, highlight, accent }: { label: string; value: string; highlight?: boolean; accent?: boolean }) => (
  <div
    className={`flex-1 rounded-[10px] border px-3 py-2.5 ${
      highlight ? "border-[#65ecaf]/28 bg-[#65ecaf]/[0.10]" : "border-white/[0.08] bg-white/[0.03]"
    }`}
  >
    <p className={`text-[length:var(--fs-nano)] ${accent ? "text-[#7ce0b0]" : "text-[#7486a1]"}`}>{label}</p>
    <p className="mt-0.5 text-lg font-extrabold text-white">{value}</p>
  </div>
);

const TrackBreakdown = ({ opp }: { opp: Opportunity }) => {
  const { t } = useI18n();
  const track3Enabled = (opp.track3 ?? 0) > 0;

  return (
    <Panel>
      <p className="mb-3 text-[length:var(--fs-micro)] text-[#93a2bb]">{t("ws.opps.tracks.title")}</p>
      <div className="space-y-2">
        <TrackRow accent="#de402a" title={t("ws.opps.tracks.base")} sub={t("ws.opps.tracks.baseSub")} amount={formatUsd(opp.track1 ?? 0)} />
        <TrackRow
          accent="#67b8ff"
          title={t("ws.opps.tracks.perf")}
          sub={t("ws.opps.tracks.perfSub", { metric: opp.metric ?? "" })}
          amount={t("ws.opps.tracks.perfMax", { amount: formatUsd(opp.track2 ?? 0) })}
        />
        <TrackRow
          accent="rgba(255,255,255,0.16)"
          dim
          title={t("ws.opps.tracks.cps")}
          sub={track3Enabled ? formatUsd(opp.track3 ?? 0) : t("ws.opps.tracks.cpsOff")}
          amount={track3Enabled ? formatUsd(opp.track3 ?? 0) : "—"}
        />
      </div>
    </Panel>
  );
};

const TrackRow = ({ accent, title, sub, amount, dim }: { accent: string; title: string; sub: string; amount: string; dim?: boolean }) => (
  <div className={`flex items-center gap-3 rounded-[10px] bg-white/[0.03] px-3 py-2.5 ${dim ? "opacity-60" : ""}`} style={{ borderLeft: `3px solid ${accent}` }}>
    <div className="min-w-0 flex-1">
      <p className="text-[length:var(--fs-caption)] font-bold text-white">{title}</p>
      <p className="mt-0.5 text-[length:var(--fs-nano)] text-[#7486a1]">{sub}</p>
    </div>
    <p className="shrink-0 text-[length:var(--fs-base)] font-extrabold text-white">{amount}</p>
  </div>
);

const ActionRail = ({ opp, isBuyout }: { opp: Opportunity; isBuyout: boolean }) => {
  const { t } = useI18n();

  if (opp.signed) {
    return (
      <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-6 text-center lg:sticky lg:top-6">
        <div className="text-3xl">✓</div>
        <p className="mt-1.5 text-lg font-extrabold text-white">
          {isBuyout ? t("ws.opps.signed.buyout") : t("ws.opps.signed.campaign")}
        </p>
        <p className="mt-1.5 text-[length:var(--fs-caption)] leading-relaxed text-[#93a2bb]">
          {isBuyout ? t("ws.opps.signed.noteBuyout") : t("ws.opps.signed.noteCampaign")}
        </p>
      </section>
    );
  }

  const total = isBuyout
    ? formatUsd(opp.budgetUsd ?? 0)
    : `${formatUsd(opp.track1 ?? 0)} ~ ${formatUsd((opp.track1 ?? 0) + (opp.track2 ?? 0))}`;
  const creatorTake = isBuyout
    ? formatUsd(Math.round(((opp.budgetUsd ?? 0) * BUYOUT_CREATOR_BPS) / 10000))
    : t("ws.opps.detail.deadlineVal", { deadline: opp.deadlineLabel });

  return (
    <section className="space-y-3 rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-4 lg:sticky lg:top-6">
      <div>
        <p className="text-[length:var(--fs-micro)] text-[#7486a1]">
          {isBuyout ? t("ws.opps.detail.totalBuyout") : t("ws.opps.detail.totalCampaign")}
        </p>
        <p className="mt-0.5 text-2xl font-extrabold text-white">{total}</p>
        <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7486a1]">
          {isBuyout
            ? t("ws.opps.detail.totalSubBuyout", { amount: creatorTake })
            : t("ws.opps.detail.totalSubCampaign")}
        </p>
      </div>

      <div className="space-y-2 border-t border-white/[0.1] pt-3">
        <RailRow label={isBuyout ? t("ws.opps.detail.youGet") : t("ws.opps.detail.deadline")} value={creatorTake} />
        <RailRow accent label={t("ws.opps.detail.fundStatus")} value={t("ws.opps.detail.escrowed")} />
        <RailRow label={t("ws.opps.detail.replyBy")} value={opp.deadlineLabel} />
      </div>

      <Link
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] text-[length:var(--fs-base)] font-bold text-white shadow-[0_10px_24px_rgba(222,64,42,0.28)] transition hover:brightness-110"
        href={opp.signHref}
      >
        {isBuyout ? t("ws.opps.cta.signBuyout") : t("ws.opps.cta.signCampaign")}
      </Link>

      <div className="flex gap-2">
        <PreviewBtn label={t("ws.opps.cta.negotiate")} />
        <PreviewBtn label={t("ws.opps.cta.decline")} />
      </div>

      <p className="text-center text-[length:var(--fs-nano)] leading-relaxed text-[#7486a1]">{t("ws.opps.cta.note")}</p>
      <p className="rounded-md border border-[#f3b33e]/20 bg-[#2a1f0b]/50 px-2.5 py-1.5 text-center text-[length:var(--fs-nano)] font-semibold text-[#f3c66e]">
        {t("ws.opps.cta.seeded")}
      </p>
    </section>
  );
};

const RailRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between text-[length:var(--fs-caption)]">
    <span className="text-[#7486a1]">{label}</span>
    <span className={`font-bold ${accent ? "text-[#2fbf71]" : "text-white"}`}>{value}</span>
  </div>
);

const PreviewBtn = ({ label }: { label: string }) => {
  const { t } = useI18n();
  return (
    <button
      aria-disabled="true"
      className="flex h-9 flex-1 cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[length:var(--fs-micro)] font-medium text-[#7e90aa]"
      disabled
      title={t("ws.opps.cta.previewHint")}
      type="button"
    >
      {label}
    </button>
  );
};
