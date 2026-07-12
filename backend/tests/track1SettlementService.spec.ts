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
  settleTrack1Manually,
  TRACK1_MANUAL_SETTLEMENT_CONFIRMATION,
  track1ProjectionMismatchFields,
} from "../src/services/track1SettlementService";

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
    latestSettlementTxSignature: null,
    onChainTxSignature: "funding-signature",
    manifest: {
      id: "manifest-1",
      status: ContentManifestStatus.PUBLISHED,
      manifestHashHex: hash,
      internalCanonicalUrl: "https://api.streampump.test/content/manifests/manifest-1/v/1",
      internalUrlDigestHex: "b".repeat(64),
      currentAnchorPda: contentAnchorPda,
      currentAnchorTx: "anchor-signature",
      assets: [{
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
      }],
      publications: [{
        id: "publication-1",
        verificationStatus: PublicationVerificationStatus.VERIFIED,
        verificationSource: "OPERATOR_APPROVED",
        verificationReviewer: "operator-wallet",
        verificationEvidenceDigestHex: "d".repeat(64),
        verifiedAt: now,
        externalUrlDigestHex: "e".repeat(64),
      }],
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

const makePrisma = (proposal: any) => {
  let operation: any = null;
  const snapshot = () => (operation ? { ...operation } : null);
  const apply = (target: any, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in value) {
        target[key] = (target[key] ?? 0) + (value as any).increment;
      } else {
        target[key] = value;
      }
    }
    target.updatedAt = now;
    return target;
  };
  const statusMatches = (where: any): boolean => {
    if (!operation) return false;
    if (where.OR && !where.OR.some((candidate: any) => statusMatches(candidate))) return false;
    if (typeof where.status === "string" && operation.status !== where.status) return false;
    if (where.status?.in && !where.status.in.includes(operation.status)) return false;
    if (where.status?.not && operation.status === where.status.not) return false;
    if (where.leaseToken !== undefined && operation.leaseToken !== where.leaseToken) return false;
    if (where.txSignature !== undefined && operation.txSignature !== where.txSignature) return false;
    if (
      where.leaseExpiresAt?.lt &&
      !(operation.leaseExpiresAt && operation.leaseExpiresAt < where.leaseExpiresAt.lt)
    ) return false;
    if (
      where.leaseExpiresAt?.lte &&
      !(operation.leaseExpiresAt && operation.leaseExpiresAt <= where.leaseExpiresAt.lte)
    ) return false;
    return true;
  };
  return {
    get operation() { return operation; },
    expireLease() {
      if (operation) operation.leaseExpiresAt = new Date(now.getTime() - 1);
    },
    client: {
      proposal: {
        findUnique: async () => proposal,
      },
      track1SettlementOperation: {
        findUnique: async () => snapshot(),
        create: async ({ data }: any) => {
          operation = {
            id: "operation-1",
            ...data,
            txSignature: null,
            errorCode: null,
            errorMessage: null,
            attemptCount: 0,
            leaseToken: null,
            leaseExpiresAt: null,
            lastAttemptAt: null,
            submittedAt: null,
            confirmedAt: null,
            failedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          return snapshot();
        },
        updateMany: async ({ where, data }: any) => {
          if (!statusMatches(where)) return { count: 0 };
          apply(operation, data);
          return { count: 1 };
        },
      },
    },
  };
};

const request = (proposalPda: string) => ({
  proposalPda,
  idempotencyKey: "settle-track1-proposal-1",
  confirmation: TRACK1_MANUAL_SETTLEMENT_CONFIRMATION,
  operatorIdentity: "operator-wallet",
});

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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("condition was not reached");
};

describe("track1SettlementService", () => {
  it("executes once, confirms from chain, and replays idempotently", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    let claimed = false;
    let executeCount = 0;
    let syncCount = 0;
    const dependencies: any = {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => ({ ...fixture.onChain, track1Claimed: claimed }),
        executeSettleTrack1Base: async () => {
          executeCount += 1;
          claimed = true;
          return "settlement-signature";
        },
        getSignatureState: async () => "SUCCESS",
      },
      syncProjection: async () => { syncCount += 1; },
      now: () => now,
      randomId: () => "lease-1",
    };

    const first = await settleTrack1Manually(request(fixture.proposalPda), dependencies);
    const replay = await settleTrack1Manually(request(fixture.proposalPda), dependencies);

    expect(first.status).to.equal("CONFIRMED");
    expect(replay.status).to.equal("CONFIRMED");
    expect(first.txSignature).to.equal("settlement-signature");
    expect(executeCount).to.equal(1);
    expect(syncCount).to.equal(2);
  });

  it("keeps SUBMITTED when RPC projection lags after a returned signature", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    let executeCount = 0;
    const result = await settleTrack1Manually(request(fixture.proposalPda), {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => fixture.onChain,
        executeSettleTrack1Base: async () => {
          executeCount += 1;
          return "settlement-signature";
        },
        getSignatureState: async () => "PENDING",
      },
      syncProjection: async () => undefined,
      now: () => now,
      randomId: () => "lease-1",
    } as any);

    expect(result.status).to.equal("SUBMITTED");
    expect(result.txSignature).to.equal("settlement-signature");
    expect(db.operation.errorCode).to.equal("TRACK1_CHAIN_CONFIRMATION_PENDING");
    expect(executeCount).to.equal(1);
  });

  it("does not downgrade or resend SUBMITTED work when a later preflight read mismatches", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    let executeCount = 0;
    let mismatched = false;
    const dependencies: any = {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => ({
          ...fixture.onChain,
          track1BaseUsdc: mismatched ? 999n : fixture.onChain.track1BaseUsdc,
        }),
        executeSettleTrack1Base: async () => {
          executeCount += 1;
          return "settlement-signature";
        },
        getSignatureState: async () => "PENDING",
      },
      syncProjection: async () => undefined,
      now: () => now,
      randomId: () => "lease-1",
    };

    expect((await settleTrack1Manually(request(fixture.proposalPda), dependencies)).status)
      .to.equal("SUBMITTED");
    mismatched = true;
    await expectHttpError(
      settleTrack1Manually(request(fixture.proposalPda), dependencies),
      "TRACK1_CHAIN_DB_MISMATCH"
    );
    expect(db.operation.status).to.equal("SUBMITTED");
    mismatched = false;
    expect((await settleTrack1Manually(request(fixture.proposalPda), dependencies)).status)
      .to.equal("SUBMITTED");
    expect(executeCount).to.equal(1);
  });

  it("never resubmits a chain-settled proposal when its settlement signature is missing", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    let executeCount = 0;
    const dependencies: any = {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => ({ ...fixture.onChain, track1Claimed: true }),
        executeSettleTrack1Base: async () => { executeCount += 1; return "must-not-run"; },
        getSignatureState: async () => "NOT_FOUND",
      },
      syncProjection: async () => undefined,
      now: () => now,
      randomId: () => "lease-1",
    };

    await expectHttpError(
      settleTrack1Manually(request(fixture.proposalPda), dependencies),
      "CHAIN_SETTLED_SIGNATURE_MISSING"
    );
    await expectHttpError(
      settleTrack1Manually(request(fixture.proposalPda), dependencies),
      "CHAIN_SETTLED_SIGNATURE_MISSING"
    );
    expect(db.operation.status).to.equal("SUBMITTED");
    expect(executeCount).to.equal(0);
  });

  it("does not confirm proof from a failed candidate settlement signature", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    let claimed = false;
    let syncCount = 0;
    const dependencies: any = {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => ({ ...fixture.onChain, track1Claimed: claimed }),
        executeSettleTrack1Base: async () => "failed-settlement-signature",
        getSignatureState: async () => "FAILED",
      },
      syncProjection: async () => { syncCount += 1; },
      now: () => now,
      randomId: () => "lease-1",
    };

    expect((await settleTrack1Manually(request(fixture.proposalPda), dependencies)).status)
      .to.equal("SUBMITTED");
    claimed = true;
    await expectHttpError(
      settleTrack1Manually(request(fixture.proposalPda), dependencies),
      "CHAIN_SETTLED_SIGNATURE_UNVERIFIED"
    );
    expect(db.operation.status).to.equal("SUBMITTED");
    expect(db.operation.confirmedAt).to.equal(null);
    expect(syncCount).to.equal(0);
  });

  it("fences a stale worker after another request reacquires the expired lease", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    const firstExecution = deferred<string>();
    const secondExecution = deferred<string>();
    let executeCount = 0;
    let leaseSequence = 0;
    const dependencies: any = {
      prisma: db.client,
      anchor: {
        fetchProposalState: async () => fixture.onChain,
        executeSettleTrack1Base: async () => {
          executeCount += 1;
          return executeCount === 1 ? firstExecution.promise : secondExecution.promise;
        },
        getSignatureState: async () => "SUCCESS",
      },
      syncProjection: async () => undefined,
      now: () => now,
      randomId: () => `lease-${++leaseSequence}`,
    };

    const first = settleTrack1Manually(request(fixture.proposalPda), dependencies);
    await waitFor(() => executeCount === 1);
    db.expireLease();
    const second = settleTrack1Manually(request(fixture.proposalPda), dependencies);
    await waitFor(() => executeCount === 2);

    firstExecution.resolve("stale-worker-signature");
    await expectHttpError(first, "TRACK1_SETTLEMENT_LEASE_LOST");
    expect(db.operation.leaseToken).to.equal("lease-2");
    expect(db.operation.txSignature).to.equal(null);

    secondExecution.reject(new Error("already settled by competing worker"));
    await second.catch(() => undefined);
  });

  it("fails closed on any chain/database truth mismatch", async () => {
    const fixture = makeFixture();
    const db = makePrisma(fixture.proposal);
    let executeCount = 0;
    await expectHttpError(
      settleTrack1Manually(request(fixture.proposalPda), {
        prisma: db.client,
        anchor: {
          fetchProposalState: async () => ({ ...fixture.onChain, track1BaseUsdc: 999n }),
          executeSettleTrack1Base: async () => { executeCount += 1; return "must-not-run"; },
          getSignatureState: async () => "NOT_FOUND",
        },
        syncProjection: async () => undefined,
        now: () => now,
        randomId: () => "lease-1",
      } as any),
      "TRACK1_CHAIN_DB_MISMATCH"
    );
    expect(executeCount).to.equal(0);
    expect(db.operation.status).to.equal("FAILED");
    expect(
      track1ProjectionMismatchFields({
        proposal: fixture.proposal,
        onChain: { ...fixture.onChain, sponsor: Keypair.generate().publicKey },
      })
    ).to.include("sponsorWallet");
  });

  it("maps an invalid proposal PDA to a 400 business error before DB access", async () => {
    await expectHttpError(
      settleTrack1Manually(
        request("not-a-public-key"),
        {
          prisma: { proposal: { findUnique: async () => { throw new Error("must not run"); } } },
          anchor: {} as any,
          syncProjection: async () => undefined,
          now: () => now,
          randomId: () => "lease-1",
        }
      ),
      "INVALID_PROPOSAL_PDA"
    );
  });
});
