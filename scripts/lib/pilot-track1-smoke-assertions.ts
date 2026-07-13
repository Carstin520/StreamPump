export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export class PilotTrack1SmokeAssertionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: JsonValue
  ) {
    super(message);
  }
}

export type PilotHealth = {
  ok: boolean;
  mode: string;
  automatedSettlement: boolean;
  releaseSha?: string;
  accessPolicy?: {
    configured?: boolean;
    type?: string;
  };
};

export type PilotReady = {
  ok: boolean;
  status: string;
  services?: {
    database?: string;
    indexer?: string;
    muxReconciliation?: string;
  };
};

export type SettlementEvidence = {
  operationId?: string | null;
  status: string;
  txSignature?: string | null;
  evidenceDigest?: string | null;
  attemptCount?: number | null;
};

export type RequiredSettlementEvidence = {
  operationId: string;
  status: string;
  txSignature: string;
  evidenceDigest: string;
  attemptCount: number;
};

export type Track1Diagnostic = {
  proposalPda: string;
  projection: {
    track1BaseUsdc: string;
    track1Claimed: boolean;
    track2UsdcDeposited: string;
    track3UsdcDeposited: string;
    latestSettlementTxSignature: string | null;
  };
  chain: {
    reachable: boolean;
    exists: boolean | null;
    track1Claimed: boolean | null;
    creatorWallet: string | null;
    sponsorWallet: string | null;
    mismatchFields: string[];
  };
  operation:
    | { exists: false }
    | ({ exists: true } & SettlementEvidence);
  signatures: Array<{
    signature: string;
    state: string;
    resolution: string;
  }>;
  actions: {
    canExecute: boolean;
    autoResubmit: boolean;
    blockers: Array<{ code?: string }>;
  };
};

export type CampaignProof = {
  proposalPda: string;
  creatorWallet: string;
  sponsorWallet: string;
  proofStatus: string;
  budgetTracks: {
    track1BaseUsdc: string;
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

const fail = (code: string, message: string, details?: JsonValue): never => {
  throw new PilotTrack1SmokeAssertionError(code, message, details);
};

const nonEmpty = (value: string | null | undefined): value is string =>
  Boolean(value?.trim());

const parseAmount = (value: string, label: string): bigint => {
  try {
    const amount = BigInt(value);
    if (amount < 0n) throw new Error("negative amount");
    return amount;
  } catch {
    return fail("TRACK1_AMOUNT_INVALID", `${label} must be a non-negative integer string.`);
  }
};

export const assertPilotHealth = (health: PilotHealth, phase: "before" | "after"): void => {
  if (
    health.ok !== true ||
    health.mode !== "INVITE_ONLY_PILOT" ||
    health.automatedSettlement !== false ||
    health.accessPolicy?.configured !== true ||
    health.accessPolicy.type !== "invite_only"
  ) {
    fail(
      "PILOT_RUNTIME_BOUNDARY_FAILED",
      `The ${phase}-mutation health check is not invite-only with automated settlement disabled.`,
      { phase }
    );
  }
};

export const assertPilotReady = (ready: PilotReady, phase: "before" | "after"): void => {
  if (
    ready.ok !== true ||
    ready.status !== "READY" ||
    ready.services?.database !== "READY" ||
    ready.services?.indexer !== "READY" ||
    ready.services?.muxReconciliation !== "READY"
  ) {
    fail(
      "PILOT_RUNTIME_NOT_READY",
      `The ${phase}-mutation readiness check did not report every required service READY.`,
      { phase }
    );
  }
};

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

export const assertReleaseIdentity = (params: {
  expected: string;
  deployed: string;
  healthRelease?: string;
  phase: "before" | "after";
}): void => {
  const expected = params.expected.trim().toLowerCase();
  const deployed = params.deployed.trim().toLowerCase();
  const healthRelease = params.healthRelease?.trim().toLowerCase();
  if (
    !FULL_GIT_SHA.test(expected) ||
    !FULL_GIT_SHA.test(deployed) ||
    expected !== deployed ||
    (healthRelease !== undefined &&
      (!FULL_GIT_SHA.test(healthRelease) || healthRelease !== expected))
  ) {
    fail(
      "PILOT_RELEASE_IDENTITY_FAILED",
      `The ${params.phase}-mutation release identity does not match the fixed deployed candidate.`,
      { phase: params.phase }
    );
  }
};

export const parseBoundedPositiveSeconds = (
  raw: string | undefined,
  name: string,
  fallback: number,
  maximum: number
): number => {
  const value = raw?.trim();
  if (value === undefined || value === "") return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) {
    return fail("PILOT_POLL_CONFIG_INVALID", `${name} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    return fail("PILOT_POLL_CONFIG_INVALID", `${name} exceeds the safe maximum ${maximum}.`);
  }
  return parsed;
};

export const assertDedicatedRpcEndpoint = (value: string): void => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("DEDICATED_RPC_REQUIRED", "SOLANA_TX_RPC_ENDPOINT must be a valid URL.");
  }
  const sharedHosts = new Set(["api.devnet.solana.com", "api.mainnet-beta.solana.com"]);
  if (
    url.protocol !== "https:" ||
    Boolean(url.username || url.password) ||
    sharedHosts.has(url.hostname.toLowerCase())
  ) {
    fail(
      "DEDICATED_RPC_REQUIRED",
      "The transaction RPC must be a credential-free dedicated HTTPS devnet endpoint, not a shared public endpoint."
    );
  }
};

export type ExpectedTrack1Corridor = {
  proposalPda: string;
  creatorWallet: string;
  sponsorWallet: string;
  track1Amount: bigint;
};

export const assertPreMutationDiagnostic = (
  diagnostic: Track1Diagnostic,
  expected: ExpectedTrack1Corridor
): {
  creatorWallet: string;
  track1Amount: bigint;
} => {
  const blockers = Array.isArray(diagnostic.actions?.blockers)
    ? diagnostic.actions.blockers
    : [];
  if (
    diagnostic.actions?.canExecute !== true ||
    diagnostic.actions?.autoResubmit !== false ||
    blockers.length !== 0
  ) {
    fail(
      "TRACK1_PREFLIGHT_BLOCKED",
      "The read-only Track1 diagnostic did not explicitly authorize manual execution.",
      { blockerCodes: blockers.map((item) => item.code ?? "UNKNOWN") }
    );
  }
  if (
    diagnostic.proposalPda !== expected.proposalPda ||
    diagnostic.chain?.reachable !== true ||
    diagnostic.chain?.exists !== true ||
    diagnostic.chain.track1Claimed !== false ||
    diagnostic.projection?.track1Claimed !== false ||
    diagnostic.chain.mismatchFields?.length !== 0
  ) {
    fail(
      "TRACK1_PREFLIGHT_TRUTH_FAILED",
      "The read-only Track1 diagnostic does not show an unsettled, reachable, matching chain proposal."
    );
  }
  if (
    diagnostic.operation.exists !== false ||
    diagnostic.chain.creatorWallet !== expected.creatorWallet ||
    diagnostic.chain.sponsorWallet !== expected.sponsorWallet ||
    expected.creatorWallet === expected.sponsorWallet
  ) {
    fail(
      "TRACK1_CORRIDOR_IDENTITY_FAILED",
      "The fresh Track1 diagnostic does not match the exact disposable creator, sponsor, and proposal."
    );
  }
  if (
    parseAmount(diagnostic.projection.track2UsdcDeposited, "Track2 budget") !== 0n ||
    parseAmount(diagnostic.projection.track3UsdcDeposited, "Track3 budget") !== 0n
  ) {
    fail(
      "TRACK1_ONLY_BUDGET_ASSERTION_FAILED",
      "The read-only Track1 diagnostic has a non-zero Track2 or Track3 budget."
    );
  }
  const track1Amount = parseAmount(diagnostic.projection.track1BaseUsdc, "Track1 budget");
  if (track1Amount !== expected.track1Amount) {
    fail(
      "TRACK1_AMOUNT_INVALID",
      "Track1 budget does not equal the exact approved M6 raw test-USDC amount."
    );
  }
  const creatorWallet = diagnostic.chain.creatorWallet;
  if (typeof creatorWallet !== "string" || creatorWallet.trim() === "") {
    fail("TRACK1_CREATOR_MISSING", "The diagnostic is missing the chain creator wallet.");
  }
  return { creatorWallet: creatorWallet as string, track1Amount };
};

export const requireSettlementEvidence = (
  value: SettlementEvidence,
  allowedStatuses: readonly string[],
  phase: string
): RequiredSettlementEvidence => {
  const operationId = value.operationId;
  const txSignature = value.txSignature;
  const evidenceDigest = value.evidenceDigest;
  const attemptCount = value.attemptCount;
  if (!allowedStatuses.includes(value.status)) {
    fail("TRACK1_OPERATION_STATUS_FAILED", `Unexpected Track1 operation status during ${phase}.`, {
      phase,
      status: value.status,
    });
  }
  if (
    !nonEmpty(operationId) ||
    !nonEmpty(txSignature) ||
    !/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(txSignature) ||
    !nonEmpty(evidenceDigest) ||
    !/^[0-9a-f]{64}$/.test(evidenceDigest) ||
    typeof attemptCount !== "number" ||
    !Number.isSafeInteger(attemptCount) ||
    attemptCount < 1
  ) {
    fail(
      "TRACK1_OPERATION_EVIDENCE_MISSING",
      `The Track1 operation is missing durable replay evidence during ${phase}.`,
      { phase }
    );
  }
  return {
    operationId: operationId as string,
    status: value.status,
    txSignature: txSignature as string,
    evidenceDigest: evidenceDigest as string,
    attemptCount: attemptCount as number,
  };
};

export const assertOperationInvariant = (
  before: SettlementEvidence,
  after: SettlementEvidence,
  afterAllowedStatuses: readonly string[],
  phase: string
): ReturnType<typeof requireSettlementEvidence> => {
  const expected = requireSettlementEvidence(before, ["SUBMITTED", "CONFIRMED"], "submission");
  const observed = requireSettlementEvidence(after, afterAllowedStatuses, phase);
  const changed = (["operationId", "txSignature", "evidenceDigest", "attemptCount"] as const)
    .filter((key) => observed[key] !== expected[key]);
  if (changed.length > 0) {
    fail(
      "TRACK1_IDEMPOTENT_REPLAY_FAILED",
      `Track1 replay changed durable operation evidence during ${phase}.`,
      { phase, changed: [...changed] }
    );
  }
  return observed;
};

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

export const assertCampaignProof = (
  campaign: CampaignProof,
  operation: SettlementEvidence,
  expected: ExpectedTrack1Corridor
): void => {
  const evidence = requireSettlementEvidence(operation, ["CONFIRMED"], "campaign proof");
  if (campaign.proofStatus !== "SETTLED" || campaign.budgetTracks.track1Claimed !== true) {
    fail("TRACK1_PROOF_NOT_SETTLED", "The public proof is not settled for Track1.");
  }
  if (
    campaign.proposalPda !== expected.proposalPda ||
    campaign.creatorWallet !== expected.creatorWallet ||
    campaign.sponsorWallet !== expected.sponsorWallet ||
    parseAmount(campaign.budgetTracks.track1BaseUsdc, "Track1 budget") !==
      expected.track1Amount
  ) {
    fail(
      "TRACK1_PROOF_CORRIDOR_MISMATCH",
      "The public proof does not match the exact M6 proposal, creator, sponsor, and Track1 amount."
    );
  }
  if (
    parseAmount(campaign.budgetTracks.track2UsdcDeposited, "Track2 budget") !== 0n ||
    parseAmount(campaign.budgetTracks.track3UsdcDeposited, "Track3 budget") !== 0n
  ) {
    fail("TRACK1_ONLY_BUDGET_ASSERTION_FAILED", "The public proof has a non-zero Track2 or Track3 budget.");
  }
  const missing = [
    ["funding", campaign.proof.fundingTxSignature],
    ["contentAnchor", campaign.proof.contentAnchorTx],
    ["settlement", campaign.proof.latestSettlementTxSignature],
  ].filter(([, signature]) => !nonEmpty(signature)).map(([label]) => label);
  if (missing.length > 0) {
    fail("CAMPAIGN_SIGNATURE_ASSERTION_FAILED", "The public proof is missing transaction signatures.", {
      missing,
    });
  }
  if (campaign.proof.latestSettlementTxSignature !== evidence.txSignature) {
    fail(
      "TRACK1_PROOF_OPERATION_MISMATCH",
      "The public settlement signature does not match the manual operation signature."
    );
  }
  const failedIntegrity = REQUIRED_INTEGRITY.filter((key) => campaign.integrity[key] !== true);
  if (failedIntegrity.length > 0) {
    fail("CAMPAIGN_INTEGRITY_ASSERTION_FAILED", "The public proof has incomplete integrity checks.", {
      failed: [...failedIntegrity],
    });
  }
};

export const assertSingleTrack1Payout = (params: {
  before: bigint;
  afterSettlement: bigint;
  afterReplay: bigint;
  track1Amount: bigint;
}): void => {
  if (
    params.afterSettlement - params.before !== params.track1Amount ||
    params.afterReplay !== params.afterSettlement ||
    params.afterReplay - params.before !== params.track1Amount
  ) {
    fail(
      "TRACK1_PAYOUT_BALANCE_ASSERTION_FAILED",
      "The creator test-USDC balance did not increase exactly once by the Track1 amount.",
      {
        before: params.before.toString(),
        afterSettlement: params.afterSettlement.toString(),
        afterReplay: params.afterReplay.toString(),
        expectedIncrease: params.track1Amount.toString(),
      }
    );
  }
};
