/**
 * CN: Backend 运行时配置入口，集中读取环境变量并提供默认值。
 * EN: Runtime backend configuration entry that reads environment variables and applies defaults.
 */
import { PublicKey } from "@solana/web3.js";

import { env } from "./env";
import "./loadEnv";

const DEFAULT_AUTH_SESSION_SECRET = "dev-only-session-secret-change-me";

export const normalizePilotInviteWallets = (rawWallets: string[]): string[] => {
  const normalized = new Set<string>();

  for (const rawWallet of rawWallets) {
    const wallet = rawWallet.trim();
    if (!wallet) {
      continue;
    }

    try {
      normalized.add(new PublicKey(wallet).toBase58());
    } catch (_error) {
      throw new Error(
        "Invalid configuration: PILOT_INVITE_WALLETS contains an invalid Solana wallet address"
      );
    }
  }

  return [...normalized].sort();
};

const normalizeOptionalPublicKey = (rawValue: string | undefined, variableName: string): string => {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    return "";
  }

  try {
    return new PublicKey(value).toBase58();
  } catch (_error) {
    throw new Error(`Invalid configuration: ${variableName} must be a valid Solana address`);
  }
};

export const config = {
  app: {
    apiBaseUrl: env.readString(process.env.API_BASE_URL, "http://localhost:4000/api/v1"),
    // CORS_ALLOWED_ORIGINS / 允许访问后端 API 的前端来源列表
    // CN: 生产环境建议显式填写逗号分隔的前端域名，例如 https://app.example.com。
    // EN: Comma-separated frontend origins allowed to call the backend API in production.
    corsAllowedOrigins: env.readCsv(process.env.CORS_ALLOWED_ORIGINS),
  },
  auth: {
    sessionSecret: env.readString(process.env.AUTH_SESSION_SECRET, DEFAULT_AUTH_SESSION_SECRET),
    challengeTtlSeconds: env.readNumber(process.env.AUTH_CHALLENGE_TTL_SECONDS, 600),
    sessionTtlSeconds: env.readNumber(process.env.AUTH_SESSION_TTL_SECONDS, 60 * 60 * 24 * 7),
    allowLegacyWalletHeader: env.readBoolean(process.env.AUTH_ALLOW_LEGACY_WALLET_HEADER, false),
    allowPreviewProviderExchange: env.readBoolean(
      process.env.AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE,
      false
    ),
    internalOperatorApiKey: process.env.INTERNAL_OPERATOR_API_KEY,
    creatorAuthAllowPreviewTwitter: env.readBoolean(
      process.env.CREATOR_AUTH_ALLOW_PREVIEW_TWITTER,
      false
    ),
  },
  managedWallet: {
    publicExecutionEnabled: env.readBoolean(
      process.env.PUBLIC_MANAGED_WALLET_EXECUTION_ENABLED,
      false
    ),
    ephemeralSessionsEnabled: env.readBoolean(process.env.EPHEMERAL_SESSIONS_ENABLED, false),
    encryptionKey: env.readString(process.env.MANAGED_WALLET_ENCRYPTION_KEY, ""),
    jobWorkerConcurrency: env.readNumber(process.env.MANAGED_WALLET_JOB_CONCURRENCY, 5),
    jobWorkerPollMs: env.readNumber(process.env.MANAGED_WALLET_JOB_POLL_MS, 500),
    maxJobsPerWalletPerDay: env.readNumber(process.env.MANAGED_WALLET_MAX_JOBS_PER_DAY, 4),
    executeIpWindowMs: env.readNumber(process.env.MANAGED_WALLET_EXECUTE_IP_WINDOW_MS, 60_000),
    executeIpLimit: env.readNumber(process.env.MANAGED_WALLET_EXECUTE_IP_LIMIT, 60),
    executeWalletWindowMs: env.readNumber(
      process.env.MANAGED_WALLET_EXECUTE_WALLET_WINDOW_MS,
      60_000
    ),
    executeWalletLimit: env.readNumber(process.env.MANAGED_WALLET_EXECUTE_WALLET_LIMIT, 10),
    ephemeralIpWindowMs: env.readNumber(process.env.EPHEMERAL_SESSION_IP_WINDOW_MS, 60_000),
    ephemeralIpLimit: env.readNumber(process.env.EPHEMERAL_SESSION_IP_LIMIT, 30),
    ephemeralSubjectWindowMs: env.readNumber(
      process.env.EPHEMERAL_SESSION_SUBJECT_WINDOW_MS,
      60_000
    ),
    ephemeralSubjectLimit: env.readNumber(process.env.EPHEMERAL_SESSION_SUBJECT_LIMIT, 5),
    syncProjectionOnJobSuccess: env.readBoolean(
      process.env.MANAGED_WALLET_JOB_SYNC_PROJECTION,
      false
    ),
  },
  email: {
    deliveryMode: env.readString(process.env.EMAIL_DELIVERY_MODE, "console"),
    fromAddress: env.readString(process.env.EMAIL_FROM, "StreamPump <login@streampump.local>"),
    resendApiKey: process.env.RESEND_API_KEY,
    otpTtlSeconds: env.readNumber(process.env.EMAIL_OTP_TTL_SECONDS, 10 * 60),
    otpCodeLength: env.readNumber(process.env.EMAIL_OTP_CODE_LENGTH, 6),
    devCode: process.env.EMAIL_OTP_DEV_CODE,
  },
  solana: {
    rpcEndpoint: env.readString(process.env.SOLANA_RPC_ENDPOINT, "https://api.devnet.solana.com"),
    txRpcEndpoint: env.readString(
      process.env.SOLANA_TX_RPC_ENDPOINT,
      env.readString(process.env.SOLANA_RPC_ENDPOINT, "https://api.devnet.solana.com")
    ),
    indexerRpcEndpoint: env.readString(
      process.env.SOLANA_INDEXER_RPC_ENDPOINT,
      env.readString(process.env.SOLANA_RPC_ENDPOINT, "https://api.devnet.solana.com")
    ),
    isDevnet: env.readBoolean(
      process.env.SOLANA_IS_DEVNET,
      (process.env.SOLANA_RPC_ENDPOINT ?? "https://api.devnet.solana.com").includes("devnet")
    ),
    programId: env.readString(
      process.env.STREAMPUMP_PROGRAM_ID,
      "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp"
    ),
  },
  indexer: {
    enabled: env.readBoolean(process.env.INDEXER_ENABLED, false),
    backfillLimit: env.readNumber(process.env.INDEXER_BACKFILL_LIMIT, 100),
    consumerKey: env.readString(process.env.INDEXER_CONSUMER_KEY, "streampump_core_logs"),
  },
  s1: {
    mockApiEnabled: env.readBoolean(process.env.S1_MOCK_API_ENABLED, false),
  },
  oracle: {
    schedulerEnabled: env.readBoolean(process.env.ORACLE_SCHEDULER_ENABLED, false),
    runOnBoot: env.readBoolean(process.env.ORACLE_RUN_ON_BOOT, false),
    track3AutoSettlementEnabled: env.readBoolean(
      process.env.ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED,
      false
    ),
    track2AutoSettlementEnabled: env.readBoolean(
      process.env.ORACLE_TRACK2_AUTO_SETTLEMENT_ENABLED,
      false
    ),
    track1Cron: env.readString(process.env.ORACLE_TRACK1_CRON, "0 * * * *"),
    track2Cron: env.readString(process.env.ORACLE_TRACK2_CRON, "15 2 * * *"),
    track3Cron: env.readString(process.env.ORACLE_TRACK3_CRON, "45 2 * * *"),
    workerBatchSize: env.readNumber(process.env.ORACLE_WORKER_BATCH_SIZE, 200),
  },
  mux: {
    reconciliation: {
      enabled: env.readBoolean(process.env.MUX_RECONCILIATION_ENABLED, false),
      runOnBoot: env.readBoolean(process.env.MUX_RECONCILIATION_RUN_ON_BOOT, false),
      cron: env.readString(process.env.MUX_RECONCILIATION_CRON, "*/10 * * * *"),
      batchSize: env.readNumber(process.env.MUX_RECONCILIATION_BATCH_SIZE, 50),
      staleMinutes: env.readNumber(process.env.MUX_RECONCILIATION_STALE_MINUTES, 5),
      maxAttempts: env.readNumber(process.env.MUX_RECONCILIATION_MAX_ATTEMPTS, 24),
    },
  },
  storage: {
    origin: {
      region: env.readString(process.env.R2_REGION, "auto"),
      bucket: env.readString(process.env.R2_BUCKET, ""),
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      maxAssetSizeBytes: env.readNumber(process.env.R2_MAX_ASSET_SIZE_BYTES, 100 * 1024 * 1024),
      monthlyUploadLimitBytes: env.readNumber(process.env.R2_MONTHLY_UPLOAD_LIMIT_BYTES, 0),
    },
    delivery: {
      region: env.readString(process.env.R2_REGION, "auto"),
      bucket: env.readString(process.env.R2_DELIVERY_BUCKET, ""),
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
      publicFeedUseSignedUrls: env.readBoolean(process.env.R2_PUBLIC_FEED_USE_SIGNED_URLS, false),
    },
    edge: {
      region: env.readString(process.env.R2_REGION, "auto"),
      bucket: env.readString(process.env.R2_DELIVERY_BUCKET, ""),
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    },
  },
  antiCheat: {
    maxRiskScore: env.readNumber(process.env.ANTICHEAT_MAX_RISK_SCORE, 45),
    ipWindowMs: env.readNumber(process.env.ANTICHEAT_IP_WINDOW_MS, 5 * 60 * 1000),
    minInteractionEvents: env.readNumber(process.env.ANTICHEAT_MIN_INTERACTIONS, 3),
  },
  pilot: {
    s1PublicApiEnabled: env.readBoolean(process.env.S1_PUBLIC_API_ENABLED, false),
    track2Enabled: env.readBoolean(process.env.TRACK2_ENABLED, false),
    track3Enabled: env.readBoolean(process.env.TRACK3_ENABLED, false),
    emailAuthEnabled: env.readBoolean(process.env.EMAIL_AUTH_ENABLED, false),
    engagementRewardsEnabled: env.readBoolean(
      process.env.ENGAGEMENT_REWARDS_ENABLED,
      false
    ),
    track2MetricIngestionEnabled: env.readBoolean(
      process.env.TRACK2_METRIC_INGESTION_ENABLED,
      false
    ),
    prototypeRoutesEnabled: env.readBoolean(
      process.env.PROTOTYPE_ROUTES_ENABLED,
      false
    ),
    inviteOnly: env.readBoolean(
      process.env.PILOT_INVITE_ONLY,
      process.env.NODE_ENV === "production"
    ),
    inviteWallets: normalizePilotInviteWallets(
      env.readCsv(process.env.PILOT_INVITE_WALLETS)
    ),
    expectedUsdcMint: normalizeOptionalPublicKey(
      process.env.PILOT_EXPECTED_USDC_MINT,
      "PILOT_EXPECTED_USDC_MINT"
    ),
    chainPreflightTimeoutMs: env.readNumber(
      process.env.PILOT_CHAIN_PREFLIGHT_TIMEOUT_MS,
      10_000
    ),
  },
  chainlink: {
    sourceApiBaseUrl: env.readString(
      process.env.CHAINLINK_SOURCE_API_BASE_URL,
      "https://api.example.com"
    ),
    gatewayUrl: process.env.CHAINLINK_GATEWAY_URL,
  },
};

export const isManagedWalletEncryptionKeyRequired = (runtimeConfig: typeof config): boolean =>
  runtimeConfig.auth.allowPreviewProviderExchange ||
  runtimeConfig.managedWallet.ephemeralSessionsEnabled ||
  runtimeConfig.managedWallet.publicExecutionEnabled ||
  runtimeConfig.pilot.emailAuthEnabled;

export const getEnabledForbiddenPilotFeatures = (runtimeConfig: typeof config): string[] => {
  const forbiddenPilotFeatures: Array<[boolean, string]> = [
    [runtimeConfig.auth.allowLegacyWalletHeader, "AUTH_ALLOW_LEGACY_WALLET_HEADER"],
    [runtimeConfig.auth.allowPreviewProviderExchange, "AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE"],
    [runtimeConfig.auth.creatorAuthAllowPreviewTwitter, "CREATOR_AUTH_ALLOW_PREVIEW_TWITTER"],
    [runtimeConfig.managedWallet.ephemeralSessionsEnabled, "EPHEMERAL_SESSIONS_ENABLED"],
    [
      runtimeConfig.managedWallet.publicExecutionEnabled,
      "PUBLIC_MANAGED_WALLET_EXECUTION_ENABLED",
    ],
    [runtimeConfig.pilot.engagementRewardsEnabled, "ENGAGEMENT_REWARDS_ENABLED"],
    [runtimeConfig.pilot.s1PublicApiEnabled, "S1_PUBLIC_API_ENABLED"],
    [runtimeConfig.pilot.track2Enabled, "TRACK2_ENABLED"],
    [runtimeConfig.pilot.track3Enabled, "TRACK3_ENABLED"],
    [runtimeConfig.pilot.emailAuthEnabled, "EMAIL_AUTH_ENABLED"],
    [runtimeConfig.pilot.track2MetricIngestionEnabled, "TRACK2_METRIC_INGESTION_ENABLED"],
    [runtimeConfig.pilot.prototypeRoutesEnabled, "PROTOTYPE_ROUTES_ENABLED"],
    [runtimeConfig.s1.mockApiEnabled, "S1_MOCK_API_ENABLED"],
    [runtimeConfig.oracle.schedulerEnabled, "ORACLE_SCHEDULER_ENABLED"],
    [runtimeConfig.oracle.runOnBoot, "ORACLE_RUN_ON_BOOT"],
    [runtimeConfig.oracle.track2AutoSettlementEnabled, "ORACLE_TRACK2_AUTO_SETTLEMENT_ENABLED"],
    [runtimeConfig.oracle.track3AutoSettlementEnabled, "ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED"],
  ];

  return forbiddenPilotFeatures
    .filter(([enabled]) => enabled)
    .map(([, variableName]) => variableName);
};

export const isPilotRuntimeSafetyRequired = (
  runtimeConfig: typeof config,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  runtimeEnvironment: NodeJS.ProcessEnv = process.env
): boolean => {
  const explicitPilotRuntime =
    runtimeEnvironment.PILOT_INVITE_ONLY !== undefined && runtimeConfig.pilot.inviteOnly;
  const hostedRuntime =
    runtimeEnvironment.RENDER === "true" ||
    Boolean(runtimeEnvironment.K_SERVICE) ||
    Boolean(runtimeEnvironment.RAILWAY_ENVIRONMENT);

  return nodeEnv === "production" || explicitPilotRuntime || hostedRuntime;
};

const FULL_GIT_COMMIT_SHA = /^[0-9a-fA-F]{40}$/;

export const isHostedPilotRuntime = (
  runtimeEnvironment: NodeJS.ProcessEnv = process.env
): boolean =>
  runtimeEnvironment.RENDER === "true" ||
  Boolean(runtimeEnvironment.K_SERVICE) ||
  Boolean(runtimeEnvironment.RAILWAY_ENVIRONMENT);

export const getHostedPilotRuntimeFailures = (
  runtimeEnvironment: NodeJS.ProcessEnv = process.env,
  nodeVersion: string = process.versions.node
): string[] => {
  if (!isHostedPilotRuntime(runtimeEnvironment)) {
    return [];
  }

  const failures: string[] = [];
  const nodeMajor = Number.parseInt(nodeVersion.split(".")[0] ?? "", 10);
  if (nodeMajor !== 22) {
    failures.push("Hosted Pilot runtime requires Node.js major 22");
  }

  const expectedReleaseSha = runtimeEnvironment.PILOT_EXPECTED_RELEASE_SHA?.trim() ?? "";
  if (!FULL_GIT_COMMIT_SHA.test(expectedReleaseSha)) {
    failures.push(
      "PILOT_EXPECTED_RELEASE_SHA must be a complete 40-character hexadecimal Git commit SHA on hosted Pilot runtimes"
    );
  }

  if (runtimeEnvironment.RENDER === "true") {
    const renderGitCommit = runtimeEnvironment.RENDER_GIT_COMMIT?.trim() ?? "";
    if (!FULL_GIT_COMMIT_SHA.test(renderGitCommit)) {
      failures.push(
        "RENDER_GIT_COMMIT must be a complete 40-character hexadecimal Git commit SHA"
      );
    } else if (
      FULL_GIT_COMMIT_SHA.test(expectedReleaseSha) &&
      expectedReleaseSha !== renderGitCommit
    ) {
      failures.push("PILOT_EXPECTED_RELEASE_SHA must exactly match RENDER_GIT_COMMIT");
    }
  }

  if (runtimeEnvironment.RAILWAY_ENVIRONMENT) {
    const railwayGitCommit = runtimeEnvironment.RAILWAY_GIT_COMMIT_SHA?.trim() ?? "";
    if (
      railwayGitCommit &&
      (!FULL_GIT_COMMIT_SHA.test(railwayGitCommit) || expectedReleaseSha !== railwayGitCommit)
    ) {
      failures.push(
        "PILOT_EXPECTED_RELEASE_SHA must exactly match the complete RAILWAY_GIT_COMMIT_SHA when Railway provides it"
      );
    }
  }

  return failures;
};

const validateProductionConfig = (runtimeConfig: typeof config): void => {
  if (!isPilotRuntimeSafetyRequired(runtimeConfig)) {
    return;
  }

  const failures: string[] = [];
  const warnings: string[] = [];

  failures.push(...getHostedPilotRuntimeFailures());

  if (runtimeConfig.auth.sessionSecret === DEFAULT_AUTH_SESSION_SECRET) {
    failures.push("AUTH_SESSION_SECRET must be set to a non-default value");
  } else if (runtimeConfig.auth.sessionSecret.length < 32) {
    failures.push("AUTH_SESSION_SECRET must be at least 32 characters");
  }

  if (runtimeConfig.app.corsAllowedOrigins.length === 0) {
    failures.push("CORS_ALLOWED_ORIGINS must include at least one frontend origin");
  }

  try {
    const apiBaseUrl = new URL(runtimeConfig.app.apiBaseUrl);
    if (apiBaseUrl.protocol !== "https:" || apiBaseUrl.hostname === "localhost") {
      failures.push("API_BASE_URL must be a public HTTPS URL for the Pilot runtime");
    }
  } catch (_error) {
    failures.push("API_BASE_URL must be a valid public HTTPS URL for the Pilot runtime");
  }

  if (!runtimeConfig.auth.internalOperatorApiKey?.trim()) {
    failures.push("INTERNAL_OPERATOR_API_KEY is required for controlled Pilot operations");
  } else if (runtimeConfig.auth.internalOperatorApiKey.trim().length < 32) {
    failures.push("INTERNAL_OPERATOR_API_KEY must be at least 32 characters");
  }

  if (runtimeConfig.pilot.emailAuthEnabled && runtimeConfig.email.deliveryMode === "console") {
    failures.push("EMAIL_DELIVERY_MODE=console is not allowed in production");
  }

  for (const variableName of getEnabledForbiddenPilotFeatures(runtimeConfig)) {
    failures.push(`${variableName}=true is not allowed in the invite-only Pilot`);
  }

  if (
    isManagedWalletEncryptionKeyRequired(runtimeConfig) &&
    !/^[0-9a-fA-F]{64}$/.test(runtimeConfig.managedWallet.encryptionKey)
  ) {
    failures.push(
      "MANAGED_WALLET_ENCRYPTION_KEY must be set to 64 hex chars; generate with `openssl rand -hex 32` and store it in Render Environment or a secret manager"
    );
  }

  if (!runtimeConfig.pilot.inviteOnly) {
    failures.push("PILOT_INVITE_ONLY=false is not allowed in production");
  }

  if (runtimeConfig.pilot.inviteWallets.length === 0) {
    failures.push("PILOT_INVITE_WALLETS must include at least one wallet in production");
  }

  if (!runtimeConfig.pilot.expectedUsdcMint) {
    failures.push("PILOT_EXPECTED_USDC_MINT must be set in production");
  }

  if (
    !Number.isFinite(runtimeConfig.pilot.chainPreflightTimeoutMs) ||
    runtimeConfig.pilot.chainPreflightTimeoutMs <= 0
  ) {
    failures.push("PILOT_CHAIN_PREFLIGHT_TIMEOUT_MS must be greater than zero");
  }

  if (!runtimeConfig.solana.isDevnet) {
    failures.push("SOLANA_IS_DEVNET=true is required for the devnet/test-USDC Pilot");
  }

  if (runtimeConfig.solana.txRpcEndpoint.includes("api.devnet.solana.com")) {
    failures.push(
      "SOLANA_TX_RPC_ENDPOINT must use a dedicated devnet RPC for Pilot transactions"
    );
  }

  if (
    runtimeConfig.indexer.enabled &&
    runtimeConfig.solana.indexerRpcEndpoint === runtimeConfig.solana.txRpcEndpoint
  ) {
    failures.push(
      "SOLANA_INDEXER_RPC_ENDPOINT must be separate from SOLANA_TX_RPC_ENDPOINT when INDEXER_ENABLED=true"
    );
  }

  if (!runtimeConfig.indexer.enabled) {
    failures.push("INDEXER_ENABLED=true is required for Pilot chain projections");
  }

  const r2 = runtimeConfig.storage.origin;
  const r2Delivery = runtimeConfig.storage.delivery;
  if (
    !r2.bucket.trim() ||
    !r2Delivery.bucket.trim() ||
    !r2.endpoint?.trim() ||
    !r2.accessKeyId?.trim() ||
    !r2.secretAccessKey?.trim() ||
    !r2Delivery.publicBaseUrl?.trim()
  ) {
    failures.push(
      "R2_BUCKET, R2_DELIVERY_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_BASE_URL are required"
    );
  }
  if (r2.bucket.trim() && r2.bucket.trim() === r2Delivery.bucket.trim()) {
    failures.push("R2_DELIVERY_BUCKET must differ from private R2_BUCKET");
  }
  if (r2Delivery.publicFeedUseSignedUrls) {
    failures.push("R2_PUBLIC_FEED_USE_SIGNED_URLS=true is not allowed for the Pilot public feed");
  }
  if (!Number.isFinite(r2.maxAssetSizeBytes) || r2.maxAssetSizeBytes <= 0) {
    failures.push("R2_MAX_ASSET_SIZE_BYTES must be greater than zero");
  }
  if (!Number.isFinite(r2.monthlyUploadLimitBytes) || r2.monthlyUploadLimitBytes <= 0) {
    failures.push("R2_MONTHLY_UPLOAD_LIMIT_BYTES must enforce a positive Pilot upload budget");
  }

  if (
    !process.env.MUX_TOKEN_ID?.trim() ||
    !process.env.MUX_TOKEN_SECRET?.trim() ||
    !process.env.MUX_WEBHOOK_SECRET?.trim()
  ) {
    failures.push("MUX_TOKEN_ID, MUX_TOKEN_SECRET, and MUX_WEBHOOK_SECRET are required");
  }
  if (!runtimeConfig.mux.reconciliation.enabled) {
    failures.push("MUX_RECONCILIATION_ENABLED=true is required for Pilot media recovery");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.includes("-pooler.")) {
    warnings.push("DATABASE_URL should use the Neon pooled endpoint host containing -pooler");
  }
  if (!/[?&]connection_limit=([5-9]|10)(&|$)/.test(databaseUrl)) {
    warnings.push("DATABASE_URL should include connection_limit=5-10 for the Render demo backend");
  }
  if (!/[?&]pool_timeout=([5-9]|10)(&|$)/.test(databaseUrl)) {
    warnings.push("DATABASE_URL should include pool_timeout=5-10 for the Render demo backend");
  }

  if (failures.length > 0) {
    throw new Error(`Invalid production configuration: ${failures.join("; ")}`);
  }

  if (warnings.length > 0) {
    console.warn(`Production configuration warning: ${warnings.join("; ")}`);
  }
};

validateProductionConfig(config);
