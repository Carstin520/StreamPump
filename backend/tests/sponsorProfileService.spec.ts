import { expect } from "chai";
import {
  AccountRole,
  SponsorType,
  SponsorVerificationStatus,
} from "@prisma/client";
import { Keypair } from "@solana/web3.js";

import { prisma } from "../src/services/prisma";
import {
  listPendingSponsorProfiles,
  reviewSponsorProfile,
  submitSponsorProfile,
} from "../src/services/sponsorProfile";

type SponsorProfileRecord = {
  id: string;
  wallet: string;
  companyName: string;
  sponsorType: SponsorType;
  registrationNumber: string;
  businessLicenseKey: string;
  legalRepresentative: string;
  contactPhone: string;
  contactEmail: string;
  powerOfAttorneyKey: string | null;
  status: SponsorVerificationStatus;
  rejectReason: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const installMockSponsorPrisma = () => {
  const sponsors = new Map<string, SponsorProfileRecord>();
  const accountRoles = new Map<string, AccountRole>();
  let sponsorCounter = 0;

  const prismaAny = prisma as any;
  const original = {
    sponsorProfile: {
      upsert: prisma.sponsorProfile.upsert,
      findMany: prisma.sponsorProfile.findMany,
      update: prisma.sponsorProfile.update,
    },
    accountProfile: {
      upsert: prisma.accountProfile.upsert,
    },
  };

  prismaAny.sponsorProfile.upsert = async ({
    where,
    update,
    create,
  }: {
    where: { wallet: string };
    update: Partial<SponsorProfileRecord>;
    create: Omit<SponsorProfileRecord, "id" | "createdAt" | "updatedAt" | "rejectReason" | "approvedAt">;
  }) => {
    const now = new Date();
    const current = sponsors.get(where.wallet);
    if (current) {
      const updated = {
        ...current,
        ...update,
        updatedAt: now,
      } as SponsorProfileRecord;
      sponsors.set(where.wallet, updated);
      return updated;
    }

    sponsorCounter += 1;
    const record: SponsorProfileRecord = {
      id: `sponsor-${sponsorCounter}`,
      ...create,
      rejectReason: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    sponsors.set(record.wallet, record);
    return record;
  };

  prismaAny.sponsorProfile.findMany = async () =>
    Array.from(sponsors.values()).filter(
      (sponsor) => sponsor.status === SponsorVerificationStatus.PENDING_REVIEW
    );

  prismaAny.sponsorProfile.update = async ({
    where,
    data,
  }: {
    where: { id: string };
    data: Partial<SponsorProfileRecord>;
  }) => {
    const current = Array.from(sponsors.values()).find((sponsor) => sponsor.id === where.id);
    if (!current) {
      throw new Error(`sponsor ${where.id} not found`);
    }

    const updated = {
      ...current,
      ...data,
      updatedAt: new Date(),
    } as SponsorProfileRecord;
    sponsors.set(updated.wallet, updated);
    return updated;
  };

  prismaAny.accountProfile.upsert = async ({
    where,
    update,
    create,
  }: {
    where: { wallet: string };
    update: { role?: AccountRole };
    create: { wallet: string; role: AccountRole };
  }) => {
    accountRoles.set(where.wallet, update.role ?? create.role);
    return {
      id: `account-${where.wallet}`,
      wallet: where.wallet,
      role: accountRoles.get(where.wallet),
    };
  };

  return {
    sponsors,
    accountRoles,
    restore: () => {
      prismaAny.sponsorProfile.upsert = original.sponsorProfile.upsert;
      prismaAny.sponsorProfile.findMany = original.sponsorProfile.findMany;
      prismaAny.sponsorProfile.update = original.sponsorProfile.update;
      prismaAny.accountProfile.upsert = original.accountProfile.upsert;
    },
  };
};

describe("sponsor profile service", () => {
  let mock: ReturnType<typeof installMockSponsorPrisma> | null = null;

  beforeEach(() => {
    mock = installMockSponsorPrisma();
  });

  afterEach(() => {
    mock?.restore();
    mock = null;
  });

  it("submits KYB information as pending review and marks the account as SPONSOR", async () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const profile = await submitSponsorProfile({
      wallet,
      companyName: "Acme Brand Inc.",
      sponsorType: "BRAND",
      registrationNumber: "EIN-123456",
      businessLicenseKey: "sponsor-kyb/license.png",
      legalRepresentative: "Alex Chen",
      contactPhone: "+1-555-0100",
      contactEmail: "sponsor@example.com",
    });

    expect(profile.status).to.equal(SponsorVerificationStatus.PENDING_REVIEW);
    expect(profile.sponsorType).to.equal(SponsorType.BRAND);
    expect(mock?.accountRoles.get(wallet)).to.equal(AccountRole.SPONSOR);

    const pending = await listPendingSponsorProfiles();
    expect(pending.map((item) => item.wallet)).to.deep.equal([wallet]);
  });

  it("approves a pending sponsor profile", async () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const profile = await submitSponsorProfile({
      wallet,
      companyName: "Acme Brand Inc.",
      sponsorType: "AGENCY",
      registrationNumber: "EIN-123456",
      businessLicenseKey: "sponsor-kyb/license.png",
      legalRepresentative: "Alex Chen",
      contactPhone: "+1-555-0100",
      contactEmail: "sponsor@example.com",
    });

    const approved = await reviewSponsorProfile({
      id: profile.id,
      decision: "APPROVED",
    });

    expect(approved.status).to.equal(SponsorVerificationStatus.APPROVED);
    expect(approved.approvedAt).to.be.instanceOf(Date);
    expect(approved.rejectReason).to.equal(null);
  });
});
