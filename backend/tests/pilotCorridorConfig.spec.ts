import { expect } from "chai";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import * as anchor from "@coral-xyz/anchor";

import {
  PilotCorridorConfigError,
  M6_PILOT_TEST_USDC_MINT,
  assertDedicatedDevnetRpcUrl,
  buildPilotTestSponsorProfile,
  buildPilotTestSponsorReviewMarker,
  formatRawUsdc,
  loadExclusiveKeypairInput,
  loadM6ActorPrepEvidence,
  parseTrack1BaseRaw,
} from "../../scripts/pilot-corridor-config";

describe("Pilot corridor configuration", () => {
  const keypairBytes = Array.from({ length: 64 }, (_, index) => index);
  const freshTransactionSteps = [
    "fund_disposable_creator_sol",
    "fund_disposable_sponsor_sol",
    "create_fee_payer_test_usdc_ata",
    "create_creator_test_usdc_ata",
    "create_sponsor_test_usdc_ata",
    "mint_approved_test_usdc_to_fee_payer_ata",
    "transfer_approved_test_usdc_to_sponsor",
    "oracle_authorized_register_disposable_creator",
    "create_pilot_test_only_s2_upgrade_receipt",
  ];
  const resumedTransactionSteps = [
    ...freshTransactionSteps.slice(0, 7),
    "resume_fund_disposable_creator_rent_floor",
    ...freshTransactionSteps.slice(7),
  ];
  const transactionFor = (step: string, index: number) => ({
    step,
    signature: anchor.utils.bytes.bs58.encode(Buffer.alloc(64, index + 1)),
    simulation: "passed",
    state: "finalized",
    confirmationStatus: "finalized",
  });
  const actorPrepEvidence = (resumed = false) => {
    const steps = resumed ? resumedTransactionSteps : freshTransactionSteps;
    return {
      schemaVersion: 1,
      phase: "actor_chain_preparation_complete",
      completedAt: "2026-07-13T00:00:00.000Z",
      constants: {
        programId: "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp",
        testUsdcMint: M6_PILOT_TEST_USDC_MINT,
        feePayer: "Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9",
        adminMintAuthority: "BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw",
        oracleAuthority: "HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC",
      },
      actors: {
        feePayer: "Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9",
        adminMintAuthority: "BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw",
        oracleAuthority: "HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC",
        creator: "creator-wallet",
        sponsor: "sponsor-wallet",
      },
      approvedAmounts: {
        actorStartingCeilingTestUsdcRaw: "0",
        creatorTargetLamports: resumed ? "3000000" : "3612240",
        mintToFeePayerTestUsdcRaw: "1000000",
        transferToSponsorTestUsdcRaw: "1000000",
        ...(resumed ? { creatorRecoveryTopUpLamports: "612240" } : {}),
      },
      pilotTestUpgradeReport: { report: { runId: "m6-run" } },
      transactions: steps.map(transactionFor),
      postflight: {
        allTransactionsFinalized: true,
        transactionCount: steps.length,
        testUsdcSupplyBeforeRaw: "32529200000",
        testUsdcSupplyAfterRaw: "32530200000",
        feePayerTestUsdcRaw: "0",
        creatorTestUsdcRaw: "0",
        sponsorTestUsdcRaw: "1000000",
        creatorLevel: 2,
        creatorStatus: "S2_ACTIVE",
        receiptDigestVerified: true,
        receiptReportIdVerified: true,
        creatorProfileAccountSpace: 263,
        upgradeReceiptAccountSpace: 164,
        ...(resumed ? { recoveryTopUpLamports: "612240" } : {}),
        forbiddenLaneInstructionsSent: 0,
      },
      ...(resumed
        ? {
            recovery: {
              causeCode: "CREATOR_PROFILE_AND_SYSTEM_RENT_FLOOR_OMITTED",
              originalTransactionCount: 7,
              priorTransactionsFinalizedAndBound: true,
              creatorProfileAccountSpace: 263,
              creatorProfileRentLamports: "2721360",
              creatorSystemWalletRentLamports: "890880",
              requiredCreatorFundingFloorLamports: "3612240",
              creatorBalanceBeforeRecoveryLamports: "3000000",
              supplementalCreatorTopUpLamports: "612240",
              noBlindResend: true,
            },
          }
        : {}),
    };
  };

  it("loads a mode-0600 keypair path without requiring secret JSON in the environment", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "pilot-keypair-"));
    const keypairPath = path.join(tempDir, "creator.json");
    try {
      writeFileSync(keypairPath, JSON.stringify(keypairBytes), { mode: 0o600 });
      chmodSync(keypairPath, 0o600);
      expect(loadExclusiveKeypairInput(
        { STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH: keypairPath },
        "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH",
        "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON"
      )).to.deep.equal({
        secretKey: keypairBytes,
        source: "MODE_0600_PATH",
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects permissive keypair files and conflicting path/JSON inputs", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "pilot-keypair-"));
    const keypairPath = path.join(tempDir, "sponsor.json");
    try {
      writeFileSync(keypairPath, JSON.stringify(keypairBytes), { mode: 0o644 });
      chmodSync(keypairPath, 0o644);
      expect(() => loadExclusiveKeypairInput(
        { STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH: keypairPath },
        "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH",
        "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_JSON"
      )).to.throw(PilotCorridorConfigError).with.property(
        "code",
        "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH_MODE_0600_REQUIRED"
      );
      expect(() => loadExclusiveKeypairInput(
        {
          STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH: keypairPath,
          STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_JSON: JSON.stringify(keypairBytes),
        },
        "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH",
        "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_JSON"
      )).to.throw(PilotCorridorConfigError).with.property(
        "code",
        "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH_AND_STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_JSON_CONFLICT"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps the legacy JSON keypair input compatible when no path is set", () => {
    expect(loadExclusiveKeypairInput(
      { STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON: JSON.stringify(keypairBytes) },
      "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH",
      "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON"
    )).to.deep.equal({
      secretKey: keypairBytes,
      source: "LEGACY_ENV_JSON",
    });
  });

  it("forbids legacy inline keypairs when M6 path-only mode is active", () => {
    expect(() => loadExclusiveKeypairInput(
      { STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON: JSON.stringify(keypairBytes) },
      "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH",
      "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON",
      { pathOnly: true }
    )).to.throw(PilotCorridorConfigError).with.property(
      "code",
      "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON_FORBIDDEN_IN_M6"
    );
  });

  it("defaults to 25 test-USDC while accepting a 1 test-USDC raw M6 budget", () => {
    expect(parseTrack1BaseRaw(undefined)).to.equal(25_000_000n);
    expect(parseTrack1BaseRaw("1000000")).to.equal(1_000_000n);
    expect(formatRawUsdc(1_250_000n)).to.equal("1.25");
  });

  it("rejects zero, non-integer, and amounts above the 25 test-USDC cap", () => {
    for (const value of ["0", "1.5", "25000001", "-1"]) {
      expect(() => parseTrack1BaseRaw(value)).to.throw(PilotCorridorConfigError);
    }
  });

  it("marks every disposable sponsor identity field as PILOT TEST ONLY", () => {
    const profile = buildPilotTestSponsorProfile("m6-run", "sponsor-kyb/test-only.png");
    expect(profile.companyName).to.include("PILOT TEST ONLY");
    expect(profile.registrationNumber).to.include("PILOT-TEST-ONLY");
    expect(profile.legalRepresentative).to.include("PILOT TEST ONLY");
    expect(profile.contactPhone).to.equal("PILOT-TEST-ONLY");
    expect(profile.contactEmail).to.match(/^pilot-test-only\+/);
    expect(profile.sponsorType).to.equal("INDIVIDUAL");
  });

  it("builds the exact non-reusable PILOT TEST ONLY sponsor review marker", () => {
    expect(buildPilotTestSponsorReviewMarker("m6-run", "sponsor-wallet")).to.deep.equal({
      classification: "PILOT_TEST_ONLY_NOT_REAL_KYB",
      runId: "m6-run",
      wallet: "sponsor-wallet",
      realKyb: false,
      reusableOutsideRun: false,
    });
  });

  it("loads complete fresh and incident-resumed M6 actor-prep evidence", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "pilot-evidence-"));
    const evidencePath = path.join(tempDir, "evidence.json");
    try {
      for (const resumed of [false, true]) {
        const evidence = actorPrepEvidence(resumed);
        writeFileSync(evidencePath, JSON.stringify(evidence), { mode: 0o600 });
        chmodSync(evidencePath, 0o600);
        expect(loadM6ActorPrepEvidence({
          evidencePath,
          runId: "m6-run",
          creator: "creator-wallet",
          sponsor: "sponsor-wallet",
        })).to.deep.include({
          runId: "m6-run",
          creator: "creator-wallet",
          sponsor: "sponsor-wallet",
          mint: M6_PILOT_TEST_USDC_MINT,
          sponsorTestUsdcRaw: "1000000",
          phase: "actor_chain_preparation_complete",
          transactionCount: resumed ? 10 : 9,
        });
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects unknown/reordered steps, duplicate or malformed signatures, and count mismatches", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "pilot-evidence-"));
    const evidencePath = path.join(tempDir, "evidence.json");
    const load = () => loadM6ActorPrepEvidence({
      evidencePath,
      runId: "m6-run",
      creator: "creator-wallet",
      sponsor: "sponsor-wallet",
    });
    try {
      const cases = [
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.transactions[0].step = "unknown_operator_step";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.transactions[1].signature = evidence.transactions[0].signature;
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.transactions[0].signature = "not-base58";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.postflight.transactionCount -= 1;
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.transactions[0].simulation = "skipped";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.transactions[0].state = "prepared";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.transactions[0].confirmationStatus = "confirmed";
        },
      ];
      for (const mutate of cases) {
        const evidence = actorPrepEvidence();
        mutate(evidence);
        writeFileSync(evidencePath, JSON.stringify(evidence), { mode: 0o600 });
        chmodSync(evidencePath, 0o600);
        expect(load).to.throw(PilotCorridorConfigError).with.property(
          "code",
          "M6_ACTOR_PREP_EVIDENCE_MISMATCH"
        );
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects incorrect supply, account-space, receipt, ATA, and recovery rent-floor evidence", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "pilot-evidence-"));
    const evidencePath = path.join(tempDir, "evidence.json");
    const load = () => loadM6ActorPrepEvidence({
      evidencePath,
      runId: "m6-run",
      creator: "creator-wallet",
      sponsor: "sponsor-wallet",
    });
    try {
      const cases = [
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.postflight.testUsdcSupplyAfterRaw = "32530200001";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.postflight.creatorProfileAccountSpace = 228;
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.postflight.receiptReportIdVerified = false;
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.postflight.creatorTestUsdcRaw = "1";
        },
      ];
      for (const mutate of cases) {
        const evidence = actorPrepEvidence();
        mutate(evidence);
        writeFileSync(evidencePath, JSON.stringify(evidence), { mode: 0o600 });
        chmodSync(evidencePath, 0o600);
        expect(load).to.throw(PilotCorridorConfigError).with.property(
          "code",
          "M6_ACTOR_PREP_EVIDENCE_MISMATCH"
        );
      }

      const recoveryCases = [
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.recovery!.supplementalCreatorTopUpLamports = "612239";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.recovery!.requiredCreatorFundingFloorLamports = "3612239";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.approvedAmounts.creatorRecoveryTopUpLamports = "612241";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.postflight.recoveryTopUpLamports = "612241";
        },
        (evidence: ReturnType<typeof actorPrepEvidence>) => {
          evidence.recovery!.noBlindResend = false;
        },
      ];
      for (const mutate of recoveryCases) {
        const evidence = actorPrepEvidence(true);
        mutate(evidence);
        writeFileSync(evidencePath, JSON.stringify(evidence), { mode: 0o600 });
        chmodSync(evidencePath, 0o600);
        expect(load).to.throw(PilotCorridorConfigError).with.property(
          "code",
          "M6_ACTOR_PREP_EVIDENCE_MISMATCH"
        );
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts only dedicated credential-free HTTPS RPC URL syntax", () => {
    expect(assertDedicatedDevnetRpcUrl("https://solana-devnet.g.alchemy.com/v2/key"))
      .to.equal("https://solana-devnet.g.alchemy.com/v2/key");
    for (const invalid of [
      "https://api.devnet.solana.com",
      "http://devnet.example.com",
      "https://user:secret@devnet.example.com",
    ]) {
      expect(() => assertDedicatedDevnetRpcUrl(invalid)).to.throw(PilotCorridorConfigError);
    }
  });

  it("keeps every M6 local/chain gate before authentication and content mutation", () => {
    const implementation = readFileSync(
      path.join(__dirname, "../../scripts/smoke-production-corridor.ts"),
      "utf8"
    );
    const authentication = implementation.indexOf('beginStage("external wallet authentication")');
    const manifestMutation = implementation.indexOf('beginStage("content manifest creation")');
    const preMutationReleaseGate = implementation.indexOf(
      'checkpoint: "before-mutation"',
      implementation.indexOf("const run = async")
    );
    const chainSubmit = implementation.indexOf(
      'beginStage("proposal transaction submission")'
    );
    const preSubmitReleaseGate = implementation.indexOf(
      'checkpoint: "before-chain-submit"',
      implementation.indexOf("const run = async")
    );
    expect(authentication).to.be.greaterThan(0);
    expect(manifestMutation).to.be.greaterThan(authentication);
    expect(preMutationReleaseGate).to.be.greaterThan(0).and.lessThan(authentication);
    expect(preSubmitReleaseGate).to.be.greaterThan(manifestMutation).and.lessThan(chainSubmit);
    expect(implementation).to.include(
      'requireEnv("STREAM_PUMP_SMOKE_EXPECTED_RELEASE_SHA")'
    );
    expect(implementation).to.include(
      'requireEnv("STREAM_PUMP_SMOKE_DEPLOYED_RELEASE_SHA")'
    );
    expect(implementation).to.include("healthRelease: health.releaseSha");
    for (const requiredPreflight of [
      "proposalDeadlineUnix()",
      "getMediaBuffer(mediaPath)",
      "loadM6ActorPrepEvidence({",
      "connection.getGenesisHash()",
      "getAccount(connection, sponsorAta",
      'if (m6Mode && !media.isVideo)',
    ]) {
      const position = implementation.indexOf(requiredPreflight, implementation.indexOf("const run = async"));
      expect(position, requiredPreflight).to.be.greaterThan(0).and.lessThan(authentication);
    }
    expect(implementation).to.include('"x-pilot-run-id": smokeRunId');
    expect(implementation).to.include(
      "fetchReadiness(sponsorToken, creatorWallet, sponsorWallet)"
    );
    expect(implementation).to.include(
      "JSON.stringify(buildPilotTestSponsorReviewMarker(smokeRunId, params.sponsorWallet))"
    );
  });
});
