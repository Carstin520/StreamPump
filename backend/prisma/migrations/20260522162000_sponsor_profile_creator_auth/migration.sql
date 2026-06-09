ALTER TYPE "IdentityProvider" ADD VALUE 'TWITTER';

CREATE TYPE "SponsorVerificationStatus" AS ENUM ('UNSUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TYPE "SponsorType" AS ENUM ('BRAND', 'AGENCY', 'INDIVIDUAL');

CREATE TABLE "SponsorProfile" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "sponsorType" "SponsorType" NOT NULL DEFAULT 'BRAND',
    "registrationNumber" TEXT NOT NULL,
    "businessLicenseKey" TEXT NOT NULL,
    "legalRepresentative" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "powerOfAttorneyKey" TEXT,
    "status" "SponsorVerificationStatus" NOT NULL DEFAULT 'UNSUBMITTED',
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsorProfile_wallet_key" ON "SponsorProfile"("wallet");
CREATE INDEX "SponsorProfile_status_updatedAt_idx" ON "SponsorProfile"("status", "updatedAt");
CREATE INDEX "SponsorProfile_sponsorType_status_idx" ON "SponsorProfile"("sponsorType", "status");
