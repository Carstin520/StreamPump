/**
 * CN: Backend 运行时配置入口，集中读取环境变量并提供默认值。
 * EN: Runtime backend configuration entry that reads environment variables and applies defaults.
 */
import { env } from "./env";
import "./loadEnv";

export const config = {
  app: {
    apiBaseUrl: env.readString(process.env.API_BASE_URL, "http://localhost:4000/api/v1"),
    // CORS_ALLOWED_ORIGINS / 允许访问后端 API 的前端来源列表
    // CN: 生产环境建议显式填写逗号分隔的前端域名，例如 https://app.example.com。
    // EN: Comma-separated frontend origins allowed to call the backend API in production.
    corsAllowedOrigins: env.readCsv(process.env.CORS_ALLOWED_ORIGINS),
  },
  auth: {
    sessionSecret: env.readString(
      process.env.AUTH_SESSION_SECRET,
      "dev-only-session-secret-change-me"
    ),
    challengeTtlSeconds: env.readNumber(process.env.AUTH_CHALLENGE_TTL_SECONDS, 600),
    sessionTtlSeconds: env.readNumber(process.env.AUTH_SESSION_TTL_SECONDS, 60 * 60 * 24 * 7),
    allowLegacyWalletHeader: env.readBoolean(process.env.AUTH_ALLOW_LEGACY_WALLET_HEADER, false),
  },
  solana: {
    rpcEndpoint: env.readString(process.env.SOLANA_RPC_ENDPOINT, "https://api.devnet.solana.com"),
    programId: env.readString(
      process.env.STREAMPUMP_PROGRAM_ID,
      "EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre"
    ),
  },
  indexer: {
    enabled: env.readBoolean(process.env.INDEXER_ENABLED, true),
    backfillLimit: env.readNumber(process.env.INDEXER_BACKFILL_LIMIT, 100),
    consumerKey: env.readString(process.env.INDEXER_CONSUMER_KEY, "streampump_core_logs"),
  },
  mux: {
    reconciliation: {
      enabled: env.readBoolean(process.env.MUX_RECONCILIATION_ENABLED, true),
      runOnBoot: env.readBoolean(process.env.MUX_RECONCILIATION_RUN_ON_BOOT, true),
      cron: env.readString(process.env.MUX_RECONCILIATION_CRON, "*/10 * * * *"),
      batchSize: env.readNumber(process.env.MUX_RECONCILIATION_BATCH_SIZE, 50),
      staleMinutes: env.readNumber(process.env.MUX_RECONCILIATION_STALE_MINUTES, 5),
      maxAttempts: env.readNumber(process.env.MUX_RECONCILIATION_MAX_ATTEMPTS, 24),
    },
  },
  storage: {
    origin: {
      region: env.readString(process.env.S3_REGION, "us-east-1"),
      bucket: env.readString(process.env.S3_BUCKET, ""),
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
      publicFeedUseSignedUrls: env.readBoolean(process.env.S3_PUBLIC_FEED_USE_SIGNED_URLS, false),
    },
    edge: {
      region: env.readString(process.env.R2_REGION, "auto"),
      bucket: env.readString(process.env.R2_BUCKET, ""),
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
  chainlink: {
    sourceApiBaseUrl: env.readString(
      process.env.CHAINLINK_SOURCE_API_BASE_URL,
      "https://api.example.com"
    ),
    gatewayUrl: process.env.CHAINLINK_GATEWAY_URL,
  },
};
