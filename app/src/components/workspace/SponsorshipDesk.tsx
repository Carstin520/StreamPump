import { useMemo, useState } from "react";

import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  SignatureIcon,
  SparklesIcon,
  WarningIcon,
} from "@/components/shared/AppIcons";
import { ProposalIntentStatus } from "@/lib/api/types";
import { intents } from "@/lib/mocks/workspace";
import { formatUsd } from "@/lib/public-data";
import {
  INTENT_STATUS_LABELS,
  INTENT_STATUS_TONES,
} from "@/components/workspace/OverviewConsole";

type DeskFilter =
  | "all"
  | "needs-action"
  | "awaiting-sponsor"
  | "awaiting-creator"
  | "funded"
  | "settlement"
  | "resolved";

const FILTERS: Array<{ id: DeskFilter; label: string; description: string }> = [
  { id: "needs-action", label: "Needs Action", description: "Items waiting on your wallet" },
  { id: "awaiting-creator", label: "Awaiting Creator", description: "Creator signature pending" },
  { id: "awaiting-sponsor", label: "Awaiting Sponsor", description: "Sponsor signature / funding pending" },
  { id: "funded", label: "Funded", description: "USDC locked, awaiting performance" },
  { id: "settlement", label: "Settlement", description: "Oracle reconciliation in progress" },
  { id: "resolved", label: "Resolved", description: "Confirmed on-chain" },
  { id: "all", label: "All", description: "Every campaign on the desk" },
];

type ViewerRole = "Creator" | "Sponsor" | "Observer";

type DeskCampaign = {
  id: string;
  title: string;
  creatorName: string;
  sponsorName: string;
  manifestId: string;
  manifestHash: string;
  anchorPda: string;
  proposalPda: string;
  usdcVaultPda: string;
  status: ProposalIntentStatus | "FUNDED" | "SETTLEMENT_READY" | "RESOLVED";
  viewerRole: ViewerRole;
  deadlineLabel: string;
  needsActionFor: ViewerRole | null;
  latestTxShort: string | null;
  track1BaseUsd: number;
  track2PoolUsd: number;
  track3PoolUsd: number;
  track1Metric: string;
  track1Target: string;
  track1Actual: string;
  track2Metric: string;
  track2Target: string;
  track2Actual: string;
  track3Metric: string;
  track3Target: string;
  track3Actual: string;
  signatures: SignatureChecklistItem[];
  proof: ProofChecklistItem[];
  settlement: SettlementSummary;
  oracleStatus: "Pending" | "Synced" | "Verifying";
  riskFlags: string[];
};

type SignatureChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: "done" | "waiting" | "failed" | "expired" | "pending";
  owner?: ViewerRole;
};

type ProofChecklistItem = {
  id: string;
  label: string;
  status: "done" | "pending" | "failed";
  detail: string;
};

type SettlementSummary = {
  track1Settled: boolean;
  track2Settled: boolean;
  track3Settled: boolean;
  remainingUsdc: number;
  settlementTx: string | null;
};

const stableHash = (seed: string, len = 6) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0");
  return hex.repeat(2).slice(0, len);
};

const buildPda = (seed: string) =>
  `${stableHash(seed, 4)}…${stableHash(`${seed}-tail`, 4)}`;

const buildManifestHash = (seed: string) =>
  `0x${stableHash(seed, 8)}…${stableHash(`${seed}-h`, 4)}`;

const buildDeskCampaigns = (): DeskCampaign[] => [
  {
    id: intents[0].id,
    title: intents[0].manifestTitle,
    creatorName: intents[0].creatorName,
    sponsorName: intents[0].sponsorName,
    manifestId: "cmna6yckj0000qt4p9rehgen0",
    manifestHash: buildManifestHash(intents[0].id),
    anchorPda: buildPda(`${intents[0].id}-anchor`),
    proposalPda: buildPda(`${intents[0].id}-proposal`),
    usdcVaultPda: buildPda(`${intents[0].id}-vault`),
    status: "CREATOR_PARTIALLY_SIGNED",
    viewerRole: "Creator",
    deadlineLabel: intents[0].deadlineLabel,
    needsActionFor: "Sponsor",
    latestTxShort: null,
    track1BaseUsd: intents[0].track1BaseUsd,
    track2PoolUsd: intents[0].track2PoolUsd,
    track3PoolUsd: intents[0].track3PoolUsd,
    track1Metric: "Base payout",
    track1Target: "Manifest delivered",
    track1Actual: "Awaiting submission",
    track2Metric: intents[0].metric,
    track2Target: intents[0].targetValue,
    track2Actual: "Pending settlement",
    track3Metric: "CPS",
    track3Target: "30 day window",
    track3Actual: "Not started",
    signatures: [
      { id: "creator", label: "Creator signature", detail: "Wallet 9mBx…f2Kw", status: "done", owner: "Creator" },
      { id: "sponsor", label: "Sponsor signature", detail: "Wallet 4Kv2…Wq9p", status: "waiting", owner: "Sponsor" },
      { id: "bundle", label: "Backend bundle built", detail: "Bundle id bdl_lr_002", status: "done" },
      { id: "vtx", label: "Versioned tx ready", detail: "expires in 36 min", status: "done" },
      { id: "submit", label: "On-chain submit", detail: "awaiting full signature", status: "pending" },
      { id: "confirm", label: "Confirmation", detail: "—", status: "pending" },
    ],
    proof: [
      { id: "manifest", label: "Manifest anchored", status: "done", detail: "Slot 312804" },
      { id: "feed", label: "Feed sync", status: "done", detail: "Public projection live" },
      { id: "mux", label: "Mux metrics", status: "pending", detail: "Awaiting first impression" },
      { id: "oracle", label: "Oracle proof", status: "pending", detail: "Track 2 sync queued" },
    ],
    settlement: {
      track1Settled: false,
      track2Settled: false,
      track3Settled: false,
      remainingUsdc: intents[0].track1BaseUsd + intents[0].track2PoolUsd + intents[0].track3PoolUsd,
      settlementTx: null,
    },
    oracleStatus: "Pending",
    riskFlags: ["Bundle expires in 36m"],
  },
  {
    id: intents[1].id,
    title: intents[1].manifestTitle,
    creatorName: intents[1].creatorName,
    sponsorName: intents[1].sponsorName,
    manifestId: "cmna4hq390006qteqss16aj8b",
    manifestHash: buildManifestHash(intents[1].id),
    anchorPda: buildPda(`${intents[1].id}-anchor`),
    proposalPda: buildPda(`${intents[1].id}-proposal`),
    usdcVaultPda: buildPda(`${intents[1].id}-vault`),
    status: "FUNDED",
    viewerRole: "Sponsor",
    deadlineLabel: intents[1].deadlineLabel,
    needsActionFor: null,
    latestTxShort: "5e3E…oZ4m",
    track1BaseUsd: intents[1].track1BaseUsd,
    track2PoolUsd: intents[1].track2PoolUsd,
    track3PoolUsd: intents[1].track3PoolUsd,
    track1Metric: "Base payout",
    track1Target: "Manifest delivered",
    track1Actual: "Settled",
    track2Metric: intents[1].metric,
    track2Target: intents[1].targetValue,
    track2Actual: "6,820 / 9,500",
    track3Metric: "CPS",
    track3Target: "30 day window",
    track3Actual: "12d remaining",
    signatures: [
      { id: "creator", label: "Creator signature", detail: "Wallet 3kRv…w7Zp", status: "done", owner: "Creator" },
      { id: "sponsor", label: "Sponsor signature", detail: "Wallet 4Kv2…Wq9p", status: "done", owner: "Sponsor" },
      { id: "bundle", label: "Backend bundle built", detail: "Bundle id bdl_lr_004", status: "done" },
      { id: "vtx", label: "Versioned tx ready", detail: "submitted", status: "done" },
      { id: "submit", label: "On-chain submit", detail: "Tx 5e3E…oZ4m", status: "done" },
      { id: "confirm", label: "Confirmation", detail: "Slot 312812", status: "done" },
    ],
    proof: [
      { id: "manifest", label: "Manifest anchored", status: "done", detail: "Slot 312810" },
      { id: "feed", label: "Feed sync", status: "done", detail: "Public projection live" },
      { id: "mux", label: "Mux metrics", status: "done", detail: "Reconciled 12m ago" },
      { id: "oracle", label: "Oracle proof", status: "pending", detail: "Track 2 settlement queued" },
    ],
    settlement: {
      track1Settled: true,
      track2Settled: false,
      track3Settled: false,
      remainingUsdc: intents[1].track2PoolUsd + intents[1].track3PoolUsd,
      settlementTx: "5e3E…oZ4m",
    },
    oracleStatus: "Verifying",
    riskFlags: ["Track 2 below threshold (72%)"],
  },
  {
    id: intents[2].id,
    title: intents[2].manifestTitle,
    creatorName: intents[2].creatorName,
    sponsorName: intents[2].sponsorName,
    manifestId: "cmna2z7sx0002qtezlaunch1",
    manifestHash: buildManifestHash(intents[2].id),
    anchorPda: buildPda(`${intents[2].id}-anchor`),
    proposalPda: buildPda(`${intents[2].id}-proposal`),
    usdcVaultPda: buildPda(`${intents[2].id}-vault`),
    status: "BUNDLE_BUILT",
    viewerRole: "Creator",
    deadlineLabel: intents[2].deadlineLabel,
    needsActionFor: "Creator",
    latestTxShort: null,
    track1BaseUsd: intents[2].track1BaseUsd,
    track2PoolUsd: intents[2].track2PoolUsd,
    track3PoolUsd: intents[2].track3PoolUsd,
    track1Metric: "Base payout",
    track1Target: "Manifest delivered",
    track1Actual: "Awaiting submission",
    track2Metric: intents[2].metric,
    track2Target: intents[2].targetValue,
    track2Actual: "Pending",
    track3Metric: "CPS",
    track3Target: "30 day window",
    track3Actual: "Not started",
    signatures: [
      { id: "creator", label: "Creator signature", detail: "Awaiting your wallet", status: "waiting", owner: "Creator" },
      { id: "sponsor", label: "Sponsor signature", detail: "Pending creator", status: "pending", owner: "Sponsor" },
      { id: "bundle", label: "Backend bundle built", detail: "Bundle id bdl_lr_007", status: "done" },
      { id: "vtx", label: "Versioned tx ready", detail: "expires in 26h", status: "done" },
      { id: "submit", label: "On-chain submit", detail: "—", status: "pending" },
      { id: "confirm", label: "Confirmation", detail: "—", status: "pending" },
    ],
    proof: [
      { id: "manifest", label: "Manifest anchored", status: "pending", detail: "Awaiting bundle submit" },
      { id: "feed", label: "Feed sync", status: "pending", detail: "Public projection delayed" },
      { id: "mux", label: "Mux metrics", status: "pending", detail: "—" },
      { id: "oracle", label: "Oracle proof", status: "pending", detail: "—" },
    ],
    settlement: {
      track1Settled: false,
      track2Settled: false,
      track3Settled: false,
      remainingUsdc: intents[2].track1BaseUsd + intents[2].track2PoolUsd + intents[2].track3PoolUsd,
      settlementTx: null,
    },
    oracleStatus: "Pending",
    riskFlags: [],
  },
];

const matchesFilter = (campaign: DeskCampaign, filter: DeskFilter): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "needs-action":
      return Boolean(campaign.needsActionFor);
    case "awaiting-creator":
      return campaign.needsActionFor === "Creator";
    case "awaiting-sponsor":
      return campaign.needsActionFor === "Sponsor";
    case "funded":
      return campaign.status === "FUNDED" || campaign.status === "SUBMITTED" || campaign.status === "CONFIRMED";
    case "settlement":
      return campaign.settlement.track1Settled || campaign.settlement.track2Settled || campaign.oracleStatus === "Verifying";
    case "resolved":
      return campaign.settlement.track1Settled && campaign.settlement.track2Settled;
    default:
      return true;
  }
};

const statusLabel = (campaign: DeskCampaign) => {
  if (campaign.status === "FUNDED") return "Funded";
  if (campaign.status === "SETTLEMENT_READY") return "Settlement Ready";
  if (campaign.status === "RESOLVED") return "Resolved";
  return INTENT_STATUS_LABELS[campaign.status as ProposalIntentStatus];
};

const getDeskSignatureCta = (campaign: DeskCampaign) => {
  if (campaign.viewerRole === "Observer") {
    return {
      hint: "This fixture can be inspected in the desk only; no proposal API is called.",
      label: "Desk preview only",
    };
  }
  if (campaign.needsActionFor === campaign.viewerRole) {
    const label =
      campaign.viewerRole === "Creator" ? "Mock creator action only" : "Mock sponsor action only";
    return {
      hint: "This desk row is local fixture data. Open a real proposal intent from a content detail page to sign or fund.",
      label,
    };
  }
  if (campaign.status === "FUNDED") {
    return {
      hint: "Settlement status is illustrative here; operator/oracle settlement controls are not wired to this page.",
      label: "Mock settlement only",
    };
  }
  return {
    hint: "This row is a local preview of the desired operator state model.",
    label: "Desk preview only",
  };
};

const getBoardRowCta = (campaign: DeskCampaign) => {
  if (campaign.viewerRole === "Observer") return "View";
  if (campaign.needsActionFor === campaign.viewerRole) {
    return campaign.viewerRole === "Creator" ? "Inspect mock sign" : "Inspect mock fund";
  }
  if (campaign.status === "BUNDLE_BUILT") return "Inspect";
  if (campaign.status === "FUNDED") return "Inspect mock settle";
  return "Inspect";
};

const statusToneClass = (campaign: DeskCampaign) => {
  if (campaign.status === "FUNDED")
    return "border-[#65ecaf]/30 bg-[#0e1f17]/85 text-[#8df0c4]";
  if (campaign.status === "SETTLEMENT_READY")
    return "border-[#67b8ff]/25 bg-[#0e1726]/80 text-[#8ad0ff]";
  if (campaign.status === "RESOLVED")
    return "border-[#65ecaf]/35 bg-[#0e1f17]/85 text-[#8df0c4]";
  return INTENT_STATUS_TONES[campaign.status as ProposalIntentStatus];
};

/* ──────────────────────────  Main component  ────────────────────────── */

export const SponsorshipDesk = () => {
  const campaigns = useMemo(() => buildDeskCampaigns(), []);
  const [filter, setFilter] = useState<DeskFilter>("needs-action");
  const [selectedId, setSelectedId] = useState<string>(campaigns[0].id);

  const filtered = useMemo(
    () => campaigns.filter((campaign) => matchesFilter(campaign, filter)),
    [campaigns, filter],
  );
  const selected = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? campaigns[0],
    [campaigns, selectedId],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<DeskFilter, number> = {
      "all": 0,
      "needs-action": 0,
      "awaiting-creator": 0,
      "awaiting-sponsor": 0,
      "funded": 0,
      "settlement": 0,
      "resolved": 0,
    };
    for (const f of Object.keys(counts) as DeskFilter[]) {
      counts[f] = campaigns.filter((campaign) => matchesFilter(campaign, f)).length;
    }
    return counts;
  }, [campaigns]);

  return (
    <div className="space-y-4 pb-24 xl:pb-12">
      <DeskHeader />

      <DeskAlerts campaigns={campaigns} />

      <DeskFilters activeFilter={filter} counts={filterCounts} onChange={setFilter} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CampaignBoard
          campaigns={filtered}
          onSelect={setSelectedId}
          selectedId={selected.id}
        />
        <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <CampaignDetailDrawer campaign={selected} />
        </aside>
      </div>

      <MobileDeskCtaBar campaign={selected} />
    </div>
  );
};

/* ──────────────────────────  Header  ────────────────────────── */

const DeskHeader = () => (
  <section className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.95)_0%,rgba(8,12,20,0.95)_100%)] px-4 py-3.5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.22em] text-[#7486a1]">Workspace</p>
          <span className="rounded-full border border-[#f3b33e]/25 bg-[#1f1708]/60 px-2 py-0.5 font-mono text-[length:var(--fs-nano)] font-semibold text-[#f8d48a]">
            LOCAL FIXTURES
          </span>
        </div>
        <h1 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-white md:text-[20px]">Sponsorship Desk</h1>
        <p className="mt-1 max-w-[640px] text-[length:var(--fs-overline)] leading-relaxed text-[#9aabc4] md:text-[length:var(--fs-caption)]">
          Review the intended operator model for terms, signatures, funding, and settlement across mock creator campaigns.
        </p>
        <p className="mt-1 max-w-[640px] text-[length:var(--fs-micro)] leading-relaxed text-[#6f8099]">
          This page does not import live proposals, submit signatures, fund vaults, run oracle jobs, or settle campaigns.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#7e90aa]"
          disabled
          type="button"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Import blocked
        </button>
        <button
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#7e90aa]"
          disabled
          type="button"
        >
          <ClockIcon className="h-3.5 w-3.5" />
          Queue preview
        </button>
        <button
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[#de402a]/20 bg-[#de402a]/10 px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#ff9a88]"
          disabled
          type="button"
        >
          <SignatureIcon className="h-3.5 w-3.5" />
          Create via content flow
        </button>
      </div>
    </div>
    <p className="mt-3 border-t border-white/[0.04] pt-3 text-[length:var(--fs-nano)] text-[#5a6b82]">
      Mock preview · use `/workspace/content/[manifestId]` and `/workspace/intents/[intentId]` for the API/wallet-wired proposal flow.
    </p>
  </section>
);

/* ──────────────────────────  Risk alerts  ────────────────────────── */

const DeskAlerts = ({ campaigns }: { campaigns: DeskCampaign[] }) => {
  const alerts = campaigns.flatMap((campaign) =>
    campaign.riskFlags.map((flag) => ({ campaignId: campaign.id, title: campaign.title, flag })),
  );
  const sponsorMissing = campaigns.filter((c) => c.signatures.some((s) => s.id === "sponsor" && s.status === "waiting")).length;
  const oraclePending = campaigns.filter((c) => c.proof.some((p) => p.id === "oracle" && p.status === "pending")).length;

  return (
    <section className="grid gap-2 md:grid-cols-3">
      <AlertTile
        accent="#f3b33e"
        hint={`${alerts.length} bundles flagged`}
        label="Mock risk windows"
        message={alerts.length > 0 ? alerts[0].flag : "No deadline pressure"}
      />
      <AlertTile
        accent="#de402a"
        hint={sponsorMissing > 0 ? "Action required" : "Idle"}
        label="Mock sponsor signatures"
        message={sponsorMissing > 0 ? `${sponsorMissing} bundles awaiting sponsor` : "All signatures collected"}
      />
      <AlertTile
        accent="#67b8ff"
        hint={oraclePending > 0 ? "Track 2 sync" : "Synced"}
        label="Mock oracle proofs"
        message={oraclePending > 0 ? `${oraclePending} proofs queued` : "All proofs reconciled"}
      />
    </section>
  );
};

const AlertTile = ({
  accent,
  hint,
  label,
  message,
}: {
  accent: string;
  hint: string;
  label: string;
  message: string;
}) => (
  <div className="rounded-2xl border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-3">
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">{label}</p>
    </div>
    <p className="mt-1.5 text-[14px] font-semibold tracking-[-0.01em] text-white">{message}</p>
    <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7486a1]">{hint}</p>
  </div>
);

/* ──────────────────────────  Filter chips  ────────────────────────── */

const DeskFilters = ({
  activeFilter,
  counts,
  onChange,
}: {
  activeFilter: DeskFilter;
  counts: Record<DeskFilter, number>;
  onChange: (filter: DeskFilter) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
    {FILTERS.map((filter) => {
      const isActive = activeFilter === filter.id;
      return (
        <button
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[length:var(--fs-micro)] transition ${
            isActive
              ? "bg-[#de402a]/[0.18] text-[#ff8a78] ring-1 ring-[#de402a]/30"
              : "text-[#9aabc4] hover:bg-white/[0.05] hover:text-white"
          }`}
          key={filter.id}
          onClick={() => onChange(filter.id)}
          title={filter.description}
          type="button"
        >
          <span className="font-medium">{filter.label}</span>
          <span
            className={`rounded-full px-1.5 py-px text-[length:var(--fs-micro)] font-mono ${
              isActive ? "bg-[#de402a]/[0.16] text-[#ff8a78]" : "bg-white/[0.05] text-[#9aabc4]"
            }`}
          >
            {counts[filter.id]}
          </span>
        </button>
      );
    })}
  </div>
);

/* ──────────────────────────  Campaign board  ────────────────────────── */

const CampaignBoard = ({
  campaigns,
  onSelect,
  selectedId,
}: {
  campaigns: DeskCampaign[];
  onSelect: (id: string) => void;
  selectedId: string;
}) => (
  <section className="overflow-hidden rounded-[20px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
    <div className="hidden border-b border-white/[0.04] px-4 py-2 text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.16em] text-[#6f8099] lg:grid lg:grid-cols-[1.45fr_0.85fr_0.85fr_0.65fr_1.1fr_1fr_auto] lg:items-center lg:gap-2">
      <span>Campaign</span>
      <span>Sponsor</span>
      <span>Creator</span>
      <span>Role</span>
      <span>Status</span>
      <span>Latest tx</span>
      <span className="w-[112px] justify-self-end text-right">Action</span>
    </div>

    {campaigns.length === 0 ? (
      <div className="px-4 py-10 text-center text-sm text-[#7e90aa]">
        No campaigns match this filter.
      </div>
    ) : null}

    <div className="divide-y divide-white/[0.04]">
      {campaigns.map((campaign) => (
        <BoardRow
          campaign={campaign}
          isSelected={campaign.id === selectedId}
          key={campaign.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  </section>
);

const BoardRow = ({
  campaign,
  isSelected,
  onSelect,
}: {
  campaign: DeskCampaign;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const ctaLabel = getBoardRowCta(campaign);

  return (
    <button
      className={`grid w-full items-center gap-3 px-4 py-3 text-left transition lg:grid-cols-[1.45fr_0.85fr_0.85fr_0.65fr_1.1fr_1fr_auto] lg:gap-2 ${
        isSelected
          ? "bg-[#de402a]/[0.05] ring-1 ring-inset ring-[#de402a]/25"
          : "hover:bg-white/[0.02]"
      }`}
      onClick={() => onSelect(campaign.id)}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-8 w-8 shrink-0 rounded-lg bg-[#de402a]/[0.12] ring-1 ring-[#de402a]/25" />
        <div className="min-w-0">
          <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{campaign.title}</p>
          <p className="mt-0.5 truncate font-mono text-[length:var(--fs-micro)] text-[#6f8099]">
            Mock PDA {campaign.proposalPda}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <MobileLabel>Sponsor</MobileLabel>
        <p className="truncate text-[length:var(--fs-overline)] text-[#cbd6e7]">{campaign.sponsorName}</p>
      </div>

      <div className="min-w-0">
        <MobileLabel>Creator</MobileLabel>
        <p className="truncate text-[length:var(--fs-overline)] text-[#cbd6e7]">{campaign.creatorName}</p>
      </div>

      <div>
        <MobileLabel>Role</MobileLabel>
        <RolePill role={campaign.viewerRole} />
      </div>

      <div className="min-w-0">
        <MobileLabel>Status</MobileLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${statusToneClass(campaign)}`}
          >
            {statusLabel(campaign)}
          </span>
          {campaign.needsActionFor ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#de402a]/25 bg-[#1f120e]/65 px-1.5 py-0.5 text-[10.5px] font-medium text-[#ff8a78]">
              <span className="h-1 w-1 rounded-full bg-[#de402a]" />
              Needs {campaign.needsActionFor.toLowerCase()}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[length:var(--fs-micro)] text-[#6f8099]">{campaign.deadlineLabel}</p>
      </div>

      <div className="min-w-0 lg:text-left">
        <MobileLabel>Latest tx</MobileLabel>
        <p className="truncate font-mono text-[length:var(--fs-micro)] text-[#8d9cb4]">
          {campaign.latestTxShort ?? "—"}
        </p>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span
          className="flex h-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[length:var(--fs-micro)] font-semibold text-[#cbd6e7]"
        >
          {ctaLabel}
        </span>
        <ChevronRightIcon className="h-3.5 w-3.5 text-[#7e90aa]" />
      </div>
    </button>
  );
};

const RolePill = ({ role }: { role: ViewerRole }) => {
  const palette = {
    Creator: { dot: "bg-[#8ad0ff]", text: "text-[#8ad0ff]" },
    Sponsor: { dot: "bg-[#ffb38a]", text: "text-[#ffb38a]" },
    Observer: { dot: "bg-[#9aabc4]", text: "text-[#9aabc4]" },
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-[length:var(--fs-micro)] font-medium ${palette[role].text}`}>
      <span className={`h-1 w-1 rounded-full ${palette[role].dot}`} />
      {role}
    </span>
  );
};

const MobileLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-[length:var(--fs-micro)] uppercase tracking-[0.14em] text-[#6f8099] lg:hidden">{children}</span>
);

const MobileDeskCtaBar = ({ campaign }: { campaign: DeskCampaign }) => {
  const cta = getDeskSignatureCta(campaign);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[rgba(8,10,16,0.92)] px-4 py-3 backdrop-blur-md xl:hidden">
      <button
        className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] py-3 text-[length:var(--fs-caption)] font-semibold text-[#7e90aa]"
        disabled
        title={cta.hint}
        type="button"
      >
        <SignatureIcon className="h-4 w-4 shrink-0" />
        {cta.label}
      </button>
    </div>
  );
};

/* ──────────────────────────  Detail drawer  ────────────────────────── */

const CampaignDetailDrawer = ({ campaign }: { campaign: DeskCampaign }) => (
  <div className="space-y-3">
    <DrawerSummary campaign={campaign} />
    <DrawerOnChain campaign={campaign} />
    <DrawerTracks campaign={campaign} />
    <DrawerSignatures campaign={campaign} />
    <DrawerSettlement campaign={campaign} />
  </div>
);

const DrawerSummary = ({ campaign }: { campaign: DeskCampaign }) => (
  <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-3.5">
    <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Campaign</p>
    <p className="mt-1 truncate text-[length:var(--fs-sm)] font-semibold tracking-[-0.02em] text-white">
      {campaign.title}
    </p>
    <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7e90aa]">
      {campaign.creatorName} × {campaign.sponsorName}
    </p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${statusToneClass(campaign)}`}
      >
        {statusLabel(campaign)}
      </span>
      <RolePill role={campaign.viewerRole} />
      <span className="inline-flex items-center gap-1 text-[10.5px] text-[#9aabc4]">
        <ClockIcon className="h-3 w-3" />
        {campaign.deadlineLabel}
      </span>
    </div>
  </section>
);

const DrawerOnChain = ({ campaign }: { campaign: DeskCampaign }) => (
  <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-3.5">
    <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Illustrative Chain Proof</p>
    <p className="mt-1 text-[length:var(--fs-micro)] leading-4 text-[#6f8099]">
      These identifiers are deterministic local fixtures, not Solana or backend reads.
    </p>
    <div className="mt-2 space-y-1.5 text-[length:var(--fs-micro)]">
      <HashRow label="Mock manifest hash" value={campaign.manifestHash} />
      <HashRow label="Mock anchor PDA" value={campaign.anchorPda} />
      <HashRow label="Mock proposal PDA" value={campaign.proposalPda} />
      <HashRow label="Mock USDC vault PDA" value={campaign.usdcVaultPda} />
    </div>
  </section>
);

const HashRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 transition hover:bg-white/[0.03]">
    <span className="text-[#7486a1]">{label}</span>
    <span className="flex items-center gap-1 font-mono text-[#cbd6e7]">
      {value}
      <CopyIcon className="h-3 w-3 text-[#5a6b82]" />
    </span>
  </div>
);

const DrawerTracks = ({ campaign }: { campaign: DeskCampaign }) => (
  <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-3.5">
    <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Track Configuration</p>
    <div className="mt-2 space-y-2">
      <TrackRow accent="#67b8ff" label="Track 1 · Base" metric={campaign.track1Metric} target={campaign.track1Target} actual={campaign.track1Actual} amount={campaign.track1BaseUsd} />
      <TrackRow accent="#ffb38a" label="Track 2 · KPI" metric={campaign.track2Metric} target={campaign.track2Target} actual={campaign.track2Actual} amount={campaign.track2PoolUsd} />
      <TrackRow accent="#65ecaf" label="Track 3 · CPS" metric={campaign.track3Metric} target={campaign.track3Target} actual={campaign.track3Actual} amount={campaign.track3PoolUsd} />
    </div>
  </section>
);

const TrackRow = ({
  accent,
  amount,
  actual,
  label,
  metric,
  target,
}: {
  accent: string;
  amount: number;
  actual: string;
  label: string;
  metric: string;
  target: string;
}) => (
  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[length:var(--fs-micro)] font-medium text-white">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {label}
      </span>
      <span className="text-[length:var(--fs-overline)] font-semibold text-white">{formatUsd(amount)}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--fs-micro)] text-[#7486a1]">
      <span>{metric}</span>
      <span className="text-[#5a6b82]">·</span>
      <span>Target {target}</span>
      <span className="text-[#5a6b82]">·</span>
      <span className="text-[#cbd6e7]">{actual}</span>
    </div>
  </div>
);

const DrawerSignatures = ({ campaign }: { campaign: DeskCampaign }) => {
  const cta = getDeskSignatureCta(campaign);

  return (
    <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
      <header className="border-b border-white/[0.05] px-4 py-3">
        <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Signature Checklist</p>
      </header>
      <div className="space-y-1 px-2 py-2">
        {campaign.signatures.map((item) => (
          <ChecklistRow item={item} key={item.id} />
        ))}
      </div>
      <div className="hidden border-t border-white/[0.05] p-3 xl:block">
        <button
          className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 text-[length:var(--fs-overline)] font-semibold text-[#7e90aa]"
          disabled
          title={cta.hint}
          type="button"
        >
          <SignatureIcon className="h-3.5 w-3.5" />
          {cta.label}
        </button>
        <p className="mt-2 text-center text-[length:var(--fs-micro)] leading-4 text-[#6f8099]">{cta.hint}</p>
      </div>
    </section>
  );
};

const ChecklistRow = ({ item }: { item: SignatureChecklistItem }) => {
  const icon =
    item.status === "done" ? (
      <CheckCircleIcon className="h-4 w-4 text-[#8df0c4]" />
    ) : item.status === "waiting" ? (
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f3b33e] opacity-45" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#f3b33e]" />
      </span>
    ) : item.status === "failed" ? (
      <WarningIcon className="h-4 w-4 text-[#f67263]" />
    ) : item.status === "expired" ? (
      <ClockIcon className="h-4 w-4 text-[#f67263]" />
    ) : (
      <span className="h-2.5 w-2.5 rounded-full border border-white/15 bg-white/[0.03]" />
    );

  const labelClass =
    item.status === "done"
      ? "text-white"
      : item.status === "waiting"
        ? "text-[#f3c66e]"
        : item.status === "failed" || item.status === "expired"
          ? "text-[#f67263]"
          : "text-[#9aabc4]";

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
        <div className="min-w-0">
          <p className={`truncate text-[length:var(--fs-overline)] font-medium ${labelClass}`}>{item.label}</p>
          <p className="truncate text-[length:var(--fs-micro)] text-[#6f8099]">{item.detail}</p>
        </div>
      </div>
      {item.owner ? <RolePill role={item.owner} /> : null}
    </div>
  );
};

const DrawerSettlement = ({ campaign }: { campaign: DeskCampaign }) => (
  <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
    <header className="border-b border-white/[0.05] px-4 py-3">
      <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Settlement & Proof</p>
    </header>
    <div className="space-y-1 px-2 py-2">
      {campaign.proof.map((item) => (
        <ProofRow item={item} key={item.id} />
      ))}
    </div>
    <div className="grid grid-cols-3 gap-1 border-t border-white/[0.05] px-3 py-3">
      <SettlementCell label="Track 1" settled={campaign.settlement.track1Settled} />
      <SettlementCell label="Track 2" settled={campaign.settlement.track2Settled} />
      <SettlementCell label="Track 3" settled={campaign.settlement.track3Settled} />
    </div>
    <div className="space-y-1 border-t border-white/[0.05] px-4 py-3 text-[length:var(--fs-micro)]">
      <div className="flex items-center justify-between text-[#7486a1]">
        <span>Remaining USDC</span>
        <span className="font-semibold text-white">{formatUsd(campaign.settlement.remainingUsdc)}</span>
      </div>
      <div className="flex items-center justify-between text-[#7486a1]">
        <span>Settlement tx</span>
        <span className="font-mono text-[#cbd6e7]">
          {campaign.settlement.settlementTx ?? "—"}
        </span>
      </div>
    </div>
  </section>
);

const ProofRow = ({ item }: { item: ProofChecklistItem }) => {
  const tone =
    item.status === "done"
      ? { dot: "bg-[#65ecaf]", label: "text-white" }
      : item.status === "failed"
        ? { dot: "bg-[#f67263]", label: "text-[#f67263]" }
        : { dot: "bg-[#7e90aa]", label: "text-[#9aabc4]" };
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        <p className={`truncate text-[length:var(--fs-overline)] font-medium ${tone.label}`}>{item.label}</p>
      </div>
      <p className="shrink-0 text-[length:var(--fs-micro)] text-[#7486a1]">{item.detail}</p>
    </div>
  );
};

const SettlementCell = ({ label, settled }: { label: string; settled: boolean }) => (
  <div
    className={`rounded-lg border px-2.5 py-2 text-center ${
      settled
        ? "border-[#65ecaf]/22 bg-[#0e1f17]/80"
        : "border-white/[0.06] bg-white/[0.02]"
    }`}
  >
    <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.16em] text-[#6f8099]">{label}</p>
    <p
      className={`mt-1 text-[length:var(--fs-micro)] font-semibold ${
        settled ? "text-[#8df0c4]" : "text-[#9aabc4]"
      }`}
    >
      {settled ? "Settled" : "Pending"}
    </p>
  </div>
);
