import { expect } from "chai";

import {
  assertCampaignProof,
  assertDedicatedRpcEndpoint,
  assertOperationInvariant,
  assertPilotHealth,
  assertPilotReady,
  assertPreMutationDiagnostic,
  assertReleaseIdentity,
  assertSingleTrack1Payout,
  parseBoundedPositiveSeconds,
  PilotTrack1SmokeAssertionError,
  type CampaignProof,
  type ExpectedTrack1Corridor,
  type SettlementEvidence,
  type Track1Diagnostic,
} from "../../scripts/lib/pilot-track1-smoke-assertions";

const expectedCorridor: ExpectedTrack1Corridor = {
  proposalPda: "GwsPP9HHhCvEQeu3HTFzsVL6DEtnnYw4ALEtA3fMBC9Q",
  creatorWallet: "9xQeWvG816bUx9EPfEZPjYH5D8q4S6TjUqCWV8oZV8fN",
  sponsorWallet: "7YttLkHDoENvT4E5rZaP7R4Uu8oVW9cbvN8y7RkQdZ5t",
  track1Amount: 1_000_000n,
};

const operation = (overrides: Partial<SettlementEvidence> = {}): SettlementEvidence => ({
  operationId: "track1-operation-01",
  status: "SUBMITTED",
  txSignature: "5".repeat(88),
  evidenceDigest: "a".repeat(64),
  attemptCount: 1,
  ...overrides,
});

const diagnostic = (): Track1Diagnostic => ({
  proposalPda: expectedCorridor.proposalPda,
  projection: {
    track1BaseUsdc: "1000000",
    track1Claimed: false,
    track2UsdcDeposited: "0",
    track3UsdcDeposited: "0",
    latestSettlementTxSignature: null,
  },
  chain: {
    reachable: true,
    exists: true,
    track1Claimed: false,
    creatorWallet: expectedCorridor.creatorWallet,
    sponsorWallet: expectedCorridor.sponsorWallet,
    mismatchFields: [],
  },
  operation: { exists: false },
  signatures: [],
  actions: {
    canExecute: true,
    autoResubmit: false,
    blockers: [],
  },
});

const campaign = (): CampaignProof => ({
  proposalPda: expectedCorridor.proposalPda,
  creatorWallet: expectedCorridor.creatorWallet,
  sponsorWallet: expectedCorridor.sponsorWallet,
  proofStatus: "SETTLED",
  budgetTracks: {
    track1BaseUsdc: "1000000",
    track1Claimed: true,
    track2UsdcDeposited: "0",
    track3UsdcDeposited: "0",
  },
  proof: {
    contentAnchorTx: "content-anchor-signature",
    fundingTxSignature: "funding-signature",
    latestSettlementTxSignature: "5".repeat(88),
  },
  integrity: {
    manifestFinalized: true,
    assetsReady: true,
    operatorApprovedPublication: true,
    contentHashMatchesManifest: true,
    contentAnchorMatchesManifest: true,
    contentAnchorTransactionPresent: true,
    track1OnlyBudget: true,
    track1SettlementConfirmed: true,
  },
});

const expectCode = (fn: () => unknown, code: string): void => {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).to.be.instanceOf(PilotTrack1SmokeAssertionError);
  expect(caught).to.have.property("code", code);
};

describe("Pilot Track1 smoke assertions", () => {
  it("accepts a realistic SUBMITTED-to-CONFIRMED replay with one exact payout", () => {
    assertPilotHealth(
      {
        ok: true,
        mode: "PUBLIC_SOCIAL_PILOT",
        automatedSettlement: false,
        accessPolicy: { configured: true, type: "open" },
      },
      "before"
    );
    assertPilotReady(
      {
        ok: true,
        status: "READY",
        services: { database: "READY", indexer: "READY", muxReconciliation: "READY" },
      },
      "before"
    );
    assertReleaseIdentity({
      expected: "a".repeat(40),
      deployed: "a".repeat(40),
      healthRelease: "a".repeat(40),
      phase: "before",
    });
    const preflight = assertPreMutationDiagnostic(diagnostic(), expectedCorridor);
    expect(preflight).to.deep.equal({
      creatorWallet: expectedCorridor.creatorWallet,
      track1Amount: 1_000_000n,
    });

    const submitted = operation();
    const confirmed = operation({ status: "CONFIRMED" });
    const replayEvidence = assertOperationInvariant(
      submitted,
      confirmed,
      ["CONFIRMED"],
      "replay"
    );
    const diagnosticEvidence = assertOperationInvariant(
      submitted,
      confirmed,
      ["CONFIRMED"],
      "diagnostic"
    );
    expect(diagnosticEvidence.operationId).to.equal(replayEvidence.operationId);
    assertCampaignProof(campaign(), replayEvidence, expectedCorridor);
    assertSingleTrack1Payout({
      before: 1_000_000n,
      afterSettlement: 2_000_000n,
      afterReplay: 2_000_000n,
      track1Amount: 1_000_000n,
    });
    assertPilotHealth(
      {
        ok: true,
        mode: "PUBLIC_SOCIAL_PILOT",
        automatedSettlement: false,
        accessPolicy: { configured: true, type: "open" },
      },
      "after"
    );
  });

  it("fails closed before mutation when the diagnostic has any blocker", () => {
    const blocked = diagnostic();
    blocked.actions.canExecute = false;
    blocked.actions.blockers = [{ code: "TRACK1_SETTLEMENT_NOT_DUE" }];
    expectCode(
      () => assertPreMutationDiagnostic(blocked, expectedCorridor),
      "TRACK1_PREFLIGHT_BLOCKED"
    );
  });

  it("independently rejects non-zero Track2 or Track3 preflight budgets", () => {
    const nonTrack1 = diagnostic();
    nonTrack1.projection.track2UsdcDeposited = "1";
    expectCode(
      () => assertPreMutationDiagnostic(nonTrack1, expectedCorridor),
      "TRACK1_ONLY_BUDGET_ASSERTION_FAILED"
    );
  });

  it("accepts a dedicated HTTPS RPC and rejects shared, inline-credential, or HTTP endpoints", () => {
    expect(() =>
      assertDedicatedRpcEndpoint("https://solana-devnet.g.alchemy.com/v2/example")
    ).not.to.throw();
    for (const endpoint of [
      "https://api.devnet.solana.com",
      "https://user:secret@rpc.example.com",
      "http://rpc.example.com",
    ]) {
      expectCode(() => assertDedicatedRpcEndpoint(endpoint), "DEDICATED_RPC_REQUIRED");
    }
  });

  it("rejects automated settlement runtime drift", () => {
    expectCode(
      () =>
        assertPilotHealth(
          {
            ok: true,
            mode: "PUBLIC_SOCIAL_PILOT",
            automatedSettlement: true,
            accessPolicy: { configured: true, type: "open" },
          },
          "after"
        ),
      "PILOT_RUNTIME_BOUNDARY_FAILED"
    );
  });

  it("rejects readiness drift and release identity mismatch", () => {
    expectCode(
      () =>
        assertPilotReady(
          {
            ok: true,
            status: "READY",
            services: { database: "READY", indexer: "READY", muxReconciliation: "BLOCKED" },
          },
          "after"
        ),
      "PILOT_RUNTIME_NOT_READY"
    );
    expectCode(
      () =>
        assertReleaseIdentity({
          expected: "a".repeat(40),
          deployed: "b".repeat(40),
          phase: "after",
        }),
      "PILOT_RELEASE_IDENTITY_FAILED"
    );
    expectCode(
      () =>
        assertReleaseIdentity({
          expected: "a".repeat(40),
          deployed: "a".repeat(40),
          phase: "after",
        }),
      "PILOT_RELEASE_IDENTITY_FAILED"
    );
    expectCode(
      () =>
        assertReleaseIdentity({
          expected: "a".repeat(40),
          deployed: "a".repeat(40),
          healthRelease: null,
          phase: "before",
        }),
      "PILOT_RELEASE_IDENTITY_FAILED"
    );
    expectCode(
      () =>
        assertReleaseIdentity({
          expected: "a".repeat(40),
          deployed: "a".repeat(40),
          healthRelease: "b".repeat(40),
          phase: "after",
        }),
      "PILOT_RELEASE_IDENTITY_FAILED"
    );
  });

  it("fails closed on malformed, non-positive, or excessive poll configuration", () => {
    expect(parseBoundedPositiveSeconds(undefined, "POLL", 120, 600)).to.equal(120);
    expect(parseBoundedPositiveSeconds("30", "POLL", 120, 600)).to.equal(30);
    for (const value of ["0", "-1", "1.5", "601", "abc"]) {
      expectCode(
        () => parseBoundedPositiveSeconds(value, "POLL", 120, 600),
        "PILOT_POLL_CONFIG_INVALID"
      );
    }
  });

  it("rejects any pre-mutation corridor identity drift or prior operation", () => {
    const variants = [
      (value: Track1Diagnostic) => { value.proposalPda = "other-proposal"; },
      (value: Track1Diagnostic) => { value.chain.creatorWallet = "other-creator"; },
      (value: Track1Diagnostic) => { value.chain.sponsorWallet = "other-sponsor"; },
      (value: Track1Diagnostic) => { value.operation = { exists: true, ...operation() }; },
    ];
    for (const mutate of variants) {
      const value = diagnostic();
      mutate(value);
      expectCode(
        () => assertPreMutationDiagnostic(value, expectedCorridor),
        value.proposalPda === "other-proposal"
          ? "TRACK1_PREFLIGHT_TRUTH_FAILED"
          : "TRACK1_CORRIDOR_IDENTITY_FAILED"
      );
    }

    const wrongAmount = diagnostic();
    wrongAmount.projection.track1BaseUsdc = "999999";
    expectCode(
      () => assertPreMutationDiagnostic(wrongAmount, expectedCorridor),
      "TRACK1_AMOUNT_INVALID"
    );
  });

  it("rejects replay changes to every durable operation identity field", () => {
    for (const changed of [
      { operationId: "other-operation" },
      { txSignature: "6".repeat(88) },
      { evidenceDigest: "b".repeat(64) },
      { attemptCount: 2 },
    ]) {
      expectCode(
        () =>
          assertOperationInvariant(
            operation(),
            operation({ status: "CONFIRMED", ...changed }),
            ["CONFIRMED"],
            "replay"
          ),
        "TRACK1_IDEMPOTENT_REPLAY_FAILED"
      );
    }
  });

  it("rejects a public proof signature that differs from the operation", () => {
    const mismatched = campaign();
    mismatched.proof.latestSettlementTxSignature = "different-settlement-signature";
    expectCode(
      () =>
        assertCampaignProof(
          mismatched,
          operation({ status: "CONFIRMED" }),
          expectedCorridor
        ),
      "TRACK1_PROOF_OPERATION_MISMATCH"
    );
  });

  it("rejects public proof corridor or amount drift", () => {
    const variants = [
      (value: CampaignProof) => { value.proposalPda = "other-proposal"; },
      (value: CampaignProof) => { value.creatorWallet = "other-creator"; },
      (value: CampaignProof) => { value.sponsorWallet = "other-sponsor"; },
      (value: CampaignProof) => { value.budgetTracks.track1BaseUsdc = "999999"; },
    ];
    for (const mutate of variants) {
      const value = campaign();
      mutate(value);
      expectCode(
        () =>
          assertCampaignProof(value, operation({ status: "CONFIRMED" }), expectedCorridor),
        "TRACK1_PROOF_CORRIDOR_MISMATCH"
      );
    }
  });

  it("rejects both duplicate replay payout and an incomplete first payout", () => {
    expectCode(
      () =>
        assertSingleTrack1Payout({
          before: 1_000_000n,
          afterSettlement: 2_000_000n,
          afterReplay: 3_000_000n,
          track1Amount: 1_000_000n,
        }),
      "TRACK1_PAYOUT_BALANCE_ASSERTION_FAILED"
    );
    expectCode(
      () =>
        assertSingleTrack1Payout({
          before: 1_000_000n,
          afterSettlement: 1_500_000n,
          afterReplay: 1_500_000n,
          track1Amount: 1_000_000n,
        }),
      "TRACK1_PAYOUT_BALANCE_ASSERTION_FAILED"
    );
  });
});
