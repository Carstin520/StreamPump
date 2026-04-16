CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE', 'APPLE', 'EMAIL', 'PASSKEY');

CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "managedWalletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity"("provider", "providerSubject");
CREATE UNIQUE INDEX "AuthIdentity_managedWalletAddress_key" ON "AuthIdentity"("managedWalletAddress");
CREATE INDEX "AuthIdentity_managedWalletAddress_idx" ON "AuthIdentity"("managedWalletAddress");
