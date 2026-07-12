/**
 * Production Pilot smoke for an already-due, real Track1-only proposal.
 * It never advances time or uses mock settlement paths.
 */
import "../backend/config/loadEnv";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
};

type SettlementResponse = {
  status: string;
  txSignature?: string | null;
};

type CampaignProof = {
  proofStatus: string;
  budgetTracks: {
    track1Claimed: boolean;
    track2UsdcDeposited: string;
    track3UsdcDeposited: string;
  };
  proof: {
    contentAnchorTx: string | null;
    fundingTxSignature: string | null;
    latestSettlementTxSignature: string | null;
  };
  integrity: Record<string, boolean>;
};

class ExpectedBlocker extends Error {
  constructor(readonly code: string, message: string, readonly details?: JsonValue) {
    super(message);
  }
}

class ApiStageError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super("API stage failed");
  }
}

const REQUIRED_INTEGRITY = [
  "manifestFinalized",
  "assetsReady",
  "operatorApprovedPublication",
  "contentHashMatchesManifest",
  "contentAnchorMatchesManifest",
  "contentAnchorTransactionPresent",
  "track1OnlyBudget",
  "track1SettlementConfirmed",
] as const;

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");
const apiBaseUrl = normalizeBaseUrl(
  process.env.STREAM_PUMP_SMOKE_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:4000/api/v1"
);

let activeStage = "environment validation";

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ExpectedBlocker(`${name}_REQUIRED`, `Set ${name} before running this smoke.`);
  }
  return value;
};

const boundedSeconds = (name: string, fallback: number, maximum: number): number => {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), maximum);
};

const request = async <T>(
  route: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    timeoutMs?: number;
  } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  let body: string | undefined;
  if (options.body) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  try {
    const response = await fetch(`${apiBaseUrl}${route}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
    const raw = await response.text();
    let envelope: ApiEnvelope<T> | undefined;
    try {
      envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : undefined;
    } catch {
      envelope = undefined;
    }
    if (!response.ok) {
      throw new ApiStageError(response.status, envelope?.error?.code ?? "API_REQUEST_FAILED");
    }
    return envelope?.data as T;
  } finally {
    clearTimeout(timeout);
  }
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const isNonEmpty = (value: string | null): boolean => Boolean(value?.trim());

const run = async () => {
  const proposalPda = requireEnv("STREAM_PUMP_SMOKE_PROPOSAL_PDA");
  const operatorKey = requireEnv("STREAM_PUMP_SMOKE_OPERATOR_KEY");
  const idempotencyKey = requireEnv("STREAM_PUMP_SMOKE_IDEMPOTENCY_KEY");
  const pollSeconds = boundedSeconds("STREAM_PUMP_SMOKE_POLL_SECONDS", 120, 600);
  const pollIntervalSeconds = boundedSeconds("STREAM_PUMP_SMOKE_POLL_INTERVAL_SECONDS", 3, 30);

  activeStage = "manual Track1 settlement confirmation";
  const settlement = await request<SettlementResponse>(
    `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
    {
      method: "POST",
      headers: {
        "x-internal-operator-key": operatorKey,
        "x-idempotency-key": idempotencyKey,
      },
      body: { confirmation: "SETTLE_TRACK1_MANUALLY" },
    }
  );

  activeStage = "public campaign proof polling";
  const pollDeadline = Date.now() + pollSeconds * 1_000;
  let campaign: CampaignProof | null = null;
  while (Date.now() <= pollDeadline) {
    campaign = await request<CampaignProof>(
      `/campaigns/${encodeURIComponent(proposalPda)}/public`
    );
    if (campaign.proofStatus === "SETTLED" && campaign.budgetTracks.track1Claimed) break;
    await sleep(pollIntervalSeconds * 1_000);
  }

  if (!campaign || campaign.proofStatus !== "SETTLED" || !campaign.budgetTracks.track1Claimed) {
    throw new ExpectedBlocker(
      "TRACK1_PROOF_NOT_SETTLED",
      "The public campaign proof did not reach settled Track1 state within the polling window.",
      { stage: activeStage }
    );
  }

  activeStage = "Track1 campaign proof assertions";
  if (
    BigInt(campaign.budgetTracks.track2UsdcDeposited) !== 0n ||
    BigInt(campaign.budgetTracks.track3UsdcDeposited) !== 0n
  ) {
    throw new ExpectedBlocker(
      "TRACK1_ONLY_BUDGET_ASSERTION_FAILED",
      "The settled campaign has a non-zero Track2 or Track3 budget."
    );
  }

  const missingSignatures = [
    ["funding", campaign.proof.fundingTxSignature],
    ["contentAnchor", campaign.proof.contentAnchorTx],
    ["settlement", campaign.proof.latestSettlementTxSignature],
  ]
    .filter(([, signature]) => !isNonEmpty(signature))
    .map(([label]) => label as string);
  if (missingSignatures.length > 0) {
    throw new ExpectedBlocker(
      "CAMPAIGN_SIGNATURE_ASSERTION_FAILED",
      "The public campaign proof is missing required transaction signatures.",
      { missing: missingSignatures }
    );
  }

  const failedIntegrity = REQUIRED_INTEGRITY.filter((key) => campaign?.integrity[key] !== true);
  if (failedIntegrity.length > 0) {
    throw new ExpectedBlocker(
      "CAMPAIGN_INTEGRITY_ASSERTION_FAILED",
      "The public campaign proof has incomplete integrity checks.",
      { failed: [...failedIntegrity] }
    );
  }

  activeStage = "Track1 idempotent replay assertion";
  const settlementReplay = await request<SettlementResponse>(
    `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
    {
      method: "POST",
      headers: {
        "x-internal-operator-key": operatorKey,
        "x-idempotency-key": idempotencyKey,
      },
      body: { confirmation: "SETTLE_TRACK1_MANUALLY" },
    }
  );
  const proofAfterReplay = await request<CampaignProof>(
    `/campaigns/${encodeURIComponent(proposalPda)}/public`
  );
  if (
    settlementReplay.status !== settlement.status ||
    proofAfterReplay.proof.latestSettlementTxSignature !==
      campaign.proof.latestSettlementTxSignature
  ) {
    throw new ExpectedBlocker(
      "TRACK1_IDEMPOTENT_REPLAY_FAILED",
      "Replaying the same Track1 operation changed its status or settlement proof signature."
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      proposalPda,
      settlementStatus: settlement.status,
      replayStatus: settlementReplay.status,
      proofStatus: campaign.proofStatus,
      track1Claimed: true,
      integrityVerified: true,
    })
  );
};

run().catch((error) => {
  if (error instanceof ExpectedBlocker) {
    console.error(
      JSON.stringify({ ok: false, code: error.code, message: error.message, details: error.details })
    );
    process.exit(2);
  }
  if (error instanceof ApiStageError) {
    console.error(
      JSON.stringify({
        ok: false,
        code: error.code,
        status: error.status,
        stage: activeStage,
        message: `API request failed during ${activeStage}.`,
      })
    );
    process.exit(1);
  }
  console.error(
    JSON.stringify({
      ok: false,
      code: "STAGE_FAILED",
      stage: activeStage,
      message: `Smoke failed during ${activeStage}.`,
    })
  );
  process.exit(1);
});
