import { TransactionInstruction } from "@solana/web3.js";

import {
  HttpError,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  parseNonNegativeInt,
  parseWallet,
} from "../controllers/http";
import { getAnchorService, UserMissionTypeName } from "./AnchorService";
import { ingestConfirmedProgramTransaction } from "./indexer";
import {
  loadManagedWalletKeypair,
  ManagedWalletSecretMissingError,
} from "./managedWalletService";

const parsePositiveBigInt = (value: unknown, fieldName: string): bigint => {
  const parsed = parseNonNegativeBigInt(value, fieldName);
  if (parsed <= 0n) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const parseOptionalPositiveInt = (value: unknown, fieldName: string): number | null => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = parseNonNegativeInt(value, fieldName);
  if (parsed <= 0) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const parseMissionType = (value: unknown): UserMissionTypeName => {
  const parsed = parseNonEmptyString(value, "missionType").toUpperCase();
  const allowed: UserMissionTypeName[] = [
    "DAILY_SESSION_5_MIN",
    "LIKE_10_POSTS",
    "FOLLOW_3_CREATORS",
    "SHARE_1_POST",
    "PUBLISH_FIRST_POST",
    "COMPLETE_PROFILE",
    "SPONSOR_CAMPAIGN_REVIEW",
  ];

  if (!allowed.includes(parsed as UserMissionTypeName)) {
    throw new HttpError(400, "INVALID_INPUT", "missionType is not supported");
  }

  return parsed as UserMissionTypeName;
};

const parseDigestHex = (value: unknown, fieldName: string): string => {
  const parsed = parseNonEmptyString(value, fieldName).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be 32-byte hex`);
  }

  return parsed;
};

const parseParamsRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

type ManagedWalletAction =
  | "claim-daily-spump"
  | "claim-engagement-reward"
  | "endorse-proposal"
  | "claim-s1-buyout-usdc"
  | "buy_s1_token"
  | "demo-usdc-claim";

const parseManagedAction = (value: unknown): ManagedWalletAction => {
  const action = parseNonEmptyString(value, "action");
  switch (action) {
    case "claim-daily-spump":
    case "claim-engagement-reward":
    case "endorse-proposal":
    case "claim-s1-buyout-usdc":
    case "buy_s1_token":
      return action;
    case "buy-s1-token":
      return "buy_s1_token";
    case "demo-USDC claim":
    case "demo-usdc-claim":
    case "claim-demo-usdc":
    case "claim_demo_usdc":
      return "demo-usdc-claim";
    default:
      throw new HttpError(400, "UNSUPPORTED_MANAGED_ACTION", "managed wallet action is not supported");
  }
};

export type S1ProjectionSyncResponse =
  | {
      status: "SYNCED";
      instructionCount: number;
      indexerStatus: string;
    }
  | {
      status: "FAILED";
      instructionCount?: number;
      indexerStatus?: string;
      error?: string;
    };

export const syncSubmittedS1Projection = async (
  signature: string,
  ingest: typeof ingestConfirmedProgramTransaction = ingestConfirmedProgramTransaction
): Promise<S1ProjectionSyncResponse> => {
  try {
    const projectionSync = await ingest(signature, {
      updateCursor: false,
    });

    return {
      status: projectionSync.status === "SYNCED" ? "SYNCED" : "FAILED",
      instructionCount: projectionSync.instructionCount,
      indexerStatus: projectionSync.status,
    };
  } catch (error) {
    return {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

type ManagedWalletExecutionDeps = {
  getAnchorService: typeof getAnchorService;
  loadManagedWalletKeypair: typeof loadManagedWalletKeypair;
  syncSubmittedS1Projection: typeof syncSubmittedS1Projection;
};

const defaultManagedWalletExecutionDeps: ManagedWalletExecutionDeps = {
  getAnchorService,
  loadManagedWalletKeypair,
  syncSubmittedS1Projection,
};

export const executeManagedWalletActionForSession = async (
  params: {
    userWallet: string;
    action: unknown;
    rawParams: unknown;
    syncProjection?: boolean;
  },
  deps: ManagedWalletExecutionDeps = defaultManagedWalletExecutionDeps
) => {
  let managedKeypair: Awaited<ReturnType<typeof loadManagedWalletKeypair>>;
  try {
    managedKeypair = await deps.loadManagedWalletKeypair(params.userWallet);
  } catch (error) {
    if (error instanceof ManagedWalletSecretMissingError) {
      throw new HttpError(
        400,
        "MANAGED_WALLET_KEY_MISSING",
        "managed wallet is missing encrypted key material"
      );
    }

    throw error;
  }
  if (!managedKeypair) {
    throw new HttpError(400, "NOT_MANAGED_WALLET", "current session wallet is not a managed wallet");
  }

  const action = parseManagedAction(params.action);
  const actionParams = parseParamsRecord(params.rawParams);
  const anchorService = deps.getAnchorService();
  const oracleSigner = anchorService.oracleAuthority;

  let instruction: TransactionInstruction;
  let payerWallet = oracleSigner.publicKey.toBase58();
  let backendSigners = [managedKeypair, oracleSigner];

  if (action === "claim-daily-spump") {
    instruction = await anchorService.buildClaimDailySpumpInstruction({
      userWallet: params.userWallet,
    });
  } else if (action === "claim-engagement-reward") {
    const reward = await anchorService.buildClaimEngagementRewardInstruction({
      userWallet: params.userWallet,
      missionType: parseMissionType(actionParams.missionType),
      rewardAmount: parseNonNegativeBigInt(actionParams.rewardAmount, "rewardAmount"),
      xpGain: parseNonNegativeBigInt(actionParams.xpGain, "xpGain"),
      newLevel: parseOptionalPositiveInt(actionParams.newLevel, "newLevel"),
      reportIdHex: parseDigestHex(actionParams.reportIdHex, "reportIdHex"),
      reportDigestHex: parseDigestHex(actionParams.reportDigestHex, "reportDigestHex"),
      observedAtUnix: parseNonNegativeBigInt(actionParams.observedAtUnix, "observedAtUnix"),
    });
    instruction = reward.instruction;
    backendSigners = [managedKeypair, reward.oracleSigner];
    payerWallet = reward.oracleSigner.publicKey.toBase58();
  } else if (action === "claim-s1-buyout-usdc" || action === "demo-usdc-claim") {
    instruction = await anchorService.buildClaimS1BuyoutUsdcInstruction({
      userWallet: params.userWallet,
      creatorWallet: parseWallet(actionParams.creatorWallet, "creatorWallet"),
      sponsorWallet: parseWallet(actionParams.sponsorWallet, "sponsorWallet"),
    });
    payerWallet = oracleSigner.publicKey.toBase58();
    backendSigners = [managedKeypair, oracleSigner];
  } else if (action === "buy_s1_token") {
    instruction = await anchorService.buildBuyS1TokenInstruction({
      userWallet: params.userWallet,
      creatorWallet: parseWallet(actionParams.creatorWallet, "creatorWallet"),
      amount: parsePositiveBigInt(actionParams.amount, "amount"),
    });
    payerWallet = oracleSigner.publicKey.toBase58();
    backendSigners = [managedKeypair, oracleSigner];
  } else {
    const proposalPda = parseWallet(actionParams.proposalPda, "proposalPda");
    const amount = parsePositiveBigInt(actionParams.amount, "amount");
    instruction = await anchorService.buildEndorseProposalInstruction({
      userWallet: params.userWallet,
      proposalPda,
      amount,
    });
    payerWallet = oracleSigner.publicKey.toBase58();
    backendSigners = [managedKeypair, oracleSigner];
  }

  const built = await anchorService.buildClientSignedTransaction({
    payerWallet,
    instructions: [instruction],
    backendSigners,
  });
  const signature = await anchorService.sendAndConfirmVersionedTransaction({
    serializedTxBase64: built.transactionBase64,
    recentBlockhash: built.recentBlockhash,
    lastValidBlockHeight: built.lastValidBlockHeight,
  });

  return {
    signature,
    action,
    projectionSync:
      params.syncProjection === false
        ? undefined
        : await deps.syncSubmittedS1Projection(signature),
  };
};
