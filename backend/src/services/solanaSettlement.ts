import {
  Connection,
  PublicKey,
} from "@solana/web3.js";

import { config } from "../../config/default";
import { CreatorUpgradePayload } from "../oracle/buildCreatorUpgradePayload";
import { OracleSettlementPayload } from "../oracle/buildOracleSettlementPayload";

export interface SubmitOracleReportParams {
  proposalCreator: string;
  proposalDeadline: bigint;
  payload: OracleSettlementPayload;
}

export interface SubmitCreatorUpgradeParams {
  creatorWallet: string;
  payload: CreatorUpgradePayload;
}

export interface ProposalAddresses {
  proposal: PublicKey;
  proposalUsdcVault: PublicKey;
  proposalSpumpVault: PublicKey;
}

export interface CreatorUpgradeAddresses {
  creatorProfile: PublicKey;
  upgradeReceipt: PublicKey;
}

const i64LeBytes = (value: bigint): Buffer => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value);
  return buffer;
};

export const deriveCreatorProfileAddress = (
  creatorWallet: string,
  programId = new PublicKey(config.solana.programId)
): PublicKey => {
  const creator = new PublicKey(creatorWallet);

  const [creatorProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator"), creator.toBuffer()],
    programId
  );

  return creatorProfile;
};

export const deriveProposalAddresses = (
  proposalCreator: string,
  proposalDeadline: bigint,
  programId = new PublicKey(config.solana.programId)
): ProposalAddresses => {
  const creator = new PublicKey(proposalCreator);

  const [proposal] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), creator.toBuffer(), i64LeBytes(proposalDeadline)],
    programId
  );

  const [proposalUsdcVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal_usdc_vault"), proposal.toBuffer()],
    programId
  );

  const [proposalSpumpVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal_spump_vault"), proposal.toBuffer()],
    programId
  );

  return {
    proposal,
    proposalUsdcVault,
    proposalSpumpVault,
  };
};

export const deriveCreatorUpgradeAddresses = (
  creatorWallet: string,
  reportIdHex: string,
  programId = new PublicKey(config.solana.programId)
): CreatorUpgradeAddresses => {
  const creatorProfile = deriveCreatorProfileAddress(creatorWallet, programId);
  const reportIdBytes = Buffer.from(reportIdHex, "hex");

  if (reportIdBytes.length !== 32) {
    throw new Error("reportIdHex must be 32-byte hex");
  }

  const [upgradeReceipt] = PublicKey.findProgramAddressSync(
    [Buffer.from("upgrade_receipt"), creatorProfile.toBuffer(), reportIdBytes],
    programId
  );

  return {
    creatorProfile,
    upgradeReceipt,
  };
};

export const submitOracleReportToProgram = async (
  params: SubmitOracleReportParams
): Promise<void> => {
  const connection = new Connection(config.solana.rpcEndpoint, "confirmed");
  const programId = new PublicKey(config.solana.programId);

  const addresses = deriveProposalAddresses(
    params.proposalCreator,
    params.proposalDeadline,
    programId
  );

  if (addresses.proposal.toBase58() !== params.payload.proposalKey) {
    throw new Error("proposalKey does not match derived proposal PDA");
  }

  // Production flow:
  // 1. Load signer for protocol oracle authority.
  // 2. Build Anchor instruction: submit_oracle_report(actual_views).
  // 3. Send + confirm transaction using accounts:
  //    - oracle
  //    - protocol_config PDA
  //    - proposal PDA (derived from creator + deadline)
  // 4. Trigger settle_proposal instruction after oracle report finalization.
  //
  // This scaffold intentionally keeps private key handling and signing out of source control.
  // Integrate with your signer service / HSM / KMS before enabling in production.
  void connection;
  void params;
};

export const submitCreatorUpgradeToProgram = async (
  params: SubmitCreatorUpgradeParams
): Promise<void> => {
  const connection = new Connection(config.solana.rpcEndpoint, "confirmed");
  const programId = new PublicKey(config.solana.programId);

  const addresses = deriveCreatorUpgradeAddresses(
    params.creatorWallet,
    params.payload.reportIdHex,
    programId
  );

  const derivedCreatorProfile = deriveCreatorProfileAddress(params.creatorWallet, programId);
  if (!derivedCreatorProfile.equals(addresses.creatorProfile)) {
    throw new Error("derived creator profile mismatch");
  }

  // Production flow:
  // 1. Load signer for protocol oracle authority.
  // 2. Build Anchor instruction: upgrade_creator(new_level, metric_type, metric_value, report_id, report_digest, observed_at).
  // 3. Send + confirm transaction using accounts:
  //    - oracle
  //    - protocol_config PDA
  //    - creator_profile PDA
  //    - upgrade_receipt PDA
  // 4. Persist upgrade_receipt key for audit and replay protection.
  //
  // This scaffold intentionally keeps private key handling and signing out of source control.
  // Integrate with your signer service / HSM / KMS before enabling in production.
  void connection;
  void params;
};
