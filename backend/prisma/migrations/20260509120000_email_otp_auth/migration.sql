CREATE TABLE "EmailAuthChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailAuthChallenge_email_expiresAt_idx" ON "EmailAuthChallenge"("email", "expiresAt");
