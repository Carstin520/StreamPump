import { BundleStatus, ProposalIntentStatus } from "@prisma/client";
import { expect } from "chai";

import { HttpError } from "../src/controllers/http";
import { reconcileStoredProposalIntent } from "../src/services/proposalIntentRecoveryService";

const expiredIntent = () => ({
  id: "intent-expired",
  status: ProposalIntentStatus.EXPIRED,
  chainTxSignature: "confirmed-signature",
  creatorWallet: "creator-wallet",
  sponsorWallet: "sponsor-wallet",
  txBundles: [
    {
      id: "bundle-expired",
      status: BundleStatus.EXPIRED,
      chainTxSignature: "confirmed-signature",
      messageBase64: "canonical-message",
      fullySignedBase64: "stored-fully-signed-transaction",
      expiresAt: new Date("2026-07-12T00:00:00.000Z"),
      createdAt: new Date("2026-07-11T23:00:00.000Z"),
    },
  ],
});

describe("proposal intent recovery", () => {
  it("reconciles an expired bundle that is already confirmed without resending it", async () => {
    const finalized: unknown[] = [];
    let signatureChecks = 0;
    const result = await reconcileStoredProposalIntent("intent-expired", {
      prisma: {
        proposalIntent: {
          findUnique: async () => expiredIntent(),
        },
      } as any,
      getSignatureState: async () => {
        signatureChecks += 1;
        return "SUCCESS";
      },
      finalize: async (params: any) => {
        finalized.push(params);
        return { id: params.bundleId } as any;
      },
      extractSignature: () => "confirmed-signature",
      assertMessageMatches: () => undefined,
      assertSignerPresent: () => undefined,
    });

    expect(signatureChecks).to.equal(1);
    expect(finalized).to.deep.equal([
      {
        intentId: "intent-expired",
        bundleId: "bundle-expired",
        fullySignedTxBase64: "stored-fully-signed-transaction",
        chainTxSignature: "confirmed-signature",
      },
    ]);
    expect(result).to.deep.include({
      recovered: true,
      reason: "CONFIRMED_FROM_STORED_TRANSACTION",
      chainTxSignature: "confirmed-signature",
    });
  });

  it("fails closed when the stored signature is not confirmed", async () => {
    let finalizeCalls = 0;
    let thrown: unknown;
    try {
      await reconcileStoredProposalIntent("intent-expired", {
        prisma: {
          proposalIntent: {
            findUnique: async () => expiredIntent(),
          },
        } as any,
        getSignatureState: async () => "NOT_FOUND",
        finalize: async () => {
          finalizeCalls += 1;
          return {} as any;
        },
        extractSignature: () => "confirmed-signature",
        assertMessageMatches: () => undefined,
        assertSignerPresent: () => undefined,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(HttpError);
    expect((thrown as HttpError).code).to.equal("INTENT_CHAIN_TRANSACTION_NOT_CONFIRMED");
    expect(finalizeCalls).to.equal(0);
  });

  it("rejects a stored signature that is unrelated to the fully signed transaction", async () => {
    let signatureChecks = 0;
    let thrown: unknown;
    try {
      await reconcileStoredProposalIntent("intent-expired", {
        prisma: {
          proposalIntent: { findUnique: async () => expiredIntent() },
        } as any,
        getSignatureState: async () => {
          signatureChecks += 1;
          return "SUCCESS";
        },
        finalize: async () => ({} as any),
        extractSignature: () => "different-signature",
        assertMessageMatches: () => undefined,
        assertSignerPresent: () => undefined,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).to.be.instanceOf(HttpError);
    expect((thrown as HttpError).code).to.equal("INTENT_CHAIN_SIGNATURE_MISMATCH");
    expect(signatureChecks).to.equal(0);
  });

  it("requires the stored transaction message and both participant signatures", async () => {
    let signerChecks = 0;
    let thrown: unknown;
    try {
      await reconcileStoredProposalIntent("intent-expired", {
        prisma: {
          proposalIntent: { findUnique: async () => expiredIntent() },
        } as any,
        getSignatureState: async () => "SUCCESS",
        finalize: async () => ({} as any),
        extractSignature: () => "confirmed-signature",
        assertMessageMatches: () => undefined,
        assertSignerPresent: (_tx, wallet) => {
          signerChecks += 1;
          if (wallet === "sponsor-wallet") throw new Error("missing signature");
        },
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).to.be.instanceOf(HttpError);
    expect((thrown as HttpError).code).to.equal("INTENT_STORED_TRANSACTION_INVALID");
    expect(signerChecks).to.equal(2);
  });
});
