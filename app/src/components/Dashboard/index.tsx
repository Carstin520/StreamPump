import { PublicKey } from "@solana/web3.js";
import { FormEvent, useMemo, useState } from "react";

import {
  CreatorUpgradeMetricType,
  useCreatorUpgradePayload,
} from "@/hooks/useCreatorUpgradePayload";
import { useProposalOracleReport } from "@/hooks/useProposalOracleReport";
import {
  deriveCreatorProfilePda,
  deriveProposalPda,
  deriveUpgradeReceiptPda,
} from "@/utils/proposalPda";

export const Dashboard = () => {
  const [creatorWallet, setCreatorWallet] = useState("");
  const [deadlineTs, setDeadlineTs] = useState("");
  const [proposalKey, setProposalKey] = useState("");
  const [videoId, setVideoId] = useState("");
  const { loading, error, report, loadReport } = useProposalOracleReport();

  const [upgradeLevel, setUpgradeLevel] = useState("2");
  const [upgradeMetricType, setUpgradeMetricType] = useState<CreatorUpgradeMetricType>(
    "followers"
  );
  const [upgradeMetricValue, setUpgradeMetricValue] = useState("10000");
  const {
    loading: upgradeLoading,
    error: upgradeError,
    payload: upgradePayload,
    loadPayload: loadUpgradePayload,
  } = useCreatorUpgradePayload();

  const derivedProposalKey = useMemo(() => {
    if (!creatorWallet || !deadlineTs) {
      return "";
    }

    try {
      const creator = new PublicKey(creatorWallet.trim());
      const proposal = deriveProposalPda(creator, BigInt(deadlineTs));
      return proposal.toBase58();
    } catch (_error) {
      return "";
    }
  }, [creatorWallet, deadlineTs]);

  const derivedCreatorProfile = useMemo(() => {
    if (!creatorWallet) {
      return "";
    }

    try {
      const creator = new PublicKey(creatorWallet.trim());
      return deriveCreatorProfilePda(creator).toBase58();
    } catch (_error) {
      return "";
    }
  }, [creatorWallet]);

  const derivedUpgradeReceipt = useMemo(() => {
    if (!derivedCreatorProfile || !upgradePayload?.reportIdHex) {
      return "";
    }

    try {
      const creatorProfile = new PublicKey(derivedCreatorProfile);
      return deriveUpgradeReceiptPda(creatorProfile, upgradePayload.reportIdHex).toBase58();
    } catch (_error) {
      return "";
    }
  }, [derivedCreatorProfile, upgradePayload?.reportIdHex]);

  const onLoadReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposalKey || !videoId) {
      return;
    }

    await loadReport(proposalKey.trim(), videoId.trim());
  };

  const onBuildUpgradePayload = async (event: FormEvent) => {
    event.preventDefault();
    if (!creatorWallet || !upgradeLevel || !upgradeMetricValue) {
      return;
    }

    await loadUpgradePayload({
      creatorWallet: creatorWallet.trim(),
      newLevel: Number(upgradeLevel),
      metricType: upgradeMetricType,
      metricValue: Number(upgradeMetricValue),
    });
  };

  return (
    <section className="space-y-6 rounded-xl bg-white/70 p-4 shadow-md backdrop-blur-sm">
      <div className="space-y-4">
        <header>
          <p className="text-xs uppercase tracking-wide text-ink/60">Proposal Oracle Coupling</p>
          <h2 className="text-lg font-semibold">Settlement Report Debug Panel</h2>
        </header>

        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setCreatorWallet(event.target.value)}
            placeholder="Creator wallet (for PDA derive)"
            value={creatorWallet}
          />
          <input
            className="rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setDeadlineTs(event.target.value)}
            placeholder="Deadline ts (i64, seconds)"
            value={deadlineTs}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            className="w-full rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setProposalKey(event.target.value)}
            placeholder="Proposal PDA"
            value={proposalKey}
          />
          <button
            className="rounded bg-ink px-3 py-2 text-xs font-medium text-surf disabled:opacity-60"
            disabled={!derivedProposalKey}
            onClick={() => setProposalKey(derivedProposalKey)}
            type="button"
          >
            Use Derived
          </button>
        </div>

        <form className="flex gap-2" onSubmit={(event) => void onLoadReport(event)}>
          <input
            className="w-full rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setVideoId(event.target.value)}
            placeholder="Video ID"
            value={videoId}
          />
          <button
            className="rounded bg-heat px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={loading || !proposalKey || !videoId}
            type="submit"
          >
            {loading ? "Loading..." : "Load Report"}
          </button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="grid gap-3 rounded-lg border border-ink/10 bg-white/80 p-3 md:grid-cols-3">
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Proposal</p>
            <p className="break-all text-sm font-medium">{report?.proposalKey ?? "-"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Actual Views</p>
            <p className="text-lg font-semibold">{report?.actualViews ?? "-"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Generated</p>
            <p className="text-sm font-medium">{report?.generatedAtIso ?? "-"}</p>
          </article>
        </div>

        <p className="break-all text-xs text-ink/70">
          reportDigestHex: {report?.reportDigestHex ?? "-"}
        </p>
      </div>

      <div className="space-y-4 border-t border-ink/10 pt-4">
        <header>
          <p className="text-xs uppercase tracking-wide text-ink/60">S2 Upgrade Coupling</p>
          <h3 className="text-base font-semibold">Creator Upgrade Payload Panel</h3>
        </header>

        <form className="grid gap-2 md:grid-cols-4" onSubmit={(event) => void onBuildUpgradePayload(event)}>
          <input
            className="rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setUpgradeLevel(event.target.value)}
            placeholder="New Level"
            value={upgradeLevel}
          />
          <select
            className="rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setUpgradeMetricType(event.target.value as CreatorUpgradeMetricType)}
            value={upgradeMetricType}
          >
            <option value="followers">followers</option>
            <option value="valid_views">valid_views</option>
          </select>
          <input
            className="rounded border border-ink/20 bg-white px-3 py-2 text-sm"
            onChange={(event) => setUpgradeMetricValue(event.target.value)}
            placeholder="Metric Value"
            value={upgradeMetricValue}
          />
          <button
            className="rounded bg-ink px-3 py-2 text-sm font-medium text-surf disabled:opacity-60"
            disabled={upgradeLoading || !creatorWallet}
            type="submit"
          >
            {upgradeLoading ? "Building..." : "Build Upgrade Payload"}
          </button>
        </form>

        {upgradeError && <p className="text-sm text-red-700">{upgradeError}</p>}

        <div className="grid gap-3 rounded-lg border border-ink/10 bg-white/80 p-3 md:grid-cols-2">
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Creator Profile PDA</p>
            <p className="break-all text-sm font-medium">{derivedCreatorProfile || "-"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Upgrade Receipt PDA</p>
            <p className="break-all text-sm font-medium">{derivedUpgradeReceipt || "-"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Report ID</p>
            <p className="break-all text-sm font-medium">{upgradePayload?.reportIdHex ?? "-"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-ink/60">Report Digest</p>
            <p className="break-all text-sm font-medium">{upgradePayload?.reportDigestHex ?? "-"}</p>
          </article>
        </div>
      </div>
    </section>
  );
};
