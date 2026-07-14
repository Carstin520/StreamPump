import { closeSync, constants, fstatSync, openSync, readFileSync } from "fs";
import path from "path";
import * as anchor from "@coral-xyz/anchor";

export class PilotCorridorConfigError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PilotCorridorConfigError";
    this.code = code;
  }
}

export type KeypairInput = {
  secretKey: number[];
  source: "MODE_0600_PATH" | "LEGACY_ENV_JSON";
};

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

const readMode0600File = (configuredPath: string, pathName: string): string => {
  const absolutePath = path.resolve(configuredPath);
  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw new PilotCorridorConfigError(
      `${pathName}_NOT_FOUND`,
      `${pathName} must point directly to an existing regular file.`
    );
  }
  try {
    const stat = fstatSync(fileDescriptor);
    if (!stat.isFile()) {
      throw new PilotCorridorConfigError(
        `${pathName}_NOT_REGULAR_FILE`,
        `${pathName} must point directly to a regular file, not a symlink.`
      );
    }
    if ((stat.mode & 0o777) !== 0o600) {
      throw new PilotCorridorConfigError(
        `${pathName}_MODE_0600_REQUIRED`,
        `${pathName} must have mode 0600 before it can be loaded.`
      );
    }
    return readFileSync(fileDescriptor, "utf8");
  } finally {
    closeSync(fileDescriptor);
  }
};

const parseSecretKeyJson = (raw: string, label: string): number[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PilotCorridorConfigError(
      `${label}_INVALID_JSON`,
      `${label} must contain a JSON byte array.`
    );
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 64 ||
    parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    throw new PilotCorridorConfigError(
      `${label}_INVALID_SECRET_KEY`,
      `${label} must contain exactly 64 keypair bytes as a JSON array.`
    );
  }

  return parsed as number[];
};

export const loadExclusiveKeypairInput = (
  env: NodeJS.ProcessEnv,
  pathName: string,
  jsonName: string,
  options: { pathOnly?: boolean } = {}
): KeypairInput => {
  const configuredPath = env[pathName]?.trim();
  const configuredJson = env[jsonName]?.trim();

  if (configuredPath && configuredJson) {
    throw new PilotCorridorConfigError(
      `${pathName}_AND_${jsonName}_CONFLICT`,
      `Set exactly one of ${pathName} or ${jsonName}, never both.`
    );
  }

  if (options.pathOnly && configuredJson) {
    throw new PilotCorridorConfigError(
      `${jsonName}_FORBIDDEN_IN_M6`,
      `${jsonName} is forbidden in M6; use the mode-0600 ${pathName} file.`
    );
  }

  if (!configuredPath && !configuredJson) {
    throw new PilotCorridorConfigError(
      `${pathName}_OR_${jsonName}_REQUIRED`,
      `Set ${pathName} to a mode-0600 keypair file (preferred), or use legacy ${jsonName}.`
    );
  }

  if (configuredJson) {
    return {
      secretKey: parseSecretKeyJson(configuredJson, jsonName),
      source: "LEGACY_ENV_JSON",
    };
  }

  return {
    secretKey: parseSecretKeyJson(
      readMode0600File(configuredPath as string, pathName),
      pathName
    ),
    source: "MODE_0600_PATH",
  };
};

const DEFAULT_TRACK1_BASE_RAW = 25_000_000n;
const MAX_TRACK1_BASE_RAW = 25_000_000n;

export const parseTrack1BaseRaw = (value: string | undefined): bigint => {
  const normalized = value?.trim() || DEFAULT_TRACK1_BASE_RAW.toString();
  if (!/^\d+$/.test(normalized)) {
    throw new PilotCorridorConfigError(
      "STREAM_PUMP_SMOKE_TRACK1_BASE_RAW_INVALID",
      "STREAM_PUMP_SMOKE_TRACK1_BASE_RAW must be a positive integer raw test-USDC amount."
    );
  }

  const amount = BigInt(normalized);
  if (amount <= 0n || amount > MAX_TRACK1_BASE_RAW) {
    throw new PilotCorridorConfigError(
      "STREAM_PUMP_SMOKE_TRACK1_BASE_RAW_OUT_OF_RANGE",
      `STREAM_PUMP_SMOKE_TRACK1_BASE_RAW must be between 1 and ${MAX_TRACK1_BASE_RAW}.`
    );
  }

  return amount;
};

export const formatRawUsdc = (rawAmount: bigint): string => {
  const whole = rawAmount / 1_000_000n;
  const fractional = (rawAmount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
};

export const buildPilotTestSponsorProfile = (smokeRunId: string, businessLicenseKey: string) => ({
  companyName: `PILOT TEST ONLY - Disposable Sponsor ${smokeRunId}`,
  sponsorType: "INDIVIDUAL",
  registrationNumber: `PILOT-TEST-ONLY-${smokeRunId}`,
  businessLicenseKey,
  legalRepresentative: "PILOT TEST ONLY - NOT A REAL BUSINESS REPRESENTATIVE",
  contactPhone: "PILOT-TEST-ONLY",
  contactEmail: `pilot-test-only+${smokeRunId.replace(/[^a-zA-Z0-9]/g, "-")}@example.invalid`,
});

export const buildPilotTestSponsorReviewMarker = (runId: string, wallet: string) => ({
  classification: "PILOT_TEST_ONLY_NOT_REAL_KYB",
  runId,
  wallet,
  realKyb: false,
  reusableOutsideRun: false,
});

export const M6_PILOT_TEST_USDC_MINT = "5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ";
export const M6_TRACK1_BASE_RAW = 1_000_000n;

const M6_FROZEN_AUTHORITIES = {
  programId: "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp",
  feePayer: "Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9",
  adminMintAuthority: "BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw",
  oracleAuthority: "HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC",
};

const M6_FRESH_TRANSACTION_SEQUENCE = [
  "fund_disposable_creator_sol",
  "fund_disposable_sponsor_sol",
  "create_fee_payer_test_usdc_ata",
  "create_creator_test_usdc_ata",
  "create_sponsor_test_usdc_ata",
  "mint_approved_test_usdc_to_fee_payer_ata",
  "transfer_approved_test_usdc_to_sponsor",
  "oracle_authorized_register_disposable_creator",
  "create_pilot_test_only_s2_upgrade_receipt",
] as const;

const M6_RESUMED_TRANSACTION_SEQUENCE = [
  ...M6_FRESH_TRANSACTION_SEQUENCE.slice(0, 7),
  "resume_fund_disposable_creator_rent_floor",
  ...M6_FRESH_TRANSACTION_SEQUENCE.slice(7),
] as const;

const M6_CREATOR_PROFILE_ACCOUNT_SPACE = 263;
const M6_UPGRADE_RECEIPT_ACCOUNT_SPACE = 164;
const M6_CREATOR_PROFILE_RENT_LAMPORTS = 2_721_360n;
const M6_SYSTEM_WALLET_RENT_LAMPORTS = 890_880n;
const M6_CREATOR_FUNDING_FLOOR_LAMPORTS = 3_612_240n;
const M6_RECOVERY_TOP_UP_LAMPORTS = 612_240n;

const exactIntegerString = (value: unknown): bigint | null => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const isValidSolanaSignature = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return anchor.utils.bytes.bs58.decode(value).length === 64;
  } catch {
    return false;
  }
};

export type M6ActorPrepEvidenceBinding = {
  runId: string;
  creator: string;
  sponsor: string;
  mint: string;
  sponsorTestUsdcRaw: string;
  phase: "actor_chain_preparation_complete";
  transactionCount: number;
};

export const loadM6ActorPrepEvidence = (params: {
  evidencePath: string;
  runId: string;
  creator: string;
  sponsor: string;
}): M6ActorPrepEvidenceBinding => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      readMode0600File(params.evidencePath, "STREAM_PUMP_SMOKE_ACTOR_PREP_EVIDENCE_PATH")
    );
  } catch (error) {
    if (error instanceof PilotCorridorConfigError) throw error;
    throw new PilotCorridorConfigError(
      "M6_ACTOR_PREP_EVIDENCE_INVALID_JSON",
      "M6 actor-prep evidence must be valid JSON."
    );
  }
  const root = asRecord(parsed);
  const constantsRecord = asRecord(root?.constants);
  const actors = asRecord(root?.actors);
  const amounts = asRecord(root?.approvedAmounts);
  const postflight = asRecord(root?.postflight);
  const upgrade = asRecord(root?.pilotTestUpgradeReport);
  const report = asRecord(upgrade?.report);
  const recovery = asRecord(root?.recovery);
  const transactions = Array.isArray(root?.transactions) ? root.transactions : [];
  const expectedSequence = recovery
    ? M6_RESUMED_TRANSACTION_SEQUENCE
    : M6_FRESH_TRANSACTION_SEQUENCE;
  const transactionRecords = transactions.map(asRecord);
  const signatures = transactionRecords.map((transaction) => transaction?.signature);
  const supplyBefore = exactIntegerString(postflight?.testUsdcSupplyBeforeRaw);
  const supplyAfter = exactIntegerString(postflight?.testUsdcSupplyAfterRaw);
  const creatorTarget = exactIntegerString(amounts?.creatorTargetLamports);
  const recoveryProfileRent = exactIntegerString(recovery?.creatorProfileRentLamports);
  const recoveryWalletRent = exactIntegerString(recovery?.creatorSystemWalletRentLamports);
  const recoveryFundingFloor = exactIntegerString(recovery?.requiredCreatorFundingFloorLamports);
  const recoveryBalanceBefore = exactIntegerString(recovery?.creatorBalanceBeforeRecoveryLamports);
  const recoveryTopUp = exactIntegerString(recovery?.supplementalCreatorTopUpLamports);
  const approvedRecoveryTopUp = exactIntegerString(amounts?.creatorRecoveryTopUpLamports);
  const recoveryInvalid = recovery
    ? recovery.causeCode !== "CREATOR_PROFILE_AND_SYSTEM_RENT_FLOOR_OMITTED" ||
      recovery.originalTransactionCount !== 7 ||
      recovery.priorTransactionsFinalizedAndBound !== true ||
      recovery.creatorProfileAccountSpace !== M6_CREATOR_PROFILE_ACCOUNT_SPACE ||
      recoveryProfileRent !== M6_CREATOR_PROFILE_RENT_LAMPORTS ||
      recoveryWalletRent !== M6_SYSTEM_WALLET_RENT_LAMPORTS ||
      recoveryFundingFloor !== M6_CREATOR_FUNDING_FLOOR_LAMPORTS ||
      recoveryBalanceBefore !== 3_000_000n ||
      recoveryTopUp !== M6_RECOVERY_TOP_UP_LAMPORTS ||
      approvedRecoveryTopUp !== M6_RECOVERY_TOP_UP_LAMPORTS ||
      creatorTarget !== recoveryBalanceBefore ||
      postflight?.recoveryTopUpLamports !== M6_RECOVERY_TOP_UP_LAMPORTS.toString() ||
      recoveryProfileRent === null ||
      recoveryWalletRent === null ||
      recoveryFundingFloor === null ||
      recoveryBalanceBefore === null ||
      recoveryTopUp === null ||
      recoveryProfileRent + recoveryWalletRent !== recoveryFundingFloor ||
      recoveryBalanceBefore + recoveryTopUp !== recoveryFundingFloor ||
      recovery.noBlindResend !== true
    : amounts?.creatorRecoveryTopUpLamports !== undefined ||
      postflight?.recoveryTopUpLamports !== undefined ||
      creatorTarget === null ||
      creatorTarget < M6_CREATOR_FUNDING_FLOOR_LAMPORTS;
  const invalid =
    root?.schemaVersion !== 1 ||
    root?.phase !== "actor_chain_preparation_complete" ||
    (root?.recovery !== undefined && !recovery) ||
    typeof root.completedAt !== "string" ||
    report?.runId !== params.runId ||
    actors?.creator !== params.creator ||
    actors?.sponsor !== params.sponsor ||
    constantsRecord?.testUsdcMint !== M6_PILOT_TEST_USDC_MINT ||
    constantsRecord?.programId !== M6_FROZEN_AUTHORITIES.programId ||
    constantsRecord?.feePayer !== M6_FROZEN_AUTHORITIES.feePayer ||
    constantsRecord?.adminMintAuthority !== M6_FROZEN_AUTHORITIES.adminMintAuthority ||
    constantsRecord?.oracleAuthority !== M6_FROZEN_AUTHORITIES.oracleAuthority ||
    actors?.feePayer !== M6_FROZEN_AUTHORITIES.feePayer ||
    actors?.adminMintAuthority !== M6_FROZEN_AUTHORITIES.adminMintAuthority ||
    actors?.oracleAuthority !== M6_FROZEN_AUTHORITIES.oracleAuthority ||
    amounts?.actorStartingCeilingTestUsdcRaw !== "0" ||
    amounts?.mintToFeePayerTestUsdcRaw !== M6_TRACK1_BASE_RAW.toString() ||
    amounts?.transferToSponsorTestUsdcRaw !== M6_TRACK1_BASE_RAW.toString() ||
    postflight?.allTransactionsFinalized !== true ||
    postflight?.transactionCount !== transactions.length ||
    supplyBefore === null ||
    supplyAfter === null ||
    supplyAfter - supplyBefore !== M6_TRACK1_BASE_RAW ||
    postflight?.feePayerTestUsdcRaw !== "0" ||
    postflight?.creatorTestUsdcRaw !== "0" ||
    postflight?.sponsorTestUsdcRaw !== M6_TRACK1_BASE_RAW.toString() ||
    postflight?.creatorLevel !== 2 ||
    String(postflight?.creatorStatus ?? "").replace(/_/g, "").toLowerCase() !== "s2active" ||
    postflight?.receiptDigestVerified !== true ||
    postflight?.receiptReportIdVerified !== true ||
    postflight?.creatorProfileAccountSpace !== M6_CREATOR_PROFILE_ACCOUNT_SPACE ||
    postflight?.upgradeReceiptAccountSpace !== M6_UPGRADE_RECEIPT_ACCOUNT_SPACE ||
    postflight?.forbiddenLaneInstructionsSent !== 0 ||
    transactions.length !== expectedSequence.length ||
    transactionRecords.some(
      (transaction, index) =>
        !transaction ||
        transaction.step !== expectedSequence[index] ||
        transaction.simulation !== "passed" ||
        transaction.state !== "finalized" ||
        transaction.confirmationStatus !== "finalized" ||
        !isValidSolanaSignature(transaction.signature)
    ) ||
    new Set(signatures).size !== signatures.length ||
    recoveryInvalid;
  if (invalid) {
    throw new PilotCorridorConfigError(
      "M6_ACTOR_PREP_EVIDENCE_MISMATCH",
      "M6 actor-prep evidence is incomplete or does not match this exact run, actor pair, frozen authority set, mint, and 1 test-USDC budget."
    );
  }

  return {
    runId: params.runId,
    creator: params.creator,
    sponsor: params.sponsor,
    mint: M6_PILOT_TEST_USDC_MINT,
    sponsorTestUsdcRaw: M6_TRACK1_BASE_RAW.toString(),
    phase: "actor_chain_preparation_complete",
    transactionCount: transactions.length,
  };
};

export const assertDedicatedDevnetRpcUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PilotCorridorConfigError(
      "M6_DEDICATED_RPC_REQUIRED",
      "PILOT_TX_RPC_URL must be an absolute dedicated devnet RPC URL."
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ["api.devnet.solana.com", "api.mainnet-beta.solana.com"].includes(url.hostname.toLowerCase())
  ) {
    throw new PilotCorridorConfigError(
      "M6_DEDICATED_RPC_REQUIRED",
      "PILOT_TX_RPC_URL must be a dedicated HTTPS devnet RPC, not a shared public endpoint."
    );
  }
  return value;
};
