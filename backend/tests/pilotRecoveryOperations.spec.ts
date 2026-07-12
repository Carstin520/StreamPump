import { expect } from "chai";

import {
  reconcileProposalIntentWithAudit,
  replayChainTransactionWithAudit,
} from "../src/services/pilotRecoveryOperations";

describe("audited Pilot recovery operations", () => {
  it("records safe evidence only after a chain replay syncs", async () => {
    const events: unknown[] = [];
    const result = await replayChainTransactionWithAudit(
      { signature: "public-chain-signature", operatorIdentity: "operator-wallet" },
      {
        ingest: async () => ({ status: "SYNCED", instructionCount: 2 }),
        audit: async (event) => {
          events.push(event);
        },
      }
    );
    expect(result.status).to.equal("SYNCED");
    expect(events).to.have.length(1);
    expect(events[0]).to.deep.include({
      action: "CHAIN_TRANSACTION_REPLAYED",
      operatorIdentity: "operator-wallet",
      resourceType: "CHAIN_TRANSACTION",
    });
    expect(JSON.stringify(events[0])).not.to.include("http");
    expect(JSON.stringify(events[0])).not.to.include("Bearer");
  });

  it("does not write a success event for a replay visibility gap or thrown recovery", async () => {
    const events: unknown[] = [];
    await replayChainTransactionWithAudit(
      { signature: "missing-signature", operatorIdentity: "operator-wallet" },
      {
        ingest: async () => ({ status: "NOT_FOUND", instructionCount: 0 }),
        audit: async (event) => {
          events.push(event);
        },
      }
    );
    let thrown: unknown;
    try {
      await reconcileProposalIntentWithAudit(
        { intentId: "intent-1", operatorIdentity: "operator-wallet" },
        {
          reconcile: async () => {
            throw new Error("failed recovery");
          },
          audit: async (event) => {
            events.push(event);
          },
        }
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).to.be.instanceOf(Error);
    expect(events).to.deep.equal([]);
  });

  it("audits a successful intent reconcile without storing the signed transaction", async () => {
    const events: unknown[] = [];
    await reconcileProposalIntentWithAudit(
      { intentId: "intent-1", operatorIdentity: "operator-wallet" },
      {
        reconcile: async () => ({
          recovered: true,
          reason: "CONFIRMED_FROM_STORED_TRANSACTION" as const,
          intentId: "intent-1",
          bundleId: "bundle-1",
          chainTxSignature: "public-chain-signature",
        }),
        audit: async (event) => {
          events.push(event);
        },
      }
    );
    expect(events).to.have.length(1);
    expect(JSON.stringify(events[0])).not.to.include("fullySignedBase64");
    expect(events[0]).to.deep.include({
      action: "PROPOSAL_INTENT_RECONCILED",
      resourceId: "intent-1",
    });
  });
});
