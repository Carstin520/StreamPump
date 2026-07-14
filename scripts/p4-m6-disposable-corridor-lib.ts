import { createHash } from "node:crypto";

export const M6_CONSTANTS = Object.freeze({
  devnetGenesis: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  programId: "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp",
  programData: "58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs",
  programCapacity: 1_328_344,
  programSha256: "a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732",
  protocolConfig: "GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g",
  protocolConfigSha256: "9b31d5bddff4f8b4828ed4baf695d9514ca180de6c126b54cc7b22bf710fcc8d",
  testUsdcMint: "5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ",
  testUsdcMintSha256: "c422c88798c152d9eaf5c4f7329b9f0c1642093dfd021b69a47a9b49c393ee04",
  oracleAuthority: "HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC",
  adminMintAuthority: "BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw",
  feePayer: "Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9",
  creatorProfileAccountSpace: 263,
  upgradeReceiptAccountSpace: 164,
  hardActorTargetLamportsCap: 50_000_000,
  hardTestUsdcRawCap: 25_000_000,
  irreversibleAcknowledgement: "PILOT_TEST_ONLY_DEVNET",
});

export type M6Config = {
  execute: boolean;
  resumeExistingEvidence: boolean;
  rpcEnvPath: string;
  feePayerPath: string;
  adminMintAuthorityPath: string;
  oracleAuthorityPath: string;
  creatorPath: string;
  sponsorPath: string;
  evidencePath: string;
  runId: string;
  creatorTargetLamports: bigint;
  sponsorTargetLamports: bigint;
  maxCreatorStartingLamports: bigint;
  maxSponsorStartingLamports: bigint;
  maxActorStartingTestUsdcRaw: bigint;
  mintTestUsdcRaw: bigint;
  sponsorTestUsdcRaw: bigint;
};

const REQUIRED_VALUE_FLAGS = [
  "--rpc-env-path",
  "--fee-payer-path",
  "--admin-mint-authority-path",
  "--oracle-authority-path",
  "--creator-path",
  "--sponsor-path",
  "--evidence-path",
  "--run-id",
  "--creator-target-lamports",
  "--sponsor-target-lamports",
  "--max-creator-starting-lamports",
  "--max-sponsor-starting-lamports",
  "--max-actor-starting-test-usdc-raw",
  "--mint-test-usdc-raw",
  "--sponsor-test-usdc-raw",
] as const;

const fail = (message: string): never => {
  throw new Error(message);
};

const parseRawAmount = (value: string, flag: string, allowZero: boolean): bigint => {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) fail(`${flag} must be an unsigned raw integer`);
  const parsed = BigInt(value);
  if (!allowZero && parsed === 0n) fail(`${flag} must be greater than zero`);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${flag} exceeds the safe transaction range`);
  return parsed;
};

export const parseM6Args = (argv: string[]): M6Config => {
  const values = new Map<string, string>();
  let execute = false;
  let resumeExistingEvidence = false;
  let acknowledgement: string | undefined;
  const supported = new Set<string>([
    ...REQUIRED_VALUE_FLAGS,
    "--execute",
    "--resume-existing-evidence",
    "--acknowledge-irreversible",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!supported.has(flag)) fail(`unsupported argument: ${flag}`);
    if (flag === "--execute") {
      if (execute) fail("duplicate argument: --execute");
      execute = true;
      continue;
    }
    if (flag === "--resume-existing-evidence") {
      if (resumeExistingEvidence) fail("duplicate argument: --resume-existing-evidence");
      resumeExistingEvidence = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for ${flag}`);
    if (flag === "--acknowledge-irreversible") {
      if (acknowledgement !== undefined) fail(`duplicate argument: ${flag}`);
      acknowledgement = value;
    } else {
      if (values.has(flag)) fail(`duplicate argument: ${flag}`);
      values.set(flag, value);
    }
    index += 1;
  }

  const required = (flag: (typeof REQUIRED_VALUE_FLAGS)[number]): string =>
    values.get(flag)?.trim() || fail(`missing required argument: ${flag}`);
  if (execute && acknowledgement !== M6_CONSTANTS.irreversibleAcknowledgement) {
    fail(
      `--execute requires --acknowledge-irreversible ${M6_CONSTANTS.irreversibleAcknowledgement}`
    );
  }
  if (!execute && acknowledgement !== undefined) {
    fail("--acknowledge-irreversible is valid only with --execute");
  }

  const runId = required("--run-id");
  if (!/^[a-z0-9][a-z0-9_-]{5,47}$/.test(runId)) {
    fail("--run-id must be 6-48 lowercase ASCII letters, digits, underscore, or hyphen");
  }
  const config: M6Config = {
    execute,
    resumeExistingEvidence,
    rpcEnvPath: required("--rpc-env-path"),
    feePayerPath: required("--fee-payer-path"),
    adminMintAuthorityPath: required("--admin-mint-authority-path"),
    oracleAuthorityPath: required("--oracle-authority-path"),
    creatorPath: required("--creator-path"),
    sponsorPath: required("--sponsor-path"),
    evidencePath: required("--evidence-path"),
    runId,
    creatorTargetLamports: parseRawAmount(
      required("--creator-target-lamports"),
      "--creator-target-lamports",
      false
    ),
    sponsorTargetLamports: parseRawAmount(
      required("--sponsor-target-lamports"),
      "--sponsor-target-lamports",
      false
    ),
    maxCreatorStartingLamports: parseRawAmount(
      required("--max-creator-starting-lamports"),
      "--max-creator-starting-lamports",
      true
    ),
    maxSponsorStartingLamports: parseRawAmount(
      required("--max-sponsor-starting-lamports"),
      "--max-sponsor-starting-lamports",
      true
    ),
    maxActorStartingTestUsdcRaw: parseRawAmount(
      required("--max-actor-starting-test-usdc-raw"),
      "--max-actor-starting-test-usdc-raw",
      true
    ),
    mintTestUsdcRaw: parseRawAmount(
      required("--mint-test-usdc-raw"),
      "--mint-test-usdc-raw",
      false
    ),
    sponsorTestUsdcRaw: parseRawAmount(
      required("--sponsor-test-usdc-raw"),
      "--sponsor-test-usdc-raw",
      false
    ),
  };
  if (config.creatorTargetLamports < config.maxCreatorStartingLamports) {
    fail("creator target must be at least its approved starting ceiling");
  }
  if (config.sponsorTargetLamports < config.maxSponsorStartingLamports) {
    fail("sponsor target must be at least its approved starting ceiling");
  }
  if (config.mintTestUsdcRaw !== config.sponsorTestUsdcRaw) {
    fail("mint and sponsor transfer amounts must match so the fee-payer ATA ends at zero");
  }
  if (
    config.creatorTargetLamports > BigInt(M6_CONSTANTS.hardActorTargetLamportsCap) ||
    config.sponsorTargetLamports > BigInt(M6_CONSTANTS.hardActorTargetLamportsCap)
  ) {
    fail("actor SOL target exceeds the fixed disposable Pilot safety cap");
  }
  if (config.mintTestUsdcRaw > BigInt(M6_CONSTANTS.hardTestUsdcRawCap)) {
    fail("test-USDC amount exceeds the fixed disposable Pilot safety cap");
  }
  return config;
};

export const calculateCreatorFundingFloor = (params: {
  creatorProfileRentLamports: bigint;
  systemWalletRentLamports: bigint;
}): bigint => {
  if (params.creatorProfileRentLamports <= 0n || params.systemWalletRentLamports <= 0n) {
    fail("creator funding floor requires positive profile and system-wallet rent values");
  }
  const floor = params.creatorProfileRentLamports + params.systemWalletRentLamports;
  if (floor > BigInt(M6_CONSTANTS.hardActorTargetLamportsCap)) {
    fail("creator funding floor exceeds the fixed disposable Pilot safety cap");
  }
  return floor;
};

export const calculateCreatorRecoveryTopUp = (params: {
  currentLamports: bigint;
  creatorProfileRentLamports: bigint;
  systemWalletRentLamports: bigint;
}): bigint => {
  if (params.currentLamports < 0n) fail("creator current balance cannot be negative");
  const floor = calculateCreatorFundingFloor(params);
  return params.currentLamports >= floor ? 0n : floor - params.currentLamports;
};

export const parseDedicatedRpcEnv = (text: string): string => {
  let result: string | undefined;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?PILOT_TX_RPC_URL=(.*)$/.exec(line);
    if (!match) fail("RPC env file may contain only PILOT_TX_RPC_URL and comments");
    if (result !== undefined) fail("RPC env file contains duplicate PILOT_TX_RPC_URL");
    let value = match[1].trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    result = value;
  }
  if (!result) fail("RPC env file is missing PILOT_TX_RPC_URL");
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    return fail("PILOT_TX_RPC_URL is not an absolute URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    fail("PILOT_TX_RPC_URL must be credential-free HTTPS URL syntax");
  }
  if (url.hostname === "api.devnet.solana.com" || url.hostname === "api.mainnet-beta.solana.com") {
    fail("PILOT_TX_RPC_URL must be a dedicated devnet RPC, not a public Solana endpoint");
  }
  return result;
};

const isByteArray = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === 64 &&
  value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);

export const extractKeypairBytes = (value: unknown, expectedLabel: "oracle" | "direct"): Uint8Array => {
  if (isByteArray(value)) return Uint8Array.from(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("keypair file must be a 64-byte array or approved keypair object");
  }
  const object = value as Record<string, unknown>;
  if (isByteArray(object.secretKey)) return Uint8Array.from(object.secretKey);
  if (expectedLabel === "oracle") {
    const oracle = object.oracle;
    if (oracle && typeof oracle === "object" && !Array.isArray(oracle)) {
      const secretKey = (oracle as Record<string, unknown>).secretKey;
      if (isByteArray(secretKey)) return Uint8Array.from(secretKey);
    }
  }
  return fail("keypair file does not contain the approved 64-byte signer format");
};

export const assertSeparatedRoles = (roles: Record<string, string>): void => {
  const seen = new Map<string, string>();
  for (const [role, publicKey] of Object.entries(roles)) {
    const prior = seen.get(publicKey);
    if (prior) fail(`${role} must be distinct from ${prior}`);
    seen.set(publicKey, role);
  }
};

export const assertTokenAccountIdentity = (input: {
  label: string;
  owner: string;
  mint: string;
  expectedOwner: string;
  expectedMint: string;
}): void => {
  if (input.owner !== input.expectedOwner || input.mint !== input.expectedMint) {
    fail(`${input.label} owner/mint mismatch`);
  }
};

const canonicalJson = (value: Record<string, string | number>): string =>
  JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  );

export const buildPilotTestReport = (input: {
  runId: string;
  creator: string;
  creatorProfile: string;
  metricValue: number;
  observedAt: number;
}): { report: Record<string, string | number>; canonical: string; reportIdHex: string; digestHex: string } => {
  const report = {
    classification: "PILOT TEST ONLY - SYNTHETIC ELIGIBILITY FIXTURE - NOT A REAL METRIC",
    creator: input.creator,
    creatorProfile: input.creatorProfile,
    metricType: "followers",
    metricValue: input.metricValue,
    observedAt: input.observedAt,
    runId: input.runId,
  };
  const canonical = canonicalJson(report);
  const digestHex = createHash("sha256").update(canonical, "utf8").digest("hex");
  const reportIdHex = createHash("sha256")
    .update(`streampump:p4-m6:test-upgrade:v1\0${input.runId}\0${input.creator}`, "utf8")
    .digest("hex");
  return { report, canonical, reportIdHex, digestHex };
};

export const toJsonSafe = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, toJsonSafe(nested)])
    );
  }
  return value;
};
