import { expect } from "chai";
import { ContentManifestStatus, ProposalStatus } from "@prisma/client";
import { spawnSync } from "child_process";
import path from "path";
import { Keypair } from "@solana/web3.js";

import { buildHealthPayload } from "../src/app";
import {
  config,
  getHostedPilotRuntimeFailures,
  getEnabledForbiddenPilotFeatures,
  isManagedWalletEncryptionKeyRequired,
  isPilotRuntimeSafetyRequired,
  normalizePilotInviteWallets,
} from "../config/default";
import { assertManifestAssetMutationAllowed } from "../src/controllers/contentManifestController";
import { HttpError } from "../src/controllers/http";
import {
  assertPilotTrackBudgetsAllowed,
  assertStoredIntentPilotTracksAllowed,
} from "../src/controllers/proposalIntentController";
import { manifestStatusAfterEligibilitySync } from "../src/services/contentPublicationEligibility";
import { proposalPublicationEligibilityWhere } from "../src/services/contentPublicationEligibility";
import {
  assertProductionPilotChainSafety,
  type PilotChainSafetyDependencies,
  SOLANA_DEVNET_GENESIS_HASH,
  withPilotChainTimeout,
} from "../src/services/pilotChainSafety";

describe("Pilot safety gates", () => {
  const testOracleAuthority = Keypair.generate().publicKey.toBase58();

  const runConfigImport = (env: Record<string, string | undefined>) => {
    const repoRoot = path.resolve(__dirname, "../..");
    return spawnSync(
      process.execPath,
      [
        "-r",
        "ts-node/register/transpile-only",
        "-e",
        "require('./backend/config/default')",
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          TS_NODE_PROJECT: "backend/tsconfig.test.json",
          ...env,
        },
        encoding: "utf8",
      }
    );
  };

  const validProductionEnv = (wallet: string): Record<string, string> => ({
    NODE_ENV: "production",
    API_BASE_URL: "https://api.example.com/api/v1",
    AUTH_SESSION_SECRET: "production-session-secret-for-tests",
    INTERNAL_OPERATOR_API_KEY: "production-operator-key-for-tests-123456",
    CORS_ALLOWED_ORIGINS: "https://app.example.com",
    DATABASE_URL:
      "postgresql://ep-example-pooler.ap-southeast-1.aws.neon.tech/streampump?sslmode=require&connection_limit=5&pool_timeout=5",
    MANAGED_WALLET_ENCRYPTION_KEY: "",
    PILOT_INVITE_ONLY: "true",
    PILOT_INVITE_WALLETS: wallet,
    PILOT_EXPECTED_USDC_MINT: Keypair.generate().publicKey.toBase58(),
    SOLANA_IS_DEVNET: "true",
    SOLANA_TX_RPC_ENDPOINT: "https://dedicated-rpc.example.com",
    SOLANA_INDEXER_RPC_ENDPOINT: "https://dedicated-indexer-rpc.example.com",
    INDEXER_ENABLED: "true",
    R2_BUCKET: "pilot-origin",
    R2_DELIVERY_BUCKET: "pilot-delivery",
    R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_PUBLIC_BASE_URL: "https://media.example.com",
    R2_MONTHLY_UPLOAD_LIMIT_BYTES: "10737418240",
    R2_PUBLIC_FEED_USE_SIGNED_URLS: "false",
    MUX_TOKEN_ID: "test-mux-token",
    MUX_TOKEN_SECRET: "test-mux-secret",
    MUX_WEBHOOK_SECRET: "test-mux-webhook-secret",
    MUX_RECONCILIATION_ENABLED: "true",
  });

  const captureError = async (operation: Promise<unknown>): Promise<Error> => {
    let caught: unknown;
    try {
      await operation;
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.instanceOf(Error);
    return caught as Error;
  };

  const pilotChainRuntimeConfig = (options?: {
    primaryRpc?: string;
    txRpc?: string;
    indexerRpc?: string;
    indexerEnabled?: boolean;
    expectedUsdcMint?: string;
    timeoutMs?: number;
  }): typeof config => ({
    ...config,
    solana: {
      ...config.solana,
      rpcEndpoint: options?.primaryRpc ?? "https://primary-rpc.example.com",
      txRpcEndpoint: options?.txRpc ?? "https://transaction-rpc.example.com",
      indexerRpcEndpoint: options?.indexerRpc ?? "https://indexer-rpc.example.com",
    },
    indexer: {
      ...config.indexer,
      enabled: options?.indexerEnabled ?? false,
    },
    pilot: {
      ...config.pilot,
      expectedUsdcMint:
        options?.expectedUsdcMint ?? Keypair.generate().publicKey.toBase58(),
      chainPreflightTimeoutMs: options?.timeoutMs ?? 321,
    },
  });

  it("reports every production-forbidden Pilot feature that is enabled", () => {
    const original = {
      ephemeral: config.managedWallet.ephemeralSessionsEnabled,
      engagement: config.pilot.engagementRewardsEnabled,
      track2: config.oracle.track2AutoSettlementEnabled,
      oracleRunOnBoot: config.oracle.runOnBoot,
    };

    try {
      config.managedWallet.ephemeralSessionsEnabled = true;
      config.pilot.engagementRewardsEnabled = true;
      config.oracle.track2AutoSettlementEnabled = true;
      config.oracle.runOnBoot = true;

      expect(getEnabledForbiddenPilotFeatures(config)).to.include.members([
        "EPHEMERAL_SESSIONS_ENABLED",
        "ENGAGEMENT_REWARDS_ENABLED",
        "ORACLE_TRACK2_AUTO_SETTLEMENT_ENABLED",
        "ORACLE_RUN_ON_BOOT",
      ]);
    } finally {
      config.managedWallet.ephemeralSessionsEnabled = original.ephemeral;
      config.pilot.engagementRewardsEnabled = original.engagement;
      config.oracle.track2AutoSettlementEnabled = original.track2;
      config.oracle.runOnBoot = original.oracleRunOnBoot;
    }
  });

  it("fails closed when Pilot media, projection, or operator infrastructure is missing", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const missing = runConfigImport({
      ...validProductionEnv(wallet),
      INTERNAL_OPERATOR_API_KEY: "",
      INDEXER_ENABLED: "false",
      R2_BUCKET: "",
      R2_DELIVERY_BUCKET: "",
      MUX_TOKEN_ID: "",
      MUX_RECONCILIATION_ENABLED: "false",
    });

    expect(missing.status).not.to.equal(0);
    const output = `${missing.stderr}${missing.stdout}`;
    expect(output).to.contain("INTERNAL_OPERATOR_API_KEY");
    expect(output).to.contain("INDEXER_ENABLED=true");
    expect(output).to.contain("R2_BUCKET");
    expect(output).to.contain("R2_DELIVERY_BUCKET");
    expect(output).to.contain("MUX_TOKEN_ID");
    expect(output).to.contain("MUX_RECONCILIATION_ENABLED=true");
  });

  it("requires distinct private origin and public delivery buckets", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const result = runConfigImport({
      ...validProductionEnv(wallet),
      R2_BUCKET: "same-bucket",
      R2_DELIVERY_BUCKET: "same-bucket",
    });
    expect(result.status).not.to.equal(0);
    expect(`${result.stderr}${result.stdout}`).to.contain(
      "R2_DELIVERY_BUCKET must differ from private R2_BUCKET"
    );
  });

  it("normalizes invite wallets and collapses duplicate entries", () => {
    const wallet = Keypair.generate().publicKey.toBase58();

    expect(normalizePilotInviteWallets([wallet, ` ${wallet} `])).to.deep.equal([wallet]);
  });

  it("rejects invalid configured invite wallet addresses during config parsing", () => {
    expect(() => normalizePilotInviteWallets(["not-a-wallet"])).to.throw(
      /PILOT_INVITE_WALLETS/
    );

    const result = runConfigImport({
      NODE_ENV: "development",
      PILOT_INVITE_WALLETS: "not-a-wallet",
    });
    expect(result.status).not.to.equal(0);
    expect(`${result.stderr}${result.stdout}`).to.contain("PILOT_INVITE_WALLETS");
  });

  it("fails fast in production when invite-only is disabled or the allowlist is empty", () => {
    const wallet = Keypair.generate().publicKey.toBase58();

    const disabled = runConfigImport({
      ...validProductionEnv(wallet),
      PILOT_INVITE_ONLY: "false",
    });
    expect(disabled.status).not.to.equal(0);
    expect(`${disabled.stderr}${disabled.stdout}`).to.contain("PILOT_INVITE_ONLY=false");

    const empty = runConfigImport({
      ...validProductionEnv(wallet),
      PILOT_INVITE_WALLETS: "",
    });
    expect(empty.status).not.to.equal(0);
    expect(`${empty.stderr}${empty.stdout}`).to.contain("PILOT_INVITE_WALLETS");
  });

  it("requires a valid expected Pilot USDC mint in production", () => {
    const wallet = Keypair.generate().publicKey.toBase58();

    const missing = runConfigImport({
      ...validProductionEnv(wallet),
      PILOT_EXPECTED_USDC_MINT: "",
    });
    expect(missing.status).not.to.equal(0);
    expect(`${missing.stderr}${missing.stdout}`).to.contain("PILOT_EXPECTED_USDC_MINT");

    const invalid = runConfigImport({
      ...validProductionEnv(wallet),
      PILOT_EXPECTED_USDC_MINT: "not-a-mint",
    });
    expect(invalid.status).not.to.equal(0);
    expect(`${invalid.stderr}${invalid.stdout}`).to.contain("PILOT_EXPECTED_USDC_MINT");
  });

  it("fails fast in production for weak session secrets or non-devnet configuration", () => {
    const wallet = Keypair.generate().publicKey.toBase58();

    const weakSecret = runConfigImport({
      ...validProductionEnv(wallet),
      AUTH_SESSION_SECRET: "too-short",
    });
    expect(weakSecret.status).not.to.equal(0);
    expect(`${weakSecret.stderr}${weakSecret.stdout}`).to.contain(
      "AUTH_SESSION_SECRET must be at least 32 characters"
    );

    const mainnet = runConfigImport({
      ...validProductionEnv(wallet),
      SOLANA_IS_DEVNET: "false",
    });
    expect(mainnet.status).not.to.equal(0);
    expect(`${mainnet.stderr}${mainnet.stdout}`).to.contain(
      "SOLANA_IS_DEVNET=true"
    );
  });

  it("does not require a managed-wallet encryption key when all managed-wallet features are closed", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const productionImport = runConfigImport(validProductionEnv(wallet));

    expect(productionImport.status).to.equal(0);

    const original = {
      preview: config.auth.allowPreviewProviderExchange,
      ephemeral: config.managedWallet.ephemeralSessionsEnabled,
      publicExecution: config.managedWallet.publicExecutionEnabled,
      email: config.pilot.emailAuthEnabled,
    };

    try {
      config.auth.allowPreviewProviderExchange = false;
      config.managedWallet.ephemeralSessionsEnabled = false;
      config.managedWallet.publicExecutionEnabled = false;
      config.pilot.emailAuthEnabled = false;
      expect(isManagedWalletEncryptionKeyRequired(config)).to.equal(false);

      config.managedWallet.publicExecutionEnabled = true;
      expect(isManagedWalletEncryptionKeyRequired(config)).to.equal(true);
    } finally {
      config.auth.allowPreviewProviderExchange = original.preview;
      config.managedWallet.ephemeralSessionsEnabled = original.ephemeral;
      config.managedWallet.publicExecutionEnabled = original.publicExecution;
      config.pilot.emailAuthEnabled = original.email;
    }
  });

  it("skips remote chain truth checks outside production", async () => {
    let dependencyCalls = 0;
    const dependencies: PilotChainSafetyDependencies = {
      async getGenesisHash() {
        dependencyCalls += 1;
        throw new Error("must not run");
      },
      async getProgramAccountInfo() {
        dependencyCalls += 1;
        throw new Error("must not run");
      },
      getLocalOracleAuthority() {
        dependencyCalls += 1;
        throw new Error("must not run");
      },
      async fetchProtocolConfigSafety() {
        dependencyCalls += 1;
        throw new Error("must not run");
      },
    };

    await assertProductionPilotChainSafety(
      pilotChainRuntimeConfig(),
      dependencies,
      "development"
    );
    expect(dependencyCalls).to.equal(0);
  });

  it("enforces the same static and chain gates for hosted or explicit Pilot runtimes", async () => {
    const runtimeConfig = pilotChainRuntimeConfig();
    runtimeConfig.pilot.inviteOnly = true;
    expect(
      isPilotRuntimeSafetyRequired(runtimeConfig, undefined, { RENDER: "true" })
    ).to.equal(true);
    expect(
      isPilotRuntimeSafetyRequired(runtimeConfig, "development", {
        PILOT_INVITE_ONLY: "true",
      })
    ).to.equal(true);

    let dependencyCalls = 0;
    const dependencies: PilotChainSafetyDependencies = {
      async getGenesisHash() {
        dependencyCalls += 1;
        return "not-devnet";
      },
      async getProgramAccountInfo() {
        dependencyCalls += 1;
        return { executable: true };
      },
      getLocalOracleAuthority() {
        dependencyCalls += 1;
        return testOracleAuthority;
      },
      async fetchProtocolConfigSafety() {
        dependencyCalls += 1;
        return {
          usdcMint: runtimeConfig.pilot.expectedUsdcMint,
          oracleAuthority: testOracleAuthority,
        };
      },
    };

    const hostedError = await captureError(
      assertProductionPilotChainSafety(runtimeConfig, dependencies, undefined, {
        RENDER: "true",
      })
    );
    expect(hostedError.message).to.match(/not Solana devnet/);
    expect(dependencyCalls).to.be.greaterThan(0);
  });

  it("fails closed on hosted Node or release identity drift without echoing supplied values", () => {
    const expectedReleaseSha = "a".repeat(40);
    const deployedReleaseSha = "b".repeat(40);
    const failures = getHostedPilotRuntimeFailures(
      {
        RENDER: "true",
        PILOT_EXPECTED_RELEASE_SHA: expectedReleaseSha,
        RENDER_GIT_COMMIT: deployedReleaseSha,
      },
      "20.10.0"
    );

    expect(failures).to.include("Hosted Pilot runtime requires Node.js major 22");
    expect(failures).to.include(
      "PILOT_EXPECTED_RELEASE_SHA must exactly match RENDER_GIT_COMMIT"
    );
    expect(failures.join(" ")).not.to.contain(expectedReleaseSha);
    expect(failures.join(" ")).not.to.contain(deployedReleaseSha);
  });

  it("accepts only an exact full Render release identity on Node 22", () => {
    const releaseSha = "0123456789abcdef0123456789abcdef01234567";
    expect(
      getHostedPilotRuntimeFailures(
        {
          RENDER: "true",
          PILOT_EXPECTED_RELEASE_SHA: releaseSha,
          RENDER_GIT_COMMIT: releaseSha,
        },
        "22.14.0"
      )
    ).to.deep.equal([]);

    const incomplete = getHostedPilotRuntimeFailures(
      {
        RENDER: "true",
        PILOT_EXPECTED_RELEASE_SHA: releaseSha.slice(0, 39),
        RENDER_GIT_COMMIT: releaseSha,
      },
      "22.14.0"
    );
    expect(incomplete.join(" ")).to.contain("complete 40-character hexadecimal");
  });

  it("requires release identity syntax but not Render metadata on other hosted runtimes", () => {
    const releaseSha = "c".repeat(40);
    expect(
      getHostedPilotRuntimeFailures(
        { K_SERVICE: "streampump", PILOT_EXPECTED_RELEASE_SHA: releaseSha },
        "22.0.0"
      )
    ).to.deep.equal([]);

    expect(
      getHostedPilotRuntimeFailures(
        { K_SERVICE: "streampump", PILOT_EXPECTED_RELEASE_SHA: "not-a-sha" },
        "22.0.0"
      ).join(" ")
    ).to.contain("PILOT_EXPECTED_RELEASE_SHA");
  });

  it("verifies every unique active RPC, the executable program, and protocol USDC mint", async () => {
    const sharedRpc = "https://shared-rpc.example.com/?api-key=secret";
    const indexerRpc = "https://indexer-rpc.example.com/?api-key=secret";
    const expectedUsdcMint = Keypair.generate().publicKey.toBase58();
    const runtimeConfig = pilotChainRuntimeConfig({
      primaryRpc: sharedRpc,
      txRpc: sharedRpc,
      indexerRpc,
      indexerEnabled: true,
      expectedUsdcMint,
      timeoutMs: 654,
    });
    const genesisCalls: Array<{ endpoint: string; timeoutMs: number }> = [];
    const programCalls: Array<{ endpoint: string; programId: string; timeoutMs: number }> = [];
    let protocolReads = 0;
    const protocolTimeouts: number[] = [];
    const dependencies: PilotChainSafetyDependencies = {
      async getGenesisHash(endpoint, timeoutMs) {
        genesisCalls.push({ endpoint, timeoutMs });
        return SOLANA_DEVNET_GENESIS_HASH;
      },
      async getProgramAccountInfo(endpoint, programId, timeoutMs) {
        programCalls.push({ endpoint, programId, timeoutMs });
        return { executable: true };
      },
      getLocalOracleAuthority() {
        return testOracleAuthority;
      },
      async fetchProtocolConfigSafety(timeoutMs) {
        protocolReads += 1;
        protocolTimeouts.push(timeoutMs);
        return { usdcMint: expectedUsdcMint, oracleAuthority: testOracleAuthority };
      },
    };

    expect(SOLANA_DEVNET_GENESIS_HASH).to.equal(
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
    );
    await assertProductionPilotChainSafety(runtimeConfig, dependencies, "production");

    expect(genesisCalls).to.have.deep.members([
      { endpoint: sharedRpc, timeoutMs: 654 },
      { endpoint: indexerRpc, timeoutMs: 654 },
    ]);
    expect(genesisCalls).to.have.length(2);
    expect(programCalls).to.deep.equal([
      {
        endpoint: sharedRpc,
        programId: runtimeConfig.solana.programId,
        timeoutMs: 654,
      },
    ]);
    expect(protocolReads).to.equal(1);
    expect(protocolTimeouts).to.deep.equal([654]);
  });

  it("rejects non-devnet or unavailable RPCs without leaking their URLs", async () => {
    const secretRpc = "https://rpc.example.com/?api-key=do-not-log";
    const runtimeConfig = pilotChainRuntimeConfig({
      primaryRpc: secretRpc,
      txRpc: secretRpc,
    });
    const baseDependencies: PilotChainSafetyDependencies = {
      async getGenesisHash() {
        return "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
      },
      async getProgramAccountInfo() {
        return { executable: true };
      },
      getLocalOracleAuthority() {
        return testOracleAuthority;
      },
      async fetchProtocolConfigSafety() {
        return {
          usdcMint: runtimeConfig.pilot.expectedUsdcMint,
          oracleAuthority: testOracleAuthority,
        };
      },
    };

    const mismatch = await captureError(
      assertProductionPilotChainSafety(runtimeConfig, baseDependencies, "production")
    );
    expect(mismatch.message).to.contain("is not Solana devnet");
    expect(mismatch.message).not.to.contain(secretRpc);
    expect(mismatch.message).not.to.contain("do-not-log");

    const unavailable = await captureError(
      assertProductionPilotChainSafety(
        runtimeConfig,
        {
          ...baseDependencies,
          async getGenesisHash(endpoint) {
            throw new Error(`RPC failed at ${endpoint}`);
          },
        },
        "production"
      )
    );
    expect(unavailable.message).to.contain("could not verify");
    expect(unavailable.message).not.to.contain(secretRpc);
    expect(unavailable.message).not.to.contain("do-not-log");
  });

  it("bounds chain truth requests with a real timeout", async () => {
    const error = await captureError(
      withPilotChainTimeout(new Promise<never>(() => undefined), 5)
    );
    expect(error.message).to.equal("chain preflight timed out");
  });

  it("rejects a missing or non-executable configured program on the transaction RPC", async () => {
    const secretRpc = "https://transaction.example.com/?api-key=do-not-log";
    const runtimeConfig = pilotChainRuntimeConfig({
      primaryRpc: secretRpc,
      txRpc: secretRpc,
    });
    const dependencyWithProgram = (
      programAccount: { executable: boolean } | null
    ): PilotChainSafetyDependencies => ({
      async getGenesisHash() {
        return SOLANA_DEVNET_GENESIS_HASH;
      },
      async getProgramAccountInfo() {
        return programAccount;
      },
      getLocalOracleAuthority() {
        return testOracleAuthority;
      },
      async fetchProtocolConfigSafety() {
        return {
          usdcMint: runtimeConfig.pilot.expectedUsdcMint,
          oracleAuthority: testOracleAuthority,
        };
      },
    });

    const missing = await captureError(
      assertProductionPilotChainSafety(
        runtimeConfig,
        dependencyWithProgram(null),
        "production"
      )
    );
    expect(missing.message).to.contain("not deployed");
    expect(missing.message).not.to.contain(secretRpc);

    const nonExecutable = await captureError(
      assertProductionPilotChainSafety(
        runtimeConfig,
        dependencyWithProgram({ executable: false }),
        "production"
      )
    );
    expect(nonExecutable.message).to.contain("not executable");
    expect(nonExecutable.message).not.to.contain(secretRpc);
  });

  it("rejects program lookup failures without leaking the transaction RPC URL", async () => {
    const secretRpc = "https://transaction.example.com/?api-key=do-not-log";
    const runtimeConfig = pilotChainRuntimeConfig({
      primaryRpc: secretRpc,
      txRpc: secretRpc,
    });
    const error = await captureError(
      assertProductionPilotChainSafety(
        runtimeConfig,
        {
          async getGenesisHash() {
            return SOLANA_DEVNET_GENESIS_HASH;
          },
          async getProgramAccountInfo(endpoint) {
            throw new Error(`RPC failed at ${endpoint}`);
          },
          getLocalOracleAuthority() {
            return testOracleAuthority;
          },
          async fetchProtocolConfigSafety() {
            return {
              usdcMint: runtimeConfig.pilot.expectedUsdcMint,
              oracleAuthority: testOracleAuthority,
            };
          },
        },
        "production"
      )
    );

    expect(error.message).to.contain("could not verify the configured program deployment");
    expect(error.message).not.to.contain(secretRpc);
    expect(error.message).not.to.contain("do-not-log");
  });

  it("rejects a ProtocolConfig USDC mint mismatch or unreadable state", async () => {
    const secretRpc = "https://primary.example.com/?api-key=do-not-log";
    const runtimeConfig = pilotChainRuntimeConfig({
      primaryRpc: secretRpc,
      txRpc: secretRpc,
    });
    const expectedUsdcMint = runtimeConfig.pilot.expectedUsdcMint;
    const dependencies: PilotChainSafetyDependencies = {
      async getGenesisHash() {
        return SOLANA_DEVNET_GENESIS_HASH;
      },
      async getProgramAccountInfo() {
        return { executable: true };
      },
      getLocalOracleAuthority() {
        return testOracleAuthority;
      },
      async fetchProtocolConfigSafety() {
        return {
          usdcMint: Keypair.generate().publicKey.toBase58(),
          oracleAuthority: testOracleAuthority,
        };
      },
    };

    const mismatch = await captureError(
      assertProductionPilotChainSafety(runtimeConfig, dependencies, "production")
    );
    expect(mismatch.message).to.contain("does not match PILOT_EXPECTED_USDC_MINT");
    expect(mismatch.message).not.to.contain(expectedUsdcMint);

    const unreadable = await captureError(
      assertProductionPilotChainSafety(
        runtimeConfig,
        {
          ...dependencies,
          async fetchProtocolConfigSafety() {
            throw new Error(`read failed via ${secretRpc}`);
          },
        },
        "production"
      )
    );
    expect(unreadable.message).to.contain("could not read the on-chain protocol configuration");
    expect(unreadable.message).not.to.contain(secretRpc);
    expect(unreadable.message).not.to.contain("do-not-log");
  });

  it("requires the manual Track 1 Oracle signer to match ProtocolConfig", async () => {
    const runtimeConfig = pilotChainRuntimeConfig();
    const onChainOracle = Keypair.generate().publicKey.toBase58();
    const baseDependencies: PilotChainSafetyDependencies = {
      async getGenesisHash() {
        return SOLANA_DEVNET_GENESIS_HASH;
      },
      async getProgramAccountInfo() {
        return { executable: true };
      },
      getLocalOracleAuthority() {
        return testOracleAuthority;
      },
      async fetchProtocolConfigSafety() {
        return {
          usdcMint: runtimeConfig.pilot.expectedUsdcMint,
          oracleAuthority: onChainOracle,
        };
      },
    };

    const mismatch = await captureError(
      assertProductionPilotChainSafety(runtimeConfig, baseDependencies, "production")
    );
    expect(mismatch.message).to.contain(
      "manual Track 1 Oracle signer does not match on-chain ProtocolConfig"
    );
    expect(mismatch.message).not.to.contain(testOracleAuthority);
    expect(mismatch.message).not.to.contain(onChainOracle);

    const missing = await captureError(
      assertProductionPilotChainSafety(
        runtimeConfig,
        {
          ...baseDependencies,
          getLocalOracleAuthority() {
            throw new Error("missing secret");
          },
        },
        "production"
      )
    );
    expect(missing.message).to.contain(
      "manual Track 1 Oracle signer is not configured or invalid"
    );
    expect(missing.message).not.to.contain("missing secret");
  });

  it("builds a minimal private health payload from the configured access policy", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const original = {
      inviteOnly: config.pilot.inviteOnly,
      inviteWallets: config.pilot.inviteWallets,
      scheduler: config.oracle.schedulerEnabled,
      releaseSha: config.app.releaseSha,
    };

    try {
      config.pilot.inviteOnly = true;
      config.pilot.inviteWallets = [wallet];
      config.oracle.schedulerEnabled = false;
      config.app.releaseSha = "0123456789abcdef0123456789abcdef01234567";

      expect(buildHealthPayload()).to.deep.equal({
        ok: true,
        releaseSha: "0123456789abcdef0123456789abcdef01234567",
        mode: "INVITE_ONLY_PILOT",
        automatedSettlement: false,
        accessPolicy: {
          configured: true,
          type: "invite_only",
        },
      });
      expect(JSON.stringify(buildHealthPayload())).not.to.contain(wallet);
      expect(buildHealthPayload()).not.to.have.property("publicFeatures");

      config.pilot.inviteWallets = [];
      expect(buildHealthPayload()).to.deep.equal({
        ok: true,
        releaseSha: "0123456789abcdef0123456789abcdef01234567",
        mode: "INVITE_POLICY_MISCONFIGURED",
        automatedSettlement: false,
        accessPolicy: {
          configured: false,
          type: "invite_only",
        },
      });
    } finally {
      config.pilot.inviteOnly = original.inviteOnly;
      config.pilot.inviteWallets = original.inviteWallets;
      config.oracle.schedulerEnabled = original.scheduler;
      config.app.releaseSha = original.releaseSha;
    }
  });

  it("allows asset mutation only before a manifest is finalized", () => {
    expect(() => assertManifestAssetMutationAllowed(ContentManifestStatus.DRAFT)).not.to.throw();
    expect(() => assertManifestAssetMutationAllowed(ContentManifestStatus.UPLOADING)).not.to.throw();

    for (const status of [
      ContentManifestStatus.READY,
      ContentManifestStatus.LOCKED,
      ContentManifestStatus.ANCHORED,
      ContentManifestStatus.PUBLISHED,
      ContentManifestStatus.ARCHIVED,
    ]) {
      expect(() => assertManifestAssetMutationAllowed(status)).to.throw(HttpError).with.property(
        "code",
        "MANIFEST_IMMUTABLE"
      );
    }
  });

  it("demotes an ineligible published manifest without erasing its anchor state", () => {
    expect(
      manifestStatusAfterEligibilitySync({
        currentStatus: ContentManifestStatus.PUBLISHED,
        publicFeedEligible: false,
        currentAnchorPda: "anchor-pda",
      })
    ).to.equal(ContentManifestStatus.ANCHORED);

    expect(
      manifestStatusAfterEligibilitySync({
        currentStatus: ContentManifestStatus.PUBLISHED,
        publicFeedEligible: false,
        currentAnchorPda: null,
      })
    ).to.equal(ContentManifestStatus.READY);
  });

  it("rejects Track 2 and Track 3 terms while those Pilot tracks are closed", () => {
    const closedTracks = {
      track2Enabled: false,
      track3Enabled: false,
      track2TargetValue: 0n,
      track2MinAchievementBps: 0,
      track2UsdcDeposited: 0n,
      maxEndorsementSpump: 0n,
      track3UsdcDeposited: 0n,
      track3DelayDays: 0,
    };

    expect(() => assertPilotTrackBudgetsAllowed(closedTracks)).not.to.throw();
    expect(() =>
      assertPilotTrackBudgetsAllowed({ ...closedTracks, track2UsdcDeposited: 1n })
    ).to.throw(HttpError).with.property("code", "TRACK2_CLOSED_FOR_PILOT");
    expect(() =>
      assertPilotTrackBudgetsAllowed({ ...closedTracks, track3DelayDays: 1 })
    ).to.throw(HttpError).with.property("code", "TRACK3_CLOSED_FOR_PILOT");

    expect(() =>
      assertStoredIntentPilotTracksAllowed({
        track2TargetValue: 0n,
        track2MinAchievementBps: 0,
        track2UsdcDeposited: 1n,
        maxEndorsementSpump: 0n,
        track3UsdcDeposited: 0n,
        track3DelayDays: 0,
      })
    ).to.throw(HttpError).with.property("code", "TRACK2_CLOSED_FOR_PILOT");
  });

  it("preserves publication verification on settled or resolved proposal history", () => {
    expect(proposalPublicationEligibilityWhere("manifest-1", false)).to.deep.equal({
      manifestId: "manifest-1",
      status: {
        in: [ProposalStatus.OPEN, ProposalStatus.FUNDED],
      },
      track1Claimed: false,
    });

    expect(proposalPublicationEligibilityWhere("manifest-1", true)).to.deep.equal({
      manifestId: "manifest-1",
      contentPublishedVerifiedAt: null,
    });
  });
});
