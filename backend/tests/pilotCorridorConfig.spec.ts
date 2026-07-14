import { expect } from "chai";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

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

  it("loads only complete mode-0600 actor-prep evidence bound to the exact M6 run", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "pilot-evidence-"));
    const evidencePath = path.join(tempDir, "evidence.json");
    const evidence = {
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
        mintToFeePayerTestUsdcRaw: "1000000",
        transferToSponsorTestUsdcRaw: "1000000",
      },
      pilotTestUpgradeReport: { report: { runId: "m6-run" } },
      transactions: [{ state: "finalized", confirmationStatus: "finalized" }],
      postflight: {
        allTransactionsFinalized: true,
        feePayerTestUsdcRaw: "0",
        sponsorTestUsdcRaw: "1000000",
        creatorLevel: 2,
        creatorStatus: "S2_ACTIVE",
        forbiddenLaneInstructionsSent: 0,
      },
    };
    try {
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
      });

      writeFileSync(evidencePath, JSON.stringify({ ...evidence, phase: "execution_started" }));
      expect(() => loadM6ActorPrepEvidence({
        evidencePath,
        runId: "m6-run",
        creator: "creator-wallet",
        sponsor: "sponsor-wallet",
      })).to.throw(PilotCorridorConfigError).with.property(
        "code",
        "M6_ACTOR_PREP_EVIDENCE_MISMATCH"
      );

      writeFileSync(evidencePath, JSON.stringify({
        ...evidence,
        approvedAmounts: {
          ...evidence.approvedAmounts,
          transferToSponsorTestUsdcRaw: "2000000",
        },
      }));
      expect(() => loadM6ActorPrepEvidence({
        evidencePath,
        runId: "m6-run",
        creator: "creator-wallet",
        sponsor: "sponsor-wallet",
      })).to.throw(PilotCorridorConfigError).with.property(
        "code",
        "M6_ACTOR_PREP_EVIDENCE_MISMATCH"
      );
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
