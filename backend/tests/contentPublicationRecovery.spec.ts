import { PublicationVerificationStatus } from "@prisma/client";
import { expect } from "chai";

import {
  ContentPublicationRecoveryDependencies,
  reopenContentPublication,
  revokeContentPublication,
} from "../src/services/contentPublicationRecoveryService";

describe("content publication recovery", () => {
  it("revokes then reopens a publication with immutable operator events and eligibility resync", async () => {
    const publication = {
      id: "publication-1",
      manifestId: "manifest-1",
      verificationStatus: PublicationVerificationStatus.VERIFIED,
      verificationSource: "OPERATOR_APPROVED",
      verificationReviewer: "reviewer-1",
      verificationNote: null,
      verificationEvidenceDigestHex: "a".repeat(64),
      verifiedAt: new Date("2026-07-12T09:00:00.000Z"),
      rejectedAt: null as Date | null,
    };
    const events: Array<Record<string, unknown>> = [];
    const syncs: string[] = [];
    const tx = {
      contentPublication: {
        updateMany: async ({ where, data }: {
          where: { verificationStatus: PublicationVerificationStatus };
          data: Record<string, unknown>;
        }) => {
          if (publication.verificationStatus !== where.verificationStatus) {
            return { count: 0 };
          }
          Object.assign(publication, data);
          return { count: 1 };
        },
      },
      pilotOperatorEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          events.push(data);
          return data;
        },
      },
    };
    const dependencies = {
      prisma: {
        contentPublication: { findUnique: async () => ({ ...publication }) },
        pilotOperatorEvent: { findMany: async () => [] },
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      },
      syncEligibility: async (manifestId: string) => {
        syncs.push(manifestId);
        return {
          manifestId,
          assetsReady: true,
          hasVerifiedPublication: false,
          publicFeedEligible: false,
          contentPublishedVerifiedAt: null,
        };
      },
    } as unknown as ContentPublicationRecoveryDependencies;

    const revoked = await revokeContentPublication(
      {
        publicationId: publication.id,
        operatorIdentity: "operator-wallet",
        reason: "proof no longer resolves",
        evidenceDigestHex: "b".repeat(64),
      },
      dependencies
    );
    expect(revoked.verificationStatus).to.equal(PublicationVerificationStatus.REJECTED);
    expect(publication.verificationSource).to.equal("OPERATOR_REVOKED");
    expect(publication.verifiedAt).to.equal(null);
    expect(publication.rejectedAt).to.be.instanceOf(Date);

    const reopened = await reopenContentPublication(
      {
        publicationId: publication.id,
        operatorIdentity: "operator-wallet",
        reason: "creator supplied corrected proof",
      },
      dependencies
    );
    expect(reopened.verificationStatus).to.equal(PublicationVerificationStatus.PENDING);
    expect(publication.verificationSource).to.equal(null);
    expect(publication.verificationReviewer).to.equal(null);
    expect(publication.verificationEvidenceDigestHex).to.equal(null);
    expect(syncs).to.deep.equal(["manifest-1", "manifest-1"]);
    expect(events.map((event) => event.action)).to.deep.equal([
      "PUBLICATION_REVOKED",
      "PUBLICATION_REOPENED",
    ]);
    expect(events.every((event) => event.operatorIdentity === "operator-wallet")).to.equal(true);
  });
});
