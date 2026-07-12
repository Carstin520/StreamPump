import {
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  ContentManifestStatus,
  ProposalStatus,
  PublicationVerificationStatus,
} from "@prisma/client";
import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import { HttpError } from "../src/controllers/http";
import {
  createGetTrack1StatusController,
  createReconcileTrack1Controller,
} from "../src/controllers/internalSettlementController";
import {
  getTrack1SettlementDiagnostic,
  reconcileTrack1Settlement,
  TRACK1_SIGNATURE_OBSERVATION_WINDOW_MS,
} from "../src/services/track1SettlementRecoveryService";
import internalSettlementRoutes from "../src/routes/v1/internalSettlementRoutes";

const deadline = new Date("2026-07-12T10:00:00.000Z");
const now = new Date("2026-07-12T12:00:00.000Z");

const makeFixture = () => {
  const proposalPda = Keypair.generate().publicKey.toBase58();
  const creator = Keypair.generate().publicKey;
  const sponsor = Keypair.generate().publicKey;
  const contentAnchorPda = Keypair.generate().publicKey.toBase58();
  const hash = "a".repeat(64);
  const proposal: any = {
    id: "proposal-1",
    proposalPda,
    creatorWallet: creator.toBase58(),
    sponsorWallet: sponsor.toBase58(),
    status: ProposalStatus.FUNDED,
    deadlineAt: deadline,
    track1BaseUsdc: 1_000n,
    track1Claimed: false,
    track2UsdcDeposited: 0n,
    track3UsdcDeposited: 0n,
    contentHashHex: hash,
    contentAnchorPda,
    contentAnchorTx: "anchor-signature",
    proofStatus: "ANCHORED",
    oracleSyncStatus: "PENDING",
    oracleLastError: null,
    latestSettlementTxSignature: null,
    updatedAt: now,
    manifest: {
      id: "manifest-1",
      status: ContentManifestStatus.PUBLISHED,
      manifestHashHex: hash,
      internalCanonicalUrl:
        "https://api.streampump.test/content/manifests/manifest-1/v/1",
      internalUrlDigestHex: "b".repeat(64),
      currentAnchorPda: contentAnchorPda,
      currentAnchorTx: "anchor-signature",
      assets: [
        {
          id: "asset-1",
          orderIndex: 0,
          assetType: AssetType.IMAGE,
          sha256Hex: "c".repeat(64),
          fileSizeBytes: 42n,
          verifiedSha256Hex: "c".repeat(64),
          verifiedSizeBytes: 42n,
          storageVerifiedAt: now,
          uploadStatus: AssetUploadStatus.UPLOADED,
          processingStatus: AssetProcessingStatus.READY,
          muxPlaybackId: null,
        },
      ],
      publications: [
        {
          id: "publication-1",
          verificationStatus: PublicationVerificationStatus.VERIFIED,
          verificationSource: "OPERATOR_APPROVED",
          verificationReviewer: "operator-wallet",
          verificationEvidenceDigestHex: "d".repeat(64),
          verifiedAt: now,
        },
      ],
    },
  };
  const onChain = {
    creator,
    sponsor,
    status: "FUNDED",
    contentHashHex: hash,
    contentAnchorPda,
    deadlineUnix: BigInt(Math.floor(deadline.getTime() / 1_000)),
    track1BaseUsdc: 1_000n,
    track1Claimed: false,
    track2UsdcDeposited: 0n,
    track3UsdcDeposited: 0n,
  };
  return { proposal, onChain, proposalPda };
};

const makeOperation = (proposalPda: string, overrides: Record<string, unknown> = {}) => ({
  id: "operation-1",
  proposalId: "proposal-1",
  proposalPda,
  track: "TRACK1",
  idempotencyKey: "manual-settlement-1",
  payloadHash: "payload-hash",
  operatorIdentity: "secret-operator-identity",
  evidenceDigest: "evidence-digest",
  status: "SUBMITTED",
  txSignature: "settlement-signature",
  errorCode: null,
  errorMessage: null,
  attemptCount: 1,
  leaseToken: null,
  leaseExpiresAt: null,
  lastAttemptAt: new Date(now.getTime() - 60_000),
  submittedAt: new Date(now.getTime() - 60_000),
  confirmedAt: null,
  failedAt: null,
  createdAt: new Date(now.getTime() - 120_000),
  updatedAt: new Date(now.getTime() - 60_000),
  ...overrides,
});

const matchesUnlockedWhere = (operation: any, where: any): boolean => {
  if (where.id && where.id !== operation.id) return false;
  if (!where.OR) return true;
  return where.OR.some((condition: any) => {
    if (condition.leaseToken === null) return operation.leaseToken === null;
    if (condition.leaseExpiresAt === null) return operation.leaseExpiresAt === null;
    if (condition.leaseExpiresAt?.lte) {
      return Boolean(
        operation.leaseExpiresAt &&
          operation.leaseExpiresAt <= condition.leaseExpiresAt.lte
      );
    }
    return false;
  });
};

const makePrisma = (proposal: any, initialOperation: any | null) => {
  let operation = initialOperation;
  const client = {
    proposal: {
      findUnique: async () => proposal,
    },
    track1SettlementOperation: {
      findUnique: async () => (operation ? { ...operation } : null),
      updateMany: async ({ where, data }: any) => {
        if (!operation || !matchesUnlockedWhere(operation, where)) {
          return { count: 0 };
        }
        Object.assign(operation, data, { updatedAt: now });
        return { count: 1 };
      },
    },
  };
  return {
    client,
    get operation() {
      return operation;
    },
  };
};

const expectHttpError = async (promise: Promise<unknown>, code: string) => {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).to.be.instanceOf(HttpError);
  expect((thrown as HttpError).code).to.equal(code);
};

describe("track1SettlementRecoveryService", () => {
  it("returns a complete eligible preflight without creating an operation", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal, null);
    const result = await getTrack1SettlementDiagnostic(fixture.proposalPda, {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => fixture.onChain,
        getSignatureState: async () => "NOT_FOUND",
      },
      now: () => now,
    });

    expect(result.projection.track1Claimed).to.equal(false);
    expect(result.chain).to.include({ reachable: true, exists: true });
    expect(result.chain.mismatchFields).to.deep.equal([]);
    expect(result.integrity).to.include({
      manifestFinalized: true,
      assetsReady: true,
      operatorApprovedPublication: true,
      track1OnlyBudget: true,
    });
    expect(result.operation).to.deep.equal({ exists: false });
    expect(result.lease).to.include({ active: false, tokenRedacted: false });
    expect(result.signatures).to.deep.equal([]);
    expect(result.actions).to.include({
      canExecute: true,
      canReconcile: true,
      autoResubmit: false,
    });
    expect(db.operation).to.equal(null);
  });

  it("gives PENDING a bounded observation window and never auto-resubmits", async () => {
    const fixture = makeFixture();
    const operation = makeOperation(fixture.proposalPda);
    const db = makePrisma(fixture.proposal, operation);
    const result = await getTrack1SettlementDiagnostic(fixture.proposalPda, {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => fixture.onChain,
        getSignatureState: async () => "PENDING",
      },
      now: () => now,
    });

    expect(result.signatures[0]).to.include({
      state: "PENDING",
      resolution: "WAITING",
      timedOut: false,
      autoResubmit: false,
    });
    expect(result.signatures[0].nextCheckAt).to.equal(
      new Date(now.getTime() + 15_000).toISOString()
    );
    expect(result.signatures[0].observationDeadlineAt).to.equal(
      new Date(
        operation.submittedAt.getTime() +
          TRACK1_SIGNATURE_OBSERVATION_WINDOW_MS
      ).toISOString()
    );
    expect(result.actions.canExecute).to.equal(false);
    expect(result.actions.blockers.map((item: any) => item.code)).to.include(
      "TRACK1_SIGNATURE_PENDING"
    );
  });

  it("turns a long-lived NOT_FOUND into an explicit terminal observation timeout", async () => {
    const fixture = makeFixture();
    const submittedAt = new Date(
      now.getTime() - TRACK1_SIGNATURE_OBSERVATION_WINDOW_MS - 1
    );
    const db = makePrisma(
      fixture.proposal,
      makeOperation(fixture.proposalPda, { submittedAt, updatedAt: submittedAt })
    );
    const result = await getTrack1SettlementDiagnostic(fixture.proposalPda, {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => fixture.onChain,
        getSignatureState: async () => "NOT_FOUND",
      },
      now: () => now,
    });

    expect(result.signatures[0]).to.include({
      state: "NOT_FOUND",
      resolution: "TIMED_OUT",
      timedOut: true,
      nextCheckAt: null,
      autoResubmit: false,
    });
    expect(result.actions.blockers.map((item: any) => item.code)).to.include(
      "TRACK1_SIGNATURE_OBSERVATION_TIMED_OUT"
    );
  });

  it("repairs audit and projection proof only after chain settlement and signature success", async () => {
    const fixture = makeFixture();
    const operation = makeOperation(fixture.proposalPda);
    const db = makePrisma(fixture.proposal, operation);
    let syncCount = 0;
    const result = await reconcileTrack1Settlement(
      {
        proposalPda: fixture.proposalPda,
        operatorIdentity: "recovery-operator",
      },
      {
        prisma: db.client,
        anchor: {
          fetchProposalState: async () => ({
            ...fixture.onChain,
            track1Claimed: true,
          }),
          getSignatureState: async () => "SUCCESS",
        },
        syncProjection: async ({ signature }) => {
          syncCount += 1;
          fixture.proposal.track1Claimed = true;
          fixture.proposal.latestSettlementTxSignature = signature;
          fixture.proposal.proofStatus = "SETTLED";
          return fixture.proposal;
        },
        audit: async (input) => {
          expect(input).to.deep.include({
            action: "TRACK1_SETTLEMENT_RECONCILED",
            operatorIdentity: "recovery-operator",
            resourceType: "TRACK1_SETTLEMENT",
            resourceId: fixture.proposalPda,
          });
        },
        now: () => now,
      }
    );

    expect(syncCount).to.equal(1);
    expect(db.operation.status).to.equal("CONFIRMED");
    expect(db.operation.confirmedAt).to.deep.equal(now);
    expect(result.reconciliation).to.deep.include({
      repairedOperation: true,
      repairedProjection: true,
      submittedTransaction: false,
      autoResubmit: false,
      operatorIdentityRedacted: true,
    });
    expect(result.projection).to.include({
      track1Claimed: true,
      proofStatus: "SETTLED",
      latestSettlementTxSignature: "settlement-signature",
    });
  });

  it("records a timed-out signature without syncing or submitting a transaction", async () => {
    const fixture = makeFixture();
    const submittedAt = new Date(
      now.getTime() - TRACK1_SIGNATURE_OBSERVATION_WINDOW_MS - 1
    );
    const db = makePrisma(
      fixture.proposal,
      makeOperation(fixture.proposalPda, { submittedAt, updatedAt: submittedAt })
    );
    let syncCount = 0;
    const result = await reconcileTrack1Settlement(
      {
        proposalPda: fixture.proposalPda,
        operatorIdentity: "recovery-operator",
      },
      {
        prisma: db.client,
        anchor: {
          fetchProposalState: async () => fixture.onChain,
          getSignatureState: async () => "NOT_FOUND",
        },
        syncProjection: async () => {
          syncCount += 1;
          return fixture.proposal;
        },
        audit: async (input) => {
          expect(input.payload).to.deep.include({
            submittedTransaction: false,
            autoResubmit: false,
          });
        },
        now: () => now,
      }
    );

    expect(syncCount).to.equal(0);
    expect(db.operation.status).to.equal("SUBMITTED");
    expect(db.operation.errorCode).to.equal(
      "TRACK1_SIGNATURE_OBSERVATION_TIMED_OUT"
    );
    expect(result.reconciliation).to.include({
      submittedTransaction: false,
      autoResubmit: false,
    });
  });

  it("redacts stored error details and lease tokens from status responses", async () => {
    const fixture = makeFixture();
    const leaseExpiresAt = new Date(now.getTime() + 60_000);
    const db = makePrisma(
      fixture.proposal,
      makeOperation(fixture.proposalPda, {
        errorCode: "UNEXPECTED_VENDOR_ERROR",
        errorMessage:
          "Bearer super-secret https://rpc.example.test/?api-key=secret",
        leaseToken: "raw-secret-lease-token",
        leaseExpiresAt,
      })
    );
    const result = await getTrack1SettlementDiagnostic(fixture.proposalPda, {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => fixture.onChain,
        getSignatureState: async () => "PENDING",
      },
      now: () => now,
    });
    const serialized = JSON.stringify(result);

    expect(result.operation.error).to.deep.equal({
      code: "UNEXPECTED_VENDOR_ERROR",
      message: "The Track 1 operation requires operator review.",
      detailsRedacted: true,
    });
    expect(result.lease).to.include({
      active: true,
      expiresAt: leaseExpiresAt.toISOString(),
      tokenRedacted: true,
    });
    expect(serialized).not.to.include("super-secret");
    expect(serialized).not.to.include("raw-secret-lease-token");
    expect(serialized).not.to.include("secret-operator-identity");
  });

  it("refuses reconciliation while an unexpired fenced lease is active", async () => {
    const fixture = makeFixture();
    const db = makePrisma(
      fixture.proposal,
      makeOperation(fixture.proposalPda, {
        leaseToken: "active-lease",
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      })
    );
    await expectHttpError(
      reconcileTrack1Settlement(
        {
          proposalPda: fixture.proposalPda,
          operatorIdentity: "recovery-operator",
        },
        {
          prisma: db.client,
          anchor: {
            fetchProposalState: async () => fixture.onChain,
            getSignatureState: async () => "PENDING",
          },
          now: () => now,
        }
      ),
      "TRACK1_RECONCILE_LEASE_ACTIVE"
    );
  });
});

const makeResponse = () => {
  const response: any = {
    statusCode: 0,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
  return response;
};

describe("internal Track 1 recovery controllers", () => {
  it("fails closed before status service access when operator identity is absent", async () => {
    let called = false;
    const controller = createGetTrack1StatusController({
      getDiagnostic: async () => {
        called = true;
        return {};
      },
      reconcile: async () => ({}),
    });
    const response = makeResponse();
    await controller(
      { params: { proposalPda: "proposal" } } as any,
      response
    );

    expect(called).to.equal(false);
    expect(response.statusCode).to.equal(400);
    expect(response.payload.error.code).to.equal("OPERATOR_ID_REQUIRED");
  });

  it("mounts operator auth before status, reconcile, and manual execution routes", () => {
    const stack = (internalSettlementRoutes as any).stack;
    expect(stack[0].name).to.equal("requireInternalOperatorAuth");
    expect(
      stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }))
    ).to.deep.equal([
      { path: "/:proposalPda/track1", methods: ["get"] },
      { path: "/:proposalPda/track1/reconcile", methods: ["post"] },
      { path: "/:proposalPda/track1", methods: ["post"] },
    ]);
  });

  it("passes only the authenticated operator identity into reconcile", async () => {
    let received: any;
    const controller = createReconcileTrack1Controller({
      getDiagnostic: async () => ({}),
      reconcile: async (params) => {
        received = params;
        return { reconciled: true };
      },
    });
    const response = makeResponse();
    await controller(
      {
        params: { proposalPda: "proposal-pda" },
        operatorIdentity: "operator-from-auth",
      } as any,
      response
    );

    expect(received).to.deep.equal({
      proposalPda: "proposal-pda",
      operatorIdentity: "operator-from-auth",
    });
    expect(response.statusCode).to.equal(200);
    expect(response.payload).to.deep.equal({
      ok: true,
      data: { reconciled: true },
    });
  });
});
