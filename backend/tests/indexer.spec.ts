import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import { AnchorService } from "../src/services/AnchorService";
import { prisma } from "../src/services/prisma";
import {
  createIndexerHealthMonitor,
  ingestConfirmedProgramTransaction,
  INDEXER_NOT_FOUND_TERMINAL_ATTEMPTS,
  mapEventNameToInstructionName,
  mergeAnchorEventsWithInstructions,
  mapInstructionAccounts,
  normalizeIndexerJson,
  processOrderedBackfill,
  selectBackfillSignatures,
  selectPrimaryEntityPda,
  waitForInitialIndexerSlot,
} from "../src/services/indexer";

describe("indexer helpers", () => {
  it("normalizes nested BigInt, PublicKey, and bytes into JSON-safe payloads", () => {
    const keypair = Keypair.generate();
    const normalized = normalizeIndexerJson({
      amount: 42n,
      authority: keypair.publicKey,
      digest: Uint8Array.from([1, 2, 3, 4]),
      nested: {
        values: [7n, keypair.publicKey],
      },
    }) as Record<string, any>;

    expect(normalized.amount).to.equal("42");
    expect(normalized.authority).to.equal(keypair.publicKey.toBase58());
    expect(normalized.digest).to.equal("01020304");
    expect(normalized.nested.values[0]).to.equal("7");
    expect(normalized.nested.values[1]).to.equal(keypair.publicKey.toBase58());
  });

  it("maps idl account names to decoded account addresses", () => {
    const accounts = [Keypair.generate().publicKey, Keypair.generate().publicKey];
    const mapped = mapInstructionAccounts({
      accountNames: ["proposal", "creator_profile", "missing"],
      accountPubkeys: accounts,
    });

    expect(mapped.proposal).to.equal(accounts[0].toBase58());
    expect(mapped.creator_profile).to.equal(accounts[1].toBase58());
    expect(mapped.missing).to.equal(null);
  });

  it("selects proposal as the primary entity when available", () => {
    const entity = selectPrimaryEntityPda({
      proposal: "proposal_pda",
      creator_profile: "creator_profile_pda",
      content_anchor: "content_anchor_pda",
    });

    expect(entity).to.equal("proposal_pda");
  });

  it("falls back to creator_profile or content_anchor when no proposal is present", () => {
    expect(
      selectPrimaryEntityPda({
        proposal: null,
        creator_profile: "creator_profile_pda",
        content_anchor: "content_anchor_pda",
      })
    ).to.equal("creator_profile_pda");

    expect(
      selectPrimaryEntityPda({
        proposal: null,
        creator_profile: null,
        content_anchor: "content_anchor_pda",
      })
    ).to.equal("content_anchor_pda");
  });

  it("maps known Anchor event names to instruction names", () => {
    expect(mapEventNameToInstructionName("ProposalCreated")).to.equal("create_proposal");
    expect(mapEventNameToInstructionName("ContentAnchored")).to.equal("anchor_content_hash");
    expect(mapEventNameToInstructionName("S1BuyoutOfferSubmitted")).to.equal(
      "submit_buyout_offer"
    );
    expect(mapEventNameToInstructionName("S1TokenBought")).to.equal("buy_s1_token");
    expect(mapEventNameToInstructionName("S1TokenSold")).to.equal("sell_s1_token");
    expect(mapEventNameToInstructionName("S1RageQuit")).to.equal("rage_quit_s1");
    expect(mapEventNameToInstructionName("ProtocolS1EmissionUpdated")).to.equal(
      "update_protocol_s1_emission"
    );
    expect(mapEventNameToInstructionName("S1Graduated")).to.equal("execute_s1_graduation");
    expect(mapEventNameToInstructionName("S1BuyoutUsdcClaimed")).to.equal(
      "claim_s1_buyout_usdc"
    );
    expect(mapEventNameToInstructionName("S1BuyoutResidualSwept")).to.equal(
      "sweep_s1_buyout_residual"
    );
    expect(mapEventNameToInstructionName("S1BuyoutAborted")).to.equal("abort_s1_buyout");
    expect(mapEventNameToInstructionName("Track2Settled")).to.equal("settle_track2");
    expect(mapEventNameToInstructionName("UnknownEvent")).to.equal(null);
  });

  it("prefers Anchor event payloads and keeps unmatched instructions as fallback", () => {
    const merged = mergeAnchorEventsWithInstructions({
      events: [
        {
          eventName: "ProposalFunded",
          instructionName: "sponsor_fund",
          proposalPda: "proposal_pda",
          entityPda: "proposal_pda",
          payload: {
            proposal: "proposal_pda",
            sponsor: "sponsor_wallet",
            status: 1,
          },
        },
      ],
      instructions: [
        {
          instructionIndex: 0,
          instructionName: "create_proposal",
          proposalPda: "proposal_pda",
          entityPda: "proposal_pda",
          payload: {
            args: {
              deadline: "1",
            },
            accounts: {
              proposal: "proposal_pda",
            },
          },
        },
        {
          instructionIndex: 1,
          instructionName: "sponsor_fund",
          proposalPda: "proposal_pda",
          entityPda: "proposal_pda",
          payload: {
            args: {
              track1Amount: "10",
            },
            accounts: {
              proposal: "proposal_pda",
            },
          },
        },
      ],
    });

    expect(merged).to.have.length(2);
    expect(merged[0].instructionName).to.equal("create_proposal");
    expect(merged[1].payload.source).to.equal("anchor_event");
    expect(merged[1].payload.eventName).to.equal("ProposalFunded");
  });

  it("manual transaction ingest does not advance the indexer cursor", async () => {
    const originalAnchor = AnchorService.getInstance;
    const originalIndexerCursor = (prisma as any).indexerCursor;
    let cursorWrites = 0;

    (AnchorService as any).getInstance = () => ({
      program: {
        idl: {
          instructions: [],
        },
      },
    });
    (prisma as any).indexerCursor = {
      upsert: async () => {
        cursorWrites += 1;
      },
    };

    try {
      const result = await ingestConfirmedProgramTransaction("sig-no-cursor", {
        connection: {
          getParsedTransaction: async () => ({
            slot: 456,
            meta: {
              err: null,
              logMessages: [],
            },
            transaction: {
              message: {
                instructions: [],
              },
            },
          }),
        } as any,
        targetProgram: Keypair.generate().publicKey,
        updateCursor: false,
        attemptStore: {
          start: async () => undefined,
          finish: async () => undefined,
        },
      });

      expect(result.status).to.equal("NO_PROGRAM_INSTRUCTIONS");
      expect(cursorWrites).to.equal(0);
    } finally {
      (AnchorService as any).getInstance = originalAnchor;
      (prisma as any).indexerCursor = originalIndexerCursor;
    }
  });

  it("keeps all signatures from the cursor slot and deduplicates replay safely", () => {
    const pending = selectBackfillSignatures(
      [
        { signature: "same-a", slot: 100 },
        { signature: "same-b", slot: 100 },
        { signature: "same-a", slot: 100 },
        { signature: "newer", slot: 101 },
        { signature: "older", slot: 99 },
      ],
      { lastSeenSlot: 100n, lastSeenSignature: "same-a" }
    );

    expect(pending.map((entry) => entry.signature)).to.deep.equal([
      "same-a",
      "same-b",
      "newer",
    ]);
  });

  it("does not advance the cursor on NOT_FOUND and later syncs the same signature", async () => {
    const originalIndexerCursor = (prisma as any).indexerCursor;
    let cursorWrites = 0;
    const statuses: string[] = [];
    let available = false;
    (prisma as any).indexerCursor = {
      upsert: async () => {
        cursorWrites += 1;
      },
    };
    const connection = {
      getParsedTransaction: async () =>
        available
          ? {
              slot: 200,
              meta: { err: null, logMessages: [] },
              transaction: { message: { instructions: [] } },
            }
          : null,
      getSignatureStatuses: async () => ({ value: [{ slot: 200 }] }),
    } as any;
    const attemptStore = {
      start: async () => undefined,
      finish: async ({ status }: any) => {
        statuses.push(status);
      },
    };

    try {
      const missing = await ingestConfirmedProgramTransaction("late-signature", {
        connection,
        targetProgram: Keypair.generate().publicKey,
        updateCursor: true,
        fetchMaxRetries: 1,
        fetchRetryDelayMs: 0,
        attemptStore,
        decodeInstructions: () => [],
        parseEvents: () => [],
      });
      expect(missing.status).to.equal("NOT_FOUND");
      expect(cursorWrites).to.equal(0);

      available = true;
      const synced = await ingestConfirmedProgramTransaction("late-signature", {
        connection,
        targetProgram: Keypair.generate().publicKey,
        updateCursor: true,
        fetchMaxRetries: 1,
        fetchRetryDelayMs: 0,
        attemptStore,
        decodeInstructions: () => [],
        parseEvents: () => [],
      });
      expect(synced.status).to.equal("NO_PROGRAM_INSTRUCTIONS");
      expect(cursorWrites).to.equal(1);
      expect(statuses).to.deep.equal(["NOT_FOUND", "NO_PROGRAM_INSTRUCTIONS"]);
    } finally {
      (prisma as any).indexerCursor = originalIndexerCursor;
    }
  });

  it("breaks ordered backfill on retryable NOT_FOUND before the terminal threshold", async () => {
    const processed: string[] = [];
    await processOrderedBackfill({
      entries: [{ signature: "missing" }, { signature: "later" }],
      processEntry: async (entry) => {
        processed.push(entry.signature);
        return {
          signature: entry.signature,
          slot: "1",
          status: entry.signature === "missing" ? "NOT_FOUND" : "SYNCED",
          instructionCount: 0,
        };
      },
    });

    expect(processed).to.deep.equal(["missing"]);
  });

  it("marks bounded NOT_FOUND as PRUNED and continues to a later signature", async () => {
    const processed: string[] = [];
    const finishedStatuses: string[] = [];
    const connection = {
      getParsedTransaction: async () => null,
      getSignatureStatuses: async () => ({ value: [{ slot: 400 }] }),
    } as any;

    await processOrderedBackfill({
      entries: [{ signature: "pruned" }, { signature: "later" }],
      processEntry: async (entry) => {
        processed.push(entry.signature);
        if (entry.signature === "later") {
          return {
            signature: entry.signature,
            slot: "401",
            status: "SYNCED",
            instructionCount: 1,
          };
        }
        return ingestConfirmedProgramTransaction(entry.signature, {
          connection,
          targetProgram: Keypair.generate().publicKey,
          slot: 400n,
          fetchMaxRetries: 1,
          fetchRetryDelayMs: 0,
          attemptStore: {
            start: async () => INDEXER_NOT_FOUND_TERMINAL_ATTEMPTS,
            finish: async ({ status }) => {
              finishedStatuses.push(status);
            },
          },
        });
      },
    });

    expect(processed).to.deep.equal(["pruned", "later"]);
    expect(finishedStatuses).to.deep.equal(["PRUNED"]);
  });

  it("allows an operator replay to reset a PRUNED attempt and finish SYNCED", async () => {
    const transitions = ["PRUNED"];
    const result = await ingestConfirmedProgramTransaction("operator-replay", {
      connection: {
        getParsedTransaction: async () => ({
          slot: 500,
          meta: { err: null, logMessages: [] },
          transaction: { message: { instructions: [] } },
        }),
      } as any,
      targetProgram: Keypair.generate().publicKey,
      updateCursor: false,
      attemptStore: {
        start: async () => {
          transitions.push("PROCESSING");
          return INDEXER_NOT_FOUND_TERMINAL_ATTEMPTS + 1;
        },
        finish: async ({ status }) => {
          transitions.push(status);
        },
      },
      decodeInstructions: () => [
        {
          instructionIndex: 0,
          instructionName: "register_user",
          proposalPda: null,
          entityPda: null,
          payload: {},
        },
      ],
      parseEvents: () => [],
      persistInstructions: async () => 1,
    });

    expect(result.status).to.equal("SYNCED");
    expect(transitions).to.deep.equal(["PRUNED", "PROCESSING", "SYNCED"]);
  });

  it("requires a server slot notification before indexer startup can be healthy", async () => {
    let slotCallback: (() => void) | undefined;
    let removed = 0;
    const heartbeatPromise = waitForInitialIndexerSlot(
      {
        onSlotChange(callback) {
          slotCallback = callback;
          return 77;
        },
        async removeSlotChangeListener() {
          removed += 1;
        },
      },
      { timeoutMs: 100 }
    );

    slotCallback?.();
    const heartbeat = await heartbeatPromise;
    expect(heartbeat.subscriptionId).to.equal(77);
    expect(heartbeat.lastNotificationAt()).to.be.greaterThan(0);
    expect(removed).to.equal(0);
  });

  it("marks runtime unhealthy on stale websocket heartbeat or RPC probe failure and stops its timer", async () => {
    let now = 100;
    let lastNotificationAt = 100;
    let probeFails = false;
    let unhealthyCalls = 0;
    let healthyCalls = 0;
    let clearedTimers = 0;
    const monitor = createIndexerHealthMonitor({
      probeSlot: async () => {
        if (probeFails) throw new Error("rpc unavailable");
        return 123;
      },
      lastSlotNotificationAt: () => lastNotificationAt,
      onUnhealthy: () => {
        unhealthyCalls += 1;
      },
      onHealthy: () => {
        healthyCalls += 1;
      },
      now: () => now,
      staleMs: 50,
      setIntervalFn: () => ({ unref() {} } as any),
      clearIntervalFn: () => {
        clearedTimers += 1;
      },
    });

    expect(await monitor.probeNow()).to.equal(true);
    now = 151;
    expect(await monitor.probeNow()).to.equal(false);
    probeFails = true;
    lastNotificationAt = now;
    expect(await monitor.probeNow()).to.equal(false);
    expect(unhealthyCalls).to.equal(1);
    expect(healthyCalls).to.equal(0);
    probeFails = false;
    expect(await monitor.probeNow()).to.equal(true);
    expect(healthyCalls).to.equal(1);
    expect(await monitor.probeNow()).to.equal(true);
    expect(healthyCalls).to.equal(1);
    monitor.stop();
    monitor.stop();
    expect(clearedTimers).to.equal(1);
  });

  it("records a projection error and replays the same transaction successfully", async () => {
    const originalIndexerCursor = (prisma as any).indexerCursor;
    let cursorWrites = 0;
    let persistAttempts = 0;
    const statuses: string[] = [];
    (prisma as any).indexerCursor = {
      upsert: async () => {
        cursorWrites += 1;
      },
    };
    const connection = {
      getParsedTransaction: async () => ({
        slot: 300,
        meta: { err: null, logMessages: [] },
        transaction: { message: { instructions: [] } },
      }),
    } as any;
    const decoded = [{
      instructionIndex: 0,
      instructionName: "sponsor_fund",
      proposalPda: Keypair.generate().publicKey.toBase58(),
      entityPda: null,
      payload: {},
    }];
    const options: any = {
      connection,
      targetProgram: Keypair.generate().publicKey,
      updateCursor: true,
      attemptStore: {
        start: async () => undefined,
        finish: async ({ status }: any) => {
          statuses.push(status);
        },
      },
      decodeInstructions: () => decoded,
      parseEvents: () => [],
      persistInstructions: async () => {
        persistAttempts += 1;
        if (persistAttempts === 1) throw new Error("projection unavailable");
        return 1;
      },
    };

    try {
      let firstError: unknown;
      try {
        await ingestConfirmedProgramTransaction("projection-replay", options);
      } catch (error) {
        firstError = error;
      }
      expect(firstError).to.be.instanceOf(Error);
      expect(cursorWrites).to.equal(0);

      const replayed = await ingestConfirmedProgramTransaction("projection-replay", options);
      expect(replayed.status).to.equal("SYNCED");
      expect(replayed.instructionCount).to.equal(1);
      expect(cursorWrites).to.equal(1);
      expect(statuses).to.deep.equal(["ERROR", "SYNCED"]);
    } finally {
      (prisma as any).indexerCursor = originalIndexerCursor;
    }
  });
});
