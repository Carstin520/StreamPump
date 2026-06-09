-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('FAN', 'CREATOR', 'SPONSOR');

-- CreateTable
CREATE TABLE "AccountProfile" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'FAN',
    "displayName" TEXT,
    "handle" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountProfile_wallet_key" ON "AccountProfile"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "AccountProfile_handle_key" ON "AccountProfile"("handle");

-- CreateIndex
CREATE INDEX "AccountProfile_role_onboardingCompletedAt_idx" ON "AccountProfile"("role", "onboardingCompletedAt");
