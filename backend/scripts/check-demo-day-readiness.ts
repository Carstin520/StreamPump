import { ManagedWalletJobStatus, ManagedWalletPoolStatus, WalletType } from "@prisma/client";

import "../config/loadEnv";

const normalizeDatabaseUrl = (): void => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.searchParams.set("connection_limit", databaseUrl.searchParams.get("connection_limit") ?? "5");
  databaseUrl.searchParams.set("pool_timeout", databaseUrl.searchParams.get("pool_timeout") ?? "10");
  process.env.DATABASE_URL = databaseUrl.toString();
};

normalizeDatabaseUrl();

import { prisma } from "../src/services/prisma";

const main = async (): Promise<void> => {
  const walletPool = await Promise.all(
    Object.values(ManagedWalletPoolStatus).map(async (poolStatus) => ({
      poolStatus,
      count: await prisma.accountWallet.count({
        where: {
          walletType: WalletType.MANAGED,
          poolStatus,
        },
      }),
    }))
  );

  const unavailablePoolWallets = await prisma.accountWallet.count({
    where: {
      walletType: WalletType.MANAGED,
      poolStatus: {
        not: null,
      },
      encryptedSecretKey: null,
    },
  });

  const [assignedWithoutIdentityRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "AccountWallet" wallet
    LEFT JOIN "AuthIdentity" identity
      ON identity."managedWalletAddress" = wallet."walletAddress"
    WHERE wallet."walletType" = 'MANAGED'
      AND wallet."poolStatus" = 'ASSIGNED'
      AND identity."id" IS NULL
  `;

  const recentJobs = await Promise.all(
    Object.values(ManagedWalletJobStatus).map(async (status) => ({
      status,
      count: await prisma.managedWalletExecutionJob.count({
        where: {
          status,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    }))
  );

  const [jobLatency] = await prisma.$queryRaw<
    {
      p95_ms: number | null;
      p99_ms: number | null;
    }[]
  >`
    SELECT
      percentile_cont(0.95) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM ("finishedAt" - "queuedAt")) * 1000
      ) AS p95_ms,
      percentile_cont(0.99) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM ("finishedAt" - "queuedAt")) * 1000
      ) AS p99_ms
    FROM "ManagedWalletExecutionJob"
    WHERE "finishedAt" IS NOT NULL
      AND "createdAt" >= NOW() - INTERVAL '24 hours'
  `;

  console.log(
    JSON.stringify(
      {
        walletPool,
        unavailablePoolWallets,
        assignedWithoutIdentity: Number(assignedWithoutIdentityRow?.count ?? 0n),
        recentJobs,
        recentJobLatencyMs: {
          p95: jobLatency?.p95_ms ?? null,
          p99: jobLatency?.p99_ms ?? null,
        },
        passHints: {
          availableWallets: ">=150 before demo",
          unavailablePoolWallets: "must be 0",
          assignedWithoutIdentity: "must be 0",
          jobSuccessRate: ">=98% in k6 run",
          recentJobLatencyMs: "p95 <15000 and p99 <30000",
        },
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
