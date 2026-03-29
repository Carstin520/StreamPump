/**
 * CN: Backend 运行时配置入口，集中读取环境变量并提供默认值。
 * EN: Runtime backend configuration entry that reads environment variables and applies defaults.
 */
import "./loadEnv";

export const config = {
  app: {
    apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4000/api/v1",
  },
  auth: {
    sessionSecret:
      process.env.AUTH_SESSION_SECRET ?? "dev-only-session-secret-change-me",
    challengeTtlSeconds: Number(process.env.AUTH_CHALLENGE_TTL_SECONDS ?? 600),
    sessionTtlSeconds: Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7),
    allowLegacyWalletHeader:
      String(process.env.AUTH_ALLOW_LEGACY_WALLET_HEADER ?? "false").toLowerCase() === "true",
  },
  solana: {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT ?? "https://api.devnet.solana.com",
    programId: process.env.STREAMPUMP_PROGRAM_ID ?? "EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre",
  },
  storage: {
    origin: {
      region: process.env.S3_REGION ?? "us-east-1",
      bucket: process.env.S3_BUCKET ?? "",
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    },
    edge: {
      region: process.env.R2_REGION ?? "auto",
      bucket: process.env.R2_BUCKET ?? "",
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    },
  },
  antiCheat: {
    maxRiskScore: Number(process.env.ANTICHEAT_MAX_RISK_SCORE ?? 45),
    ipWindowMs: Number(process.env.ANTICHEAT_IP_WINDOW_MS ?? 5 * 60 * 1000),
    minInteractionEvents: Number(process.env.ANTICHEAT_MIN_INTERACTIONS ?? 3),
  },
  chainlink: {
    sourceApiBaseUrl: process.env.CHAINLINK_SOURCE_API_BASE_URL ?? "https://api.example.com",
    gatewayUrl: process.env.CHAINLINK_GATEWAY_URL,
  },
};
