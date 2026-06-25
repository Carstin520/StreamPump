import {
  ManagedWalletExecutionJob,
  ManagedWalletJobStatus,
  ManagedWalletPoolStatus,
  Prisma,
} from "@prisma/client";

import { config } from "../../config/default";
import { HttpError } from "../controllers/http";
import { executeManagedWalletActionForSession } from "./managedWalletExecution";
import { prisma } from "./prisma";
import { assertRateLimit } from "./rateLimiter";

const normalizeJobParams = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const startOfUtcDay = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const toApiJobStatus = (
  status: ManagedWalletJobStatus
): "queued" | "running" | "succeeded" | "failed" => {
  switch (status) {
    case ManagedWalletJobStatus.QUEUED:
      return "queued";
    case ManagedWalletJobStatus.RUNNING:
      return "running";
    case ManagedWalletJobStatus.SUCCEEDED:
      return "succeeded";
    case ManagedWalletJobStatus.FAILED:
      return "failed";
  }
};

export const enqueueManagedWalletExecutionJob = async (params: {
  wallet: string;
  sessionId?: string | null;
  idempotencyKey: string;
  action: unknown;
  jobParams: unknown;
  ip: string;
}): Promise<ManagedWalletExecutionJob> => {
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) {
    throw new HttpError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "x-idempotency-key is required and must be at most 160 chars"
    );
  }

  const action = String(params.action ?? "").trim();
  if (!action || action.length > 80) {
    throw new HttpError(400, "INVALID_INPUT", "action is required and must be at most 80 chars");
  }

  const existing = await prisma.managedWalletExecutionJob.findUnique({
    where: {
      wallet_idempotencyKey: {
        wallet: params.wallet,
        idempotencyKey,
      },
    },
  });
  if (existing) {
    return existing;
  }

  assertRateLimit({
    key: `managed-execute-ip:${params.ip}`,
    limit: config.managedWallet.executeIpLimit,
    windowMs: config.managedWallet.executeIpWindowMs,
    code: "MANAGED_EXECUTE_IP_RATE_LIMITED",
    message: "too many managed wallet execute attempts from this IP",
  });
  assertRateLimit({
    key: `managed-execute-wallet:${params.wallet}`,
    limit: config.managedWallet.executeWalletLimit,
    windowMs: config.managedWallet.executeWalletWindowMs,
    code: "MANAGED_EXECUTE_WALLET_RATE_LIMITED",
    message: "too many managed wallet execute attempts for this wallet",
  });

  const dayJobCount = await prisma.managedWalletExecutionJob.count({
    where: {
      wallet: params.wallet,
      createdAt: {
        gte: startOfUtcDay(),
      },
      status: {
        not: ManagedWalletJobStatus.FAILED,
      },
    },
  });
  if (dayJobCount >= config.managedWallet.maxJobsPerWalletPerDay) {
    throw new HttpError(
      429,
      "MANAGED_WALLET_DAILY_QUOTA_EXCEEDED",
      "managed wallet daily demo transaction quota exceeded"
    );
  }

  try {
    const job = await prisma.managedWalletExecutionJob.create({
      data: {
        wallet: params.wallet,
        sessionId: params.sessionId ?? null,
        idempotencyKey,
        action,
        params: normalizeJobParams(params.jobParams),
      },
    });
    kickManagedWalletJobWorker();
    return job;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.managedWalletExecutionJob.findUnique({
        where: {
          wallet_idempotencyKey: {
            wallet: params.wallet,
            idempotencyKey,
          },
        },
      });
      if (duplicate) {
        return duplicate;
      }
    }

    throw error;
  }
};

export const getManagedWalletExecutionJobForWallet = async (params: {
  wallet: string;
  jobId: string;
}): Promise<ManagedWalletExecutionJob | null> =>
  prisma.managedWalletExecutionJob.findFirst({
    where: {
      id: params.jobId,
      wallet: params.wallet,
    },
  });

let workerStarted = false;
let activeWorkers = 0;
let draining = false;

const claimQueuedJob = async (): Promise<ManagedWalletExecutionJob | null> =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "ManagedWalletExecutionJob"
      WHERE "status"::text = ${ManagedWalletJobStatus.QUEUED}
      ORDER BY "queuedAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    const row = rows[0];
    if (!row) {
      return null;
    }

    return tx.managedWalletExecutionJob.update({
      where: { id: row.id },
      data: {
        status: ManagedWalletJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: {
          increment: 1,
        },
        errorCode: null,
        errorMessage: null,
      },
    });
  });

const markWalletUsed = async (wallet: string): Promise<void> => {
  await prisma.accountWallet.updateMany({
    where: {
      walletAddress: wallet,
      poolStatus: ManagedWalletPoolStatus.ASSIGNED,
    },
    data: {
      poolStatus: ManagedWalletPoolStatus.USED,
      poolUsedAt: new Date(),
    },
  });
};

const processJob = async (job: ManagedWalletExecutionJob): Promise<void> => {
  try {
    const result = await executeManagedWalletActionForSession({
      userWallet: job.wallet,
      action: job.action,
      rawParams: job.params,
      syncProjection: config.managedWallet.syncProjectionOnJobSuccess,
    });

    await prisma.managedWalletExecutionJob.update({
      where: { id: job.id },
      data: {
        status: ManagedWalletJobStatus.SUCCEEDED,
        signature: result.signature,
        projectionSync: result.projectionSync
          ? (result.projectionSync as Prisma.InputJsonValue)
          : undefined,
        finishedAt: new Date(),
      },
    });
    await markWalletUsed(job.wallet);
  } catch (error) {
    const code = error instanceof HttpError ? error.code : "MANAGED_WALLET_JOB_FAILED";
    const message = error instanceof Error ? error.message : String(error);
    await prisma.managedWalletExecutionJob.update({
      where: { id: job.id },
      data: {
        status: ManagedWalletJobStatus.FAILED,
        errorCode: code,
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
  }
};

const drainJobs = async (): Promise<void> => {
  if (draining) {
    return;
  }

  draining = true;
  try {
    const concurrency = Math.max(1, Math.min(25, config.managedWallet.jobWorkerConcurrency));
    while (activeWorkers < concurrency) {
      const job = await claimQueuedJob();
      if (!job) {
        break;
      }

      activeWorkers += 1;
      void processJob(job).finally(() => {
        activeWorkers -= 1;
        kickManagedWalletJobWorker();
      });
    }
  } finally {
    draining = false;
  }
};

export const kickManagedWalletJobWorker = (): void => {
  void drainJobs().catch((error) => {
    console.error(
      "[managed-wallet-jobs] worker drain failed",
      error instanceof Error ? error.message : error
    );
  });
};

export const startManagedWalletJobWorker = (): void => {
  if (workerStarted) {
    return;
  }

  workerStarted = true;
  const pollMs = Math.max(250, config.managedWallet.jobWorkerPollMs);
  const timer = setInterval(kickManagedWalletJobWorker, pollMs);
  timer.unref?.();
  kickManagedWalletJobWorker();
};
