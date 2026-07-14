/**
 * Production Pilot smoke for an already-due, real Track1-only proposal.
 * It never advances time or uses mock/automatic settlement paths.
 */
import "../backend/config/loadEnv";

import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  assertCampaignProof,
  assertDedicatedRpcEndpoint,
  assertOperationInvariant,
  assertPilotHealth,
  assertPilotReady,
  assertPreMutationDiagnostic,
  assertReleaseIdentity,
  assertSingleTrack1Payout,
  type CampaignProof,
  type ExpectedTrack1Corridor,
  type JsonValue,
  type PilotHealth,
  type PilotReady,
  PilotTrack1SmokeAssertionError,
  parseBoundedPositiveSeconds,
  requireSettlementEvidence,
  type SettlementEvidence,
  type Track1Diagnostic,
} from "./lib/pilot-track1-smoke-assertions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string };
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

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");
const SOLANA_DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PILOT_TEST_USDC_MINT = "5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ";
const APPROVED_TRACK1_RAW = 1_000_000n;
const apiBaseUrl = normalizeBaseUrl(
  process.env.STREAM_PUMP_SMOKE_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:4000/api/v1"
);
const healthUrl = new URL("/health", new URL(apiBaseUrl).origin).toString();
const readyUrl = new URL("/ready", new URL(apiBaseUrl).origin).toString();

let activeStage = "environment validation";
let postMutationBoundaryFailure: { code: string; message: string } | undefined;
let primaryFailureStage: string | undefined;

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ExpectedBlocker(`${name}_REQUIRED`, `Set ${name} before running this smoke.`);
  }
  return value;
};

const fetchJson = async <T>(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    timeoutMs?: number;
    envelope?: boolean;
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
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch {
      parsed = undefined;
    }
    const envelope = parsed as ApiEnvelope<T> | undefined;
    if (!response.ok) {
      throw new ApiStageError(response.status, envelope?.error?.code ?? "API_REQUEST_FAILED");
    }
    return (options.envelope === false ? parsed : envelope?.data) as T;
  } finally {
    clearTimeout(timeout);
  }
};

const apiRequest = <T>(
  route: string,
  options: Parameters<typeof fetchJson>[1] = {}
): Promise<T> => fetchJson<T>(`${apiBaseUrl}${route}`, options);

const readHealth = (): Promise<PilotHealth> =>
  fetchJson<PilotHealth>(healthUrl, { envelope: false });

const readReady = (): Promise<PilotReady> =>
  fetchJson<PilotReady>(readyUrl, { envelope: false });

const assertRuntimeBoundary = async (
  phase: "before" | "after",
  expectedReleaseSha: string,
  deployedReleaseSha: string
): Promise<void> => {
  const [health, ready] = await Promise.all([readHealth(), readReady()]);
  assertPilotHealth(health, phase);
  assertPilotReady(ready, phase);
  assertReleaseIdentity({
    expected: expectedReleaseSha,
    deployed: deployedReleaseSha,
    healthRelease: health.releaseSha,
    phase,
  });
};

const publicKeyEnv = (name: string): string => {
  const raw = requireEnv(name);
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    throw new ExpectedBlocker(`${name}_INVALID`, `${name} must be a valid Solana public key.`);
  }
};

const sanitizedFailure = (error: unknown): { code: string; message: string } => ({
  code:
    error instanceof PilotTrack1SmokeAssertionError ||
    error instanceof ExpectedBlocker ||
    error instanceof ApiStageError
      ? error.code
      : "POST_MUTATION_BOUNDARY_FAILED",
  message: error instanceof Error ? error.message : "post-mutation boundary verification failed",
});

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const readCreatorUsdcBalance = async (
  connection: Connection,
  creatorAta: PublicKey,
  creator: PublicKey,
  mint: PublicKey
): Promise<bigint> => {
  const account = await getAccount(connection, creatorAta, "confirmed", TOKEN_PROGRAM_ID);
  if (!account.owner.equals(creator) || !account.mint.equals(mint)) {
    throw new ExpectedBlocker(
      "CREATOR_TEST_USDC_ATA_MISMATCH",
      "The derived creator ATA does not match the expected creator and Pilot test-USDC mint."
    );
  }
  return account.amount;
};

const pollCreatorBalance = async (params: {
  connection: Connection;
  creatorAta: PublicKey;
  creator: PublicKey;
  mint: PublicKey;
  expected: bigint;
  deadline: number;
  intervalMs: number;
}): Promise<bigint> => {
  let observed = await readCreatorUsdcBalance(
    params.connection,
    params.creatorAta,
    params.creator,
    params.mint
  );
  while (observed !== params.expected && Date.now() <= params.deadline) {
    if (observed > params.expected) break;
    await sleep(params.intervalMs);
    observed = await readCreatorUsdcBalance(
      params.connection,
      params.creatorAta,
      params.creator,
      params.mint
    );
  }
  return observed;
};

const run = async () => {
  const proposalPda = publicKeyEnv("STREAM_PUMP_SMOKE_PROPOSAL_PDA");
  const expectedCreatorWallet = publicKeyEnv("STREAM_PUMP_SMOKE_EXPECTED_CREATOR_WALLET");
  const expectedSponsorWallet = publicKeyEnv("STREAM_PUMP_SMOKE_EXPECTED_SPONSOR_WALLET");
  const operatorKey = requireEnv("STREAM_PUMP_SMOKE_OPERATOR_KEY");
  const idempotencyKey = requireEnv("STREAM_PUMP_SMOKE_IDEMPOTENCY_KEY");
  const expectedReleaseSha = requireEnv("STREAM_PUMP_SMOKE_EXPECTED_RELEASE_SHA");
  const deployedReleaseSha = requireEnv("STREAM_PUMP_SMOKE_DEPLOYED_RELEASE_SHA");
  const rpcEndpoint =
    process.env.PILOT_TX_RPC_URL?.trim() ||
    process.env.SOLANA_TX_RPC_ENDPOINT?.trim() ||
    (() => {
      throw new ExpectedBlocker(
        "PILOT_TX_RPC_URL_REQUIRED",
        "Set PILOT_TX_RPC_URL (or SOLANA_TX_RPC_ENDPOINT) to the dedicated devnet RPC."
      );
    })();
  const expectedUsdcMintValue = requireEnv("PILOT_EXPECTED_USDC_MINT");
  if (expectedUsdcMintValue !== PILOT_TEST_USDC_MINT) {
    throw new ExpectedBlocker(
      "PILOT_TEST_USDC_MINT_FAILED",
      "PILOT_EXPECTED_USDC_MINT does not match the frozen P4 Pilot test-USDC mint."
    );
  }
  assertDedicatedRpcEndpoint(rpcEndpoint);

  const pollSeconds = parseBoundedPositiveSeconds(
    process.env.STREAM_PUMP_SMOKE_POLL_SECONDS,
    "STREAM_PUMP_SMOKE_POLL_SECONDS",
    120,
    600
  );
  const pollIntervalSeconds = parseBoundedPositiveSeconds(
    process.env.STREAM_PUMP_SMOKE_POLL_INTERVAL_SECONDS,
    "STREAM_PUMP_SMOKE_POLL_INTERVAL_SECONDS",
    3,
    30
  );
  if (pollIntervalSeconds > pollSeconds) {
    throw new ExpectedBlocker(
      "PILOT_POLL_CONFIG_INVALID",
      "STREAM_PUMP_SMOKE_POLL_INTERVAL_SECONDS must not exceed the polling window."
    );
  }
  const pollIntervalMs = pollIntervalSeconds * 1_000;
  const operatorHeaders = {
    "x-internal-operator-key": operatorKey,
    "x-idempotency-key": idempotencyKey,
  };

  const expectedCorridor: ExpectedTrack1Corridor = {
    proposalPda,
    creatorWallet: expectedCreatorWallet,
    sponsorWallet: expectedSponsorWallet,
    track1Amount: APPROVED_TRACK1_RAW,
  };

  activeStage = "pre-mutation Pilot health, readiness, and release assertion";
  await assertRuntimeBoundary("before", expectedReleaseSha, deployedReleaseSha);

  activeStage = "read-only Track1 diagnostic";
  const diagnosticBefore = await apiRequest<Track1Diagnostic>(
    `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
    { headers: { "x-internal-operator-key": operatorKey } }
  );
  const { creatorWallet, track1Amount } = assertPreMutationDiagnostic(
    diagnosticBefore,
    expectedCorridor
  );

  activeStage = "creator test-USDC balance preflight";
  const connection = new Connection(rpcEndpoint, "confirmed");
  if ((await connection.getGenesisHash()) !== SOLANA_DEVNET_GENESIS_HASH) {
    throw new ExpectedBlocker(
      "SOLANA_DEVNET_REQUIRED",
      "The dedicated transaction RPC is not Solana devnet."
    );
  }
  const creator = new PublicKey(creatorWallet);
  const expectedUsdcMint = new PublicKey(expectedUsdcMintValue);
  const mintAccount = await connection.getAccountInfo(expectedUsdcMint, "confirmed");
  if (!mintAccount || !mintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new ExpectedBlocker(
      "PILOT_TEST_USDC_MINT_FAILED",
      "The configured Pilot test-USDC mint is missing or is not owned by the classic SPL Token program."
    );
  }
  const creatorUsdcAta = getAssociatedTokenAddressSync(
    expectedUsdcMint,
    creator,
    false,
    TOKEN_PROGRAM_ID
  );
  const balanceBefore = await readCreatorUsdcBalance(
    connection,
    creatorUsdcAta,
    creator,
    expectedUsdcMint
  );

  let settlement!: SettlementEvidence;
  let settlementReplay!: SettlementEvidence;
  let finalOperation!: ReturnType<typeof requireSettlementEvidence>;
  let campaign!: CampaignProof;
  let balanceAfterSettlement!: bigint;
  let balanceAfterReplay!: bigint;
  let mutationStarted = false;

  try {
    mutationStarted = true;
    activeStage = "manual Track1 settlement confirmation";
    settlement = await apiRequest<SettlementEvidence>(
      `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
      {
        method: "POST",
        headers: operatorHeaders,
        body: { confirmation: "SETTLE_TRACK1_MANUALLY" },
      }
    );
    requireSettlementEvidence(settlement, ["SUBMITTED", "CONFIRMED"], "submission");
    const payoutDeadline = Date.now() + pollSeconds * 1_000;

    activeStage = "creator test-USDC payout assertion";
    balanceAfterSettlement = await pollCreatorBalance({
      connection,
      creatorAta: creatorUsdcAta,
      creator,
      mint: expectedUsdcMint,
      expected: balanceBefore + track1Amount,
      deadline: payoutDeadline,
      intervalMs: pollIntervalMs,
    });
    if (balanceAfterSettlement !== balanceBefore + track1Amount) {
      assertSingleTrack1Payout({
        before: balanceBefore,
        afterSettlement: balanceAfterSettlement,
        afterReplay: balanceAfterSettlement,
        track1Amount,
      });
    }

    activeStage = "submitted Track1 observation before replay";
    const replayReadyDeadline = Date.now() + pollSeconds * 1_000;
    let replayReady = false;
    do {
      const observation = await apiRequest<Track1Diagnostic>(
        `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
        { headers: { "x-internal-operator-key": operatorKey } }
      );
      if (!observation.operation.exists) {
        throw new ExpectedBlocker(
          "TRACK1_OPERATION_EVIDENCE_MISSING",
          "The submitted operation disappeared before the idempotent replay."
        );
      }
      const observedOperation = assertOperationInvariant(
        settlement,
        observation.operation,
        ["SUBMITTED", "CONFIRMED"],
        "pre-replay observation"
      );
      const signatureObservation = observation.signatures.find(
        (item) => item.signature === observedOperation.txSignature
      );
      replayReady =
        observation.chain.track1Claimed === true &&
        signatureObservation?.state === "SUCCESS" &&
        signatureObservation.resolution === "CONFIRMED";
      if (replayReady) break;
      await sleep(pollIntervalMs);
    } while (Date.now() <= replayReadyDeadline);
    if (!replayReady) {
      throw new ExpectedBlocker(
        "TRACK1_REPLAY_NOT_READY",
        "The backend RPC did not confirm the submitted signature and chain settlement before the replay window closed."
      );
    }

    activeStage = "Track1 idempotent replay assertion";
    settlementReplay = await apiRequest<SettlementEvidence>(
      `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
      {
        method: "POST",
        headers: operatorHeaders,
        body: { confirmation: "SETTLE_TRACK1_MANUALLY" },
      }
    );
    finalOperation = assertOperationInvariant(
      settlement,
      settlementReplay,
      ["CONFIRMED"],
      "replay"
    );

    activeStage = "post-replay creator test-USDC balance assertion";
    balanceAfterReplay = await readCreatorUsdcBalance(
      connection,
      creatorUsdcAta,
      creator,
      expectedUsdcMint
    );
    assertSingleTrack1Payout({
      before: balanceBefore,
      afterSettlement: balanceAfterSettlement,
      afterReplay: balanceAfterReplay,
      track1Amount,
    });

    activeStage = "post-replay Track1 diagnostic";
    const diagnosticAfter = await apiRequest<Track1Diagnostic>(
      `/internal/settlements/${encodeURIComponent(proposalPda)}/track1`,
      { headers: { "x-internal-operator-key": operatorKey } }
    );
    if (!diagnosticAfter.operation.exists) {
      throw new ExpectedBlocker(
        "TRACK1_OPERATION_EVIDENCE_MISSING",
        "The post-replay diagnostic is missing the settlement operation."
      );
    }
    const diagnosticOperation = assertOperationInvariant(
      settlement,
      diagnosticAfter.operation,
      ["CONFIRMED"],
      "diagnostic"
    );
    if (
      diagnosticAfter.chain.track1Claimed !== true ||
      diagnosticAfter.projection.track1Claimed !== true ||
      diagnosticAfter.projection.latestSettlementTxSignature !== diagnosticOperation.txSignature
    ) {
      throw new ExpectedBlocker(
        "TRACK1_POST_DIAGNOSTIC_FAILED",
        "The post-replay diagnostic does not bind confirmed chain and projection truth to the operation signature."
      );
    }

    activeStage = "public campaign proof polling";
    const proofDeadline = Date.now() + pollSeconds * 1_000;
    do {
      campaign = await apiRequest<CampaignProof>(
        `/campaigns/${encodeURIComponent(proposalPda)}/public`
      );
      if (campaign.proofStatus === "SETTLED" && campaign.budgetTracks.track1Claimed) break;
      await sleep(pollIntervalMs);
    } while (Date.now() <= proofDeadline);
    if (campaign.proofStatus !== "SETTLED" || !campaign.budgetTracks.track1Claimed) {
      throw new ExpectedBlocker(
        "TRACK1_PROOF_NOT_SETTLED",
        "The public campaign proof did not reach settled Track1 state within the polling window."
      );
    }

    activeStage = "public campaign proof assertions";
    assertCampaignProof(campaign, finalOperation, expectedCorridor);
  } catch (error) {
    primaryFailureStage = activeStage;
    let primaryError = error;
    if (mutationStarted) {
      activeStage = "post-mutation Pilot health, readiness, and release assertion";
      try {
        await assertRuntimeBoundary("after", expectedReleaseSha, deployedReleaseSha);
      } catch (boundaryError) {
        postMutationBoundaryFailure = sanitizedFailure(boundaryError);
      }
    }
    throw primaryError;
  }

  if (mutationStarted) {
    activeStage = "post-mutation Pilot health, readiness, and release assertion";
    await assertRuntimeBoundary("after", expectedReleaseSha, deployedReleaseSha);
  }

  console.log(
    JSON.stringify({
      ok: true,
      proposalPda,
      operationId: finalOperation.operationId,
      settlementStatus: settlement.status,
      replayStatus: settlementReplay.status,
      txSignature: finalOperation.txSignature,
      evidenceDigest: finalOperation.evidenceDigest,
      attemptCount: finalOperation.attemptCount,
      proofStatus: campaign.proofStatus,
      creatorWallet,
      sponsorWallet: expectedSponsorWallet,
      creatorTestUsdcAta: creatorUsdcAta.toBase58(),
      testUsdcMint: expectedUsdcMint.toBase58(),
      expectedReleaseSha: expectedReleaseSha.toLowerCase(),
      deployedReleaseSha: deployedReleaseSha.toLowerCase(),
      track1AmountBaseUnits: track1Amount.toString(),
      creatorBalanceBefore: balanceBefore.toString(),
      creatorBalanceAfterSettlement: balanceAfterSettlement.toString(),
      creatorBalanceAfterReplay: balanceAfterReplay.toString(),
      payoutAppliedExactlyOnce: true,
      integrityVerified: true,
      runtimeBoundaryVerifiedBeforeAndAfter: true,
      releaseIdentityVerifiedBeforeAndAfter: true,
    })
  );
};

run().catch((error) => {
  if (error instanceof PilotTrack1SmokeAssertionError || error instanceof ExpectedBlocker) {
    console.error(
      JSON.stringify({
        ok: false,
        code: error.code,
        stage: primaryFailureStage ?? activeStage,
        message: error.message,
        details: error.details,
        ...(postMutationBoundaryFailure ? { postMutationBoundaryFailure } : {}),
      })
    );
    process.exit(2);
  }
  if (error instanceof ApiStageError) {
    console.error(
      JSON.stringify({
        ok: false,
        code: error.code,
        status: error.status,
        stage: primaryFailureStage ?? activeStage,
        message: `API request failed during ${primaryFailureStage ?? activeStage}.`,
        ...(postMutationBoundaryFailure ? { postMutationBoundaryFailure } : {}),
      })
    );
    process.exit(1);
  }
  console.error(
    JSON.stringify({
      ok: false,
      code: "STAGE_FAILED",
      stage: primaryFailureStage ?? activeStage,
      message: `Smoke failed during ${primaryFailureStage ?? activeStage}.`,
      ...(postMutationBoundaryFailure ? { postMutationBoundaryFailure } : {}),
    })
  );
  process.exit(1);
});
