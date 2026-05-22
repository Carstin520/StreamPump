/**
 * CN: Sponsor KYB 资料与审核服务。
 * EN: Sponsor KYB profile and operator review service.
 */
import { randomUUID } from "crypto";

import {
  AccountRole,
  SponsorType,
  SponsorVerificationStatus,
} from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import {
  assertAllowedMimeType,
  extensionForMimeType,
  r2Service,
} from "./R2Service";
import { prisma } from "./prisma";

const MAX_SPONSOR_DOCUMENT_BYTES = 12 * 1024 * 1024;

const normalizeWallet = (wallet: string): string => new PublicKey(wallet).toBase58();

const normalizeSponsorType = (value: string): SponsorType => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BRAND") return SponsorType.BRAND;
  if (normalized === "AGENCY") return SponsorType.AGENCY;
  if (normalized === "INDIVIDUAL") return SponsorType.INDIVIDUAL;
  throw new Error("sponsorType must be BRAND, AGENCY or INDIVIDUAL");
};

const normalizeEmail = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("contactEmail is invalid");
  }

  return normalized;
};

export const createSponsorDocumentUpload = async (params: {
  wallet: string;
  documentType: "BUSINESS_LICENSE" | "POWER_OF_ATTORNEY";
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}) => {
  const wallet = normalizeWallet(params.wallet);
  const documentType = params.documentType;
  const mimeType = params.mimeType.trim().toLowerCase();
  const fileSizeBytes = Math.floor(params.fileSizeBytes);

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("fileSizeBytes must be greater than 0");
  }

  if (fileSizeBytes > MAX_SPONSOR_DOCUMENT_BYTES) {
    throw new Error(`fileSizeBytes exceeds sponsor KYB document limit (${MAX_SPONSOR_DOCUMENT_BYTES} bytes)`);
  }

  assertAllowedMimeType(mimeType);
  if (!mimeType.startsWith("image/")) {
    throw new Error("sponsor KYB documents must be image uploads");
  }

  const extension = extensionForMimeType(mimeType);
  const storageKey = [
    "sponsor-kyb",
    wallet,
    `${Date.now()}-${randomUUID()}-${documentType.toLowerCase()}.${extension}`,
  ].join("/");
  const upload = await r2Service.generateUploadUrl(storageKey, mimeType);

  return {
    storageKey,
    mimeType,
    fileName: params.fileName.trim(),
    documentType,
    ...upload,
  };
};

export const submitSponsorProfile = async (params: {
  wallet: string;
  companyName: string;
  sponsorType: string;
  registrationNumber: string;
  businessLicenseKey: string;
  legalRepresentative: string;
  contactPhone: string;
  contactEmail: string;
  powerOfAttorneyKey?: string | null;
}) => {
  const wallet = normalizeWallet(params.wallet);
  const sponsorType = normalizeSponsorType(params.sponsorType);
  const contactEmail = normalizeEmail(params.contactEmail);

  const sponsorProfile = await prisma.sponsorProfile.upsert({
    where: { wallet },
    update: {
      companyName: params.companyName.trim(),
      sponsorType,
      registrationNumber: params.registrationNumber.trim(),
      businessLicenseKey: params.businessLicenseKey.trim(),
      legalRepresentative: params.legalRepresentative.trim(),
      contactPhone: params.contactPhone.trim(),
      contactEmail,
      powerOfAttorneyKey: params.powerOfAttorneyKey?.trim() || null,
      status: SponsorVerificationStatus.PENDING_REVIEW,
      rejectReason: null,
      approvedAt: null,
    },
    create: {
      wallet,
      companyName: params.companyName.trim(),
      sponsorType,
      registrationNumber: params.registrationNumber.trim(),
      businessLicenseKey: params.businessLicenseKey.trim(),
      legalRepresentative: params.legalRepresentative.trim(),
      contactPhone: params.contactPhone.trim(),
      contactEmail,
      powerOfAttorneyKey: params.powerOfAttorneyKey?.trim() || null,
      status: SponsorVerificationStatus.PENDING_REVIEW,
    },
  });

  await prisma.accountProfile.upsert({
    where: { wallet },
    update: {
      role: AccountRole.SPONSOR,
      displayName: params.companyName.trim(),
    },
    create: {
      wallet,
      role: AccountRole.SPONSOR,
      displayName: params.companyName.trim(),
    },
  });

  return sponsorProfile;
};

export const listPendingSponsorProfiles = () =>
  prisma.sponsorProfile.findMany({
    where: {
      status: SponsorVerificationStatus.PENDING_REVIEW,
    },
    orderBy: {
      updatedAt: "asc",
    },
  });

export const reviewSponsorProfile = async (params: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  rejectReason?: string | null;
}) => {
  const approved = params.decision === "APPROVED";
  const rejectReason = params.rejectReason?.trim() || null;

  if (!approved && !rejectReason) {
    throw new Error("rejectReason is required when rejecting a sponsor");
  }

  return prisma.sponsorProfile.update({
    where: { id: params.id },
    data: {
      status: approved
        ? SponsorVerificationStatus.APPROVED
        : SponsorVerificationStatus.REJECTED,
      rejectReason: approved ? null : rejectReason,
      approvedAt: approved ? new Date() : null,
    },
  });
};

export const getSponsorProfileByWallet = (wallet: string) =>
  prisma.sponsorProfile.findUnique({
    where: {
      wallet: normalizeWallet(wallet),
    },
  });
