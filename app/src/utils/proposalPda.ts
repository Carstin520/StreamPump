import { PublicKey } from "@solana/web3.js";

import { STREAMPUMP_PROGRAM_ID } from "./solana";

const encoder = new TextEncoder();

const i64LeBytes = (value: bigint): Uint8Array => {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigInt64(0, value, true);
  return bytes;
};

const bytesFromHex = (value: string): Uint8Array => {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (hex.length % 2 !== 0) {
    throw new Error("hex string length must be even");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
};

export const deriveCreatorProfilePda = (
  creator: PublicKey,
  programId: PublicKey = STREAMPUMP_PROGRAM_ID
): PublicKey => {
  const [creatorProfile] = PublicKey.findProgramAddressSync(
    [encoder.encode("creator"), creator.toBytes()],
    programId
  );

  return creatorProfile;
};

export const deriveProposalPda = (
  creator: PublicKey,
  deadlineTs: bigint,
  programId: PublicKey = STREAMPUMP_PROGRAM_ID
): PublicKey => {
  const [proposal] = PublicKey.findProgramAddressSync(
    [encoder.encode("proposal"), creator.toBytes(), i64LeBytes(deadlineTs)],
    programId
  );

  return proposal;
};

export const deriveProposalVaultPdas = (
  proposal: PublicKey,
  programId: PublicKey = STREAMPUMP_PROGRAM_ID
) => {
  const [proposalUsdcVault] = PublicKey.findProgramAddressSync(
    [encoder.encode("proposal_usdc_vault"), proposal.toBytes()],
    programId
  );

  const [proposalSpumpVault] = PublicKey.findProgramAddressSync(
    [encoder.encode("proposal_spump_vault"), proposal.toBytes()],
    programId
  );

  return {
    proposalUsdcVault,
    proposalSpumpVault,
  };
};

export const deriveEndorsementPositionPda = (
  user: PublicKey,
  proposal: PublicKey,
  programId: PublicKey = STREAMPUMP_PROGRAM_ID
): PublicKey => {
  const [endorsementPosition] = PublicKey.findProgramAddressSync(
    [encoder.encode("endorsement"), user.toBytes(), proposal.toBytes()],
    programId
  );

  return endorsementPosition;
};

export const deriveUpgradeReceiptPda = (
  creatorProfile: PublicKey,
  reportIdHex: string,
  programId: PublicKey = STREAMPUMP_PROGRAM_ID
): PublicKey => {
  const reportId = bytesFromHex(reportIdHex);
  if (reportId.length !== 32) {
    throw new Error("reportIdHex must be 32-byte hex");
  }

  const [upgradeReceipt] = PublicKey.findProgramAddressSync(
    [encoder.encode("upgrade_receipt"), creatorProfile.toBytes(), reportId],
    programId
  );

  return upgradeReceipt;
};
