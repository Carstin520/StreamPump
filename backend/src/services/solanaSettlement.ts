import {
  Connection,
  PublicKey,
} from "@solana/web3.js";

import { config } from "../../config/default";
import { OracleSettlementPayload } from "../oracle/buildOracleSettlementPayload";

export interface SubmitOracleReportParams {
  sponsorWallet: string;
  campaignId: bigint;
  payload: OracleSettlementPayload;
}

export const submitOracleReportToProgram = async (
  params: SubmitOracleReportParams
): Promise<void> => {
  const connection = new Connection(config.solana.rpcEndpoint, "confirmed");
  const programId = new PublicKey(config.solana.programId);

  // Production flow:
  // 1. Load signer for protocol oracle authority.
  // 2. Build Anchor instruction: submit_oracle_report(final_views, request_id, report_digest).
  // 3. Send + confirm transaction.
  // 4. Trigger settle_campaign instruction after report finalization.
  //
  // This scaffold intentionally keeps private key handling and signing out of source control.
  // Integrate with your signer service / HSM / KMS before enabling in production.
  void connection;
  void programId;
  void params;
};
