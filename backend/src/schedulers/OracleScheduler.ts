import {
  FraudStatus,
  OracleSyncStatus,
  Prisma,
  Proposal,
  ProposalStatus,
} from "@prisma/client";
import cron, { ScheduledTask } from "node-cron";
import { PublicKey } from "@solana/web3.js";

import { getAnchorService, OnChainProposalState } from "../services/AnchorService";
import { prisma } from "../services/prisma";

const TRACK1_CRON = process.env.ORACLE_TRACK1_CRON ?? "0 * * * *";
const TRACK2_CRON = process.env.ORACLE_TRACK2_CRON ?? "15 2 * * *";
const TRACK3_CRON = process.env.ORACLE_TRACK3_CRON ?? "45 2 * * *";
const WORKER_BATCH_SIZE = Number(process.env.ORACLE_WORKER_BATCH_SIZE ?? 200);

type WorkerKey = "track1" | "track2" | "track3";

const asErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toDateFromUnixSeconds = (unixSeconds: bigint): Date | null => {
  if (unixSeconds <= 0n) {
    return null;
  }

  const timestamp = Number(unixSeconds);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000);
};

const isTrack2SettledOnChain = (state: OnChainProposalState): boolean =>
  state.track2SettledAtUnix > 0n;

const isTrack3SettledOnChain = (state: OnChainProposalState): boolean =>
  state.track3SettledAtUnix > 0n;

export class OracleScheduler {
  private readonly tasks: ScheduledTask[] = [];
  private readonly running: Record<WorkerKey, boolean> = {
    track1: false,
    track2: false,
    track3: false,
  };

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.scheduleWorker("Track1Worker", TRACK1_CRON, "track1", () => this.runTrack1Worker());
    this.scheduleWorker("Track2Worker", TRACK2_CRON, "track2", () => this.runTrack2Worker());
    this.scheduleWorker("Track3Worker", TRACK3_CRON, "track3", () => this.runTrack3Worker());

    if (process.env.ORACLE_RUN_ON_BOOT !== "false") {
      void this.runWithLock("track1", () => this.runTrack1Worker());
      void this.runWithLock("track2", () => this.runTrack2Worker());
      void this.runWithLock("track3", () => this.runTrack3Worker());
    }
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }

    this.tasks.length = 0;
    this.started = false;
  }

  private scheduleWorker(
    workerName: string,
    expression: string,
    lockKey: WorkerKey,
    run: () => Promise<void>
  ): void {
    const task = cron.schedule(expression, () => {
      void this.runWithLock(lockKey, run);
    });

    this.tasks.push(task);
    console.log(`[oracle] ${workerName} scheduled with cron "${expression}"`);
  }

  private async runWithLock(workerKey: WorkerKey, run: () => Promise<void>): Promise<void> {
    if (this.running[workerKey]) {
      console.log(`[oracle] ${workerKey} skipped because previous run is still active`);
      return;
    }

    this.running[workerKey] = true;
    try {
      await run();
    } catch (error) {
      console.error(`[oracle] ${workerKey} worker crashed`, error);
    } finally {
      this.running[workerKey] = false;
    }
  }

  // Track1Worker: hourly funded proposals, base not claimed, and off-chain published verification complete.
  private async runTrack1Worker(): Promise<void> {
    const proposals = await prisma.proposal.findMany({
      where: {
        status: ProposalStatus.FUNDED,
        track1Claimed: false,
        contentPublishedVerifiedAt: {
          not: null,
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: WORKER_BATCH_SIZE,
    });

    for (const proposal of proposals) {
      await this.processTrack1(proposal);
    }
  }

  // Track2Worker: daily funded proposals that crossed deadline and are not settled.
  private async runTrack2Worker(): Promise<void> {
    const now = new Date();
    const proposals = await prisma.proposal.findMany({
      where: {
        status: ProposalStatus.FUNDED,
        deadlineAt: {
          lte: now,
        },
        track2SettledAt: null,
      },
      orderBy: {
        deadlineAt: "asc",
      },
      take: WORKER_BATCH_SIZE,
    });

    for (const proposal of proposals) {
      await this.processTrack2(proposal);
    }
  }

  // Track3Worker: daily check for proposals that reached deadline + delay days and are still unsettled.
  private async runTrack3Worker(): Promise<void> {
    const now = new Date();
    const candidates = await prisma.proposal.findMany({
      where: {
        track3SettledAt: null,
        status: {
          in: [
            ProposalStatus.FUNDED,
            ProposalStatus.RESOLVED_SUCCESS,
            ProposalStatus.RESOLVED_FAIL,
          ],
        },
      },
      orderBy: {
        deadlineAt: "asc",
      },
      take: WORKER_BATCH_SIZE,
    });

    const due = candidates.filter((proposal: Proposal) => {
      const dueAtMs = proposal.deadlineAt.getTime() + proposal.track3DelayDays * 24 * 60 * 60 * 1000;
      return now.getTime() >= dueAtMs;
    });

    for (const proposal of due) {
      await this.processTrack3(proposal);
    }
  }

  private async processTrack1(proposal: Proposal): Promise<void> {
    try {
      const proposalPda = new PublicKey(proposal.proposalPda);
      const onChain = await this.syncFromChain(proposal, proposalPda);
      if (onChain?.track1Claimed) {
        return;
      }

      if (await this.shouldSkipForPendingSignature(proposal)) {
        return;
      }

      const signature = await getAnchorService().executeSettleTrack1Base(proposalPda);
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          track1Claimed: true,
          onChainTxSignature: signature,
          oracleSyncStatus: OracleSyncStatus.SYNCED,
          oracleLastError: null,
        },
      });
    } catch (error) {
      await this.markOracleFailure(proposal.id, error);
      console.error(`[oracle][track1] proposal ${proposal.id} failed`, error);
    }
  }

  private async processTrack2(proposal: Proposal): Promise<void> {
    try {
      const proposalPda = new PublicKey(proposal.proposalPda);
      const onChain = await this.syncFromChain(proposal, proposalPda);
      if (onChain && isTrack2SettledOnChain(onChain)) {
        return;
      }

      if (await this.shouldSkipForPendingSignature(proposal)) {
        return;
      }

      const actualValue = await this.aggregateTrack2ActualValue(proposal.id, proposal.track2MetricType);
      const signature = await getAnchorService().executeSettleTrack2(proposalPda, actualValue);

      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          track2ActualValue: BigInt(actualValue),
          track2SettledAt: new Date(),
          onChainTxSignature: signature,
          oracleSyncStatus: OracleSyncStatus.SYNCED,
          oracleLastError: null,
        },
      });
    } catch (error) {
      await this.markOracleFailure(proposal.id, error);
      console.error(`[oracle][track2] proposal ${proposal.id} failed`, error);
    }
  }

  private async processTrack3(proposal: Proposal): Promise<void> {
    try {
      const proposalPda = new PublicKey(proposal.proposalPda);
      const onChain = await this.syncFromChain(proposal, proposalPda);
      if (onChain && isTrack3SettledOnChain(onChain)) {
        return;
      }

      if (await this.shouldSkipForPendingSignature(proposal)) {
        return;
      }

      const approvedCpsPayout = await this.fetchApprovedCpsPayoutStub(proposal);
      const signature = await getAnchorService().executeSettleTrack3Cps(
        proposalPda,
        approvedCpsPayout
      );

      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          track3CpsPayout: BigInt(approvedCpsPayout),
          track3SettledAt: new Date(),
          onChainTxSignature: signature,
          oracleSyncStatus: OracleSyncStatus.SYNCED,
          oracleLastError: null,
        },
      });
    } catch (error) {
      await this.markOracleFailure(proposal.id, error);
      console.error(`[oracle][track3] proposal ${proposal.id} failed`, error);
    }
  }

  private async syncFromChain(
    proposal: Proposal,
    proposalPda: PublicKey
  ): Promise<OnChainProposalState | null> {
    const onChain = await getAnchorService().fetchProposalState(proposalPda);
    if (!onChain) {
      return null;
    }

    const updates: Prisma.ProposalUpdateInput = {};

    if (onChain.track1Claimed && !proposal.track1Claimed) {
      updates.track1Claimed = true;
    }

    const track2SettledAt = toDateFromUnixSeconds(onChain.track2SettledAtUnix);
    if (track2SettledAt && !proposal.track2SettledAt) {
      updates.track2SettledAt = track2SettledAt;
    }

    const track3SettledAt = toDateFromUnixSeconds(onChain.track3SettledAtUnix);
    if (track3SettledAt && !proposal.track3SettledAt) {
      updates.track3SettledAt = track3SettledAt;
    }

    if (Object.keys(updates).length > 0) {
      updates.oracleSyncStatus = OracleSyncStatus.SYNCED;
      updates.oracleLastError = null;
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: updates,
      });
    }

    return onChain;
  }

  private async shouldSkipForPendingSignature(proposal: Proposal): Promise<boolean> {
    if (!proposal.onChainTxSignature) {
      return false;
    }

    try {
      const state = await getAnchorService().getSignatureState(proposal.onChainTxSignature);
      if (state === "PENDING") {
        console.log(
          `[oracle] proposal ${proposal.id} skipped due to pending tx ${proposal.onChainTxSignature}`
        );
        return true;
      }
    } catch (error) {
      console.warn(
        `[oracle] signature state check failed for proposal ${proposal.id}: ${asErrorMessage(error)}`
      );
    }

    return false;
  }

  private async aggregateTrack2ActualValue(
    proposalId: string,
    metricType: Proposal["track2MetricType"]
  ): Promise<number> {
    const count = await prisma.track2Event.count({
      where: {
        proposalId,
        eventType: metricType,
        fraudStatus: {
          in: [FraudStatus.ACCEPTED],
        },
      },
    });

    return count;
  }

  // TODO: replace this stub with Shopify/Amazon reconciliation APIs.
  private async fetchApprovedCpsPayoutStub(proposal: Proposal): Promise<number> {
    const source = proposal.track3CpsPayout ?? proposal.track3UsdcDeposited;
    if (source > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("approvedCpsPayout exceeds JavaScript safe integer range");
    }

    return Number(source);
  }

  private async markOracleFailure(proposalId: string, error: unknown): Promise<void> {
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        oracleSyncStatus: OracleSyncStatus.FAILED,
        oracleLastError: asErrorMessage(error).slice(0, 500),
      },
    });
  }
}

export const oracleScheduler = new OracleScheduler();

export const startOracleScheduler = (): void => {
  if (process.env.ORACLE_SCHEDULER_ENABLED === "false") {
    console.log("[oracle] scheduler disabled by ORACLE_SCHEDULER_ENABLED=false");
    return;
  }

  oracleScheduler.start();
};
