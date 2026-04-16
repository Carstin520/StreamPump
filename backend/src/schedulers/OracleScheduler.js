"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOracleScheduler = exports.oracleScheduler = exports.OracleScheduler = void 0;
/**
 * CN: Oracle 定时调度器，负责按 Track1/2/3 拉取数据库候选项并触发链上结算。
 * EN: Oracle scheduler that scans DB candidates by Track1/2/3 and triggers on-chain settlement flows.
 */
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
const web3_js_1 = require("@solana/web3.js");
const AnchorService_1 = require("../services/AnchorService");
const prisma_1 = require("../services/prisma");
const TRACK1_CRON = process.env.ORACLE_TRACK1_CRON ?? "0 * * * *";
const TRACK2_CRON = process.env.ORACLE_TRACK2_CRON ?? "15 2 * * *";
const TRACK3_CRON = process.env.ORACLE_TRACK3_CRON ?? "45 2 * * *";
const WORKER_BATCH_SIZE = Number(process.env.ORACLE_WORKER_BATCH_SIZE ?? 200);
const asErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const toDateFromUnixSeconds = (unixSeconds) => {
    if (unixSeconds <= 0n) {
        return null;
    }
    const timestamp = Number(unixSeconds);
    if (!Number.isFinite(timestamp)) {
        return null;
    }
    return new Date(timestamp * 1000);
};
const isTrack2SettledOnChain = (state) => state.track2SettledAtUnix > 0n;
const isTrack3SettledOnChain = (state) => state.track3SettledAtUnix > 0n;
class OracleScheduler {
    tasks = [];
    running = {
        track1: false,
        track2: false,
        track3: false,
    };
    started = false;
    start() {
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
    stop() {
        for (const task of this.tasks) {
            task.stop();
        }
        this.tasks.length = 0;
        this.started = false;
    }
    scheduleWorker(workerName, expression, lockKey, run) {
        const task = node_cron_1.default.schedule(expression, () => {
            // Each worker is serialized by runWithLock to prevent duplicate settlement attempts on the same process.
            void this.runWithLock(lockKey, run);
        });
        this.tasks.push(task);
        console.log(`[oracle] ${workerName} scheduled with cron "${expression}"`);
    }
    async runWithLock(workerKey, run) {
        if (this.running[workerKey]) {
            console.log(`[oracle] ${workerKey} skipped because previous run is still active`);
            return;
        }
        this.running[workerKey] = true;
        try {
            await run();
        }
        catch (error) {
            console.error(`[oracle] ${workerKey} worker crashed`, error);
        }
        finally {
            this.running[workerKey] = false;
        }
    }
    // Track1Worker: hourly funded proposals, base not claimed, and off-chain published verification complete.
    async runTrack1Worker() {
        const proposals = await prisma_1.prisma.proposal.findMany({
            where: {
                status: client_1.ProposalStatus.FUNDED,
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
    async runTrack2Worker() {
        const now = new Date();
        const proposals = await prisma_1.prisma.proposal.findMany({
            where: {
                status: client_1.ProposalStatus.FUNDED,
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
    async runTrack3Worker() {
        const now = new Date();
        const candidates = await prisma_1.prisma.proposal.findMany({
            where: {
                track3SettledAt: null,
                status: {
                    in: [
                        client_1.ProposalStatus.FUNDED,
                        client_1.ProposalStatus.RESOLVED_SUCCESS,
                        client_1.ProposalStatus.RESOLVED_FAIL,
                    ],
                },
            },
            orderBy: {
                deadlineAt: "asc",
            },
            take: WORKER_BATCH_SIZE,
        });
        const due = candidates.filter((proposal) => {
            const dueAtMs = proposal.deadlineAt.getTime() + proposal.track3DelayDays * 24 * 60 * 60 * 1000;
            return now.getTime() >= dueAtMs;
        });
        for (const proposal of due) {
            await this.processTrack3(proposal);
        }
    }
    async processTrack1(proposal) {
        try {
            const proposalPda = new web3_js_1.PublicKey(proposal.proposalPda);
            const onChain = await this.syncFromChain(proposal, proposalPda);
            if (onChain?.track1Claimed) {
                return;
            }
            if (await this.shouldSkipForPendingSignature(proposal)) {
                return;
            }
            const signature = await (0, AnchorService_1.getAnchorService)().executeSettleTrack1Base(proposalPda);
            await prisma_1.prisma.proposal.update({
                where: { id: proposal.id },
                data: {
                    track1Claimed: true,
                    onChainTxSignature: signature,
                    oracleSyncStatus: client_1.OracleSyncStatus.SYNCED,
                    oracleLastError: null,
                },
            });
        }
        catch (error) {
            await this.markOracleFailure(proposal.id, error);
            console.error(`[oracle][track1] proposal ${proposal.id} failed`, error);
        }
    }
    async processTrack2(proposal) {
        try {
            const proposalPda = new web3_js_1.PublicKey(proposal.proposalPda);
            const onChain = await this.syncFromChain(proposal, proposalPda);
            if (onChain && isTrack2SettledOnChain(onChain)) {
                return;
            }
            if (await this.shouldSkipForPendingSignature(proposal)) {
                return;
            }
            const actualValue = await this.aggregateTrack2ActualValue(proposal.id, proposal.track2MetricType);
            const signature = await (0, AnchorService_1.getAnchorService)().executeSettleTrack2(proposalPda, actualValue);
            await prisma_1.prisma.proposal.update({
                where: { id: proposal.id },
                data: {
                    track2ActualValue: BigInt(actualValue),
                    track2SettledAt: new Date(),
                    onChainTxSignature: signature,
                    oracleSyncStatus: client_1.OracleSyncStatus.SYNCED,
                    oracleLastError: null,
                },
            });
        }
        catch (error) {
            await this.markOracleFailure(proposal.id, error);
            console.error(`[oracle][track2] proposal ${proposal.id} failed`, error);
        }
    }
    async processTrack3(proposal) {
        try {
            const proposalPda = new web3_js_1.PublicKey(proposal.proposalPda);
            const onChain = await this.syncFromChain(proposal, proposalPda);
            if (onChain && isTrack3SettledOnChain(onChain)) {
                return;
            }
            if (await this.shouldSkipForPendingSignature(proposal)) {
                return;
            }
            const approvedCpsPayout = await this.fetchApprovedCpsPayoutStub(proposal);
            const signature = await (0, AnchorService_1.getAnchorService)().executeSettleTrack3Cps(proposalPda, approvedCpsPayout);
            await prisma_1.prisma.proposal.update({
                where: { id: proposal.id },
                data: {
                    track3CpsPayout: BigInt(approvedCpsPayout),
                    track3SettledAt: new Date(),
                    onChainTxSignature: signature,
                    oracleSyncStatus: client_1.OracleSyncStatus.SYNCED,
                    oracleLastError: null,
                },
            });
        }
        catch (error) {
            await this.markOracleFailure(proposal.id, error);
            console.error(`[oracle][track3] proposal ${proposal.id} failed`, error);
        }
    }
    async syncFromChain(proposal, proposalPda) {
        const onChain = await (0, AnchorService_1.getAnchorService)().fetchProposalState(proposalPda);
        if (!onChain) {
            return null;
        }
        // DB proposal rows are treated as a cache/projection here; on-chain state wins whenever it is newer.
        const updates = {};
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
            updates.oracleSyncStatus = client_1.OracleSyncStatus.SYNCED;
            updates.oracleLastError = null;
            await prisma_1.prisma.proposal.update({
                where: { id: proposal.id },
                data: updates,
            });
        }
        return onChain;
    }
    async shouldSkipForPendingSignature(proposal) {
        if (!proposal.onChainTxSignature) {
            return false;
        }
        try {
            const state = await (0, AnchorService_1.getAnchorService)().getSignatureState(proposal.onChainTxSignature);
            if (state === "PENDING") {
                console.log(`[oracle] proposal ${proposal.id} skipped due to pending tx ${proposal.onChainTxSignature}`);
                return true;
            }
        }
        catch (error) {
            console.warn(`[oracle] signature state check failed for proposal ${proposal.id}: ${asErrorMessage(error)}`);
        }
        return false;
    }
    async aggregateTrack2ActualValue(proposalId, metricType) {
        // Only accepted events contribute to the metric that is finally settled on-chain.
        const count = await prisma_1.prisma.track2Event.count({
            where: {
                proposalId,
                eventType: metricType,
                fraudStatus: {
                    in: [client_1.FraudStatus.ACCEPTED],
                },
            },
        });
        return count;
    }
    // TODO: replace this stub with Shopify/Amazon reconciliation APIs.
    async fetchApprovedCpsPayoutStub(proposal) {
        const source = proposal.track3CpsPayout ?? proposal.track3UsdcDeposited;
        if (source > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error("approvedCpsPayout exceeds JavaScript safe integer range");
        }
        return Number(source);
    }
    async markOracleFailure(proposalId, error) {
        await prisma_1.prisma.proposal.update({
            where: { id: proposalId },
            data: {
                oracleSyncStatus: client_1.OracleSyncStatus.FAILED,
                oracleLastError: asErrorMessage(error).slice(0, 500),
            },
        });
    }
}
exports.OracleScheduler = OracleScheduler;
exports.oracleScheduler = new OracleScheduler();
const startOracleScheduler = () => {
    if (process.env.ORACLE_SCHEDULER_ENABLED === "false") {
        console.log("[oracle] scheduler disabled by ORACLE_SCHEDULER_ENABLED=false");
        return;
    }
    exports.oracleScheduler.start();
};
exports.startOracleScheduler = startOracleScheduler;
