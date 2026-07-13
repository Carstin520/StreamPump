import { createHash } from "crypto";
import { readFileSync, readdirSync } from "fs";
import path from "path";

type QueryResult<Row> = { rows: Row[] };
type PgClient = {
  connect: () => Promise<void>;
  query: <Row = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ) => Promise<QueryResult<Row>>;
  end: () => Promise<void>;
};

// `pg` is a backend runtime dependency. The repository intentionally has no
// @types/pg package, so keep the narrow interface needed by this operator tool
// local instead of changing the protected lockfile.
const { Client } = require("pg") as {
  Client: new (config: { connectionString: string; application_name: string }) => PgClient;
};

type Phase = "pre" | "post";

const expectedPending = new Map<string, string>([
  [
    "20260712120000_pilot_content_storage_truth",
    "e17c50e0c3fd244ce0e475e33c28376f9f8deaf7b840aa4b264f4125f7e57033",
  ],
  [
    "20260712130000_api_idempotency",
    "5ae3b523428a9d0614bb5ccde15d42c6bf2e8f6913fdfc3369088bc288f5d9ec",
  ],
  [
    "20260712150000_track1_settlement_audit",
    "2ec0a4c26e2338ee5ef7f3c9659b816b383d5d7231dfd814278adf1585df4fce",
  ],
  [
    "20260712160000_clear_unverifiable_anchor_transactions",
    "ce29f29ce3a0ad4a25542febfc9bc865e0d98c871308eda915f2f1d60a86d670",
  ],
  [
    "20260712170000_chain_ingestion_recovery",
    "56c75a158c9695b02a392deb647f64043e20ffd4d10b2d80ce7ff99a2c8d00ae",
  ],
  [
    "20260712180000_pilot_operator_events",
    "8537e8d57b565d1b7d4215854c9a7c9023482faca1f204d76e7acb5e9337408d",
  ],
]);

const expectedTables = [
  "ApiIdempotencyRecord",
  "ChainIngestionAttempt",
  "PilotOperatorEvent",
  "Track1SettlementOperation",
];

const expectedColumns = [
  "ContentAsset.objectEtag",
  "ContentAsset.storageVerificationError",
  "ContentAsset.storageVerifiedAt",
  "ContentAsset.verifiedSha256Hex",
  "ContentAsset.verifiedSizeBytes",
  "ContentPublication.rejectedAt",
  "ContentPublication.verificationEvidenceDigestHex",
  "ContentPublication.verificationNote",
  "ContentPublication.verificationReviewer",
];

const expectedIndexes = [
  "ApiIdempotencyRecord_resourceType_resourceId_idx",
  "ApiIdempotencyRecord_status_leaseExpiresAt_idx",
  "ApiIdempotencyRecord_wallet_method_scope_keyHash_key",
  "ChainIngestionAttempt_signature_key",
  "ChainIngestionAttempt_slot_idx",
  "ChainIngestionAttempt_status_updatedAt_idx",
  "PilotOperatorEvent_action_createdAt_idx",
  "PilotOperatorEvent_operatorIdentity_createdAt_idx",
  "PilotOperatorEvent_resourceType_resourceId_createdAt_idx",
  "Track1SettlementOperation_idempotencyKey_idx",
  "Track1SettlementOperation_proposalId_createdAt_idx",
  "Track1SettlementOperation_proposalPda_track_key",
  "Track1SettlementOperation_status_updatedAt_idx",
];

const expectedEnums: Record<string, string[]> = {
  ApiIdempotencyStatus: ["IN_PROGRESS", "SUCCEEDED", "FAILED"],
  ChainIngestionStatus: [
    "PROCESSING",
    "NOT_FOUND",
    "PRUNED",
    "TRANSACTION_FAILED",
    "NO_PROGRAM_INSTRUCTIONS",
    "SYNCED",
    "ERROR",
  ],
  SettlementTrack: ["TRACK1"],
  Track1SettlementOperationStatus: ["PENDING", "SUBMITTED", "CONFIRMED", "FAILED"],
};

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const normalizedNeonHost = (hostname: string): string => {
  const labels = hostname.toLowerCase().split(".");
  labels[0] = labels[0].replace(/-pooler$/, "");
  return labels.join(".");
};

const sorted = (values: string[]): string[] => [...values].sort();

const assertEqual = (actual: unknown, expected: unknown, label: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`invariant failed: ${label}`);
  }
};

const safeErrorCode = (error: unknown): string =>
  typeof error === "object" && error && "code" in error ? String(error.code) : "INVARIANT";

const localMigrationChecksums = (): Map<string, string> => {
  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
  const result = new Map<string, string>();
  for (const name of readdirSync(migrationsDir).sort()) {
    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    try {
      result.set(name, sha256(readFileSync(sqlPath)));
    } catch {
      // Prisma may place non-migration metadata beside migration directories.
    }
  }
  return result;
};

const main = async (): Promise<void> => {
  const phase = required("P4_M3_EXPECTED_PHASE") as Phase;
  if (phase !== "pre" && phase !== "post") throw new Error("invalid phase");

  const connectionString = required("DIRECT_URL");
  const pooledConnectionString = required("DATABASE_URL");

  const parsedUrl = new URL(connectionString);
  const parsedPooledUrl = new URL(pooledConnectionString);
  const expectedDatabase = required("P4_EXPECTED_NEON_DATABASE");
  const expectedHostSha256 = required("P4_EXPECTED_NEON_HOST_SHA256").toLowerCase();
  const expectedRoleSha256 = required("P4_EXPECTED_NEON_ROLE_SHA256").toLowerCase();
  const databaseFromUrl = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
  const pooledDatabaseFromUrl = decodeURIComponent(parsedPooledUrl.pathname.replace(/^\//, ""));
  const normalizedHost = normalizedNeonHost(parsedUrl.hostname);
  const normalizedPooledHost = normalizedNeonHost(parsedPooledUrl.hostname);
  const hostSha256 = sha256(normalizedHost);
  assertEqual(databaseFromUrl, expectedDatabase, "URL database");
  assertEqual(pooledDatabaseFromUrl, expectedDatabase, "pooled URL database");
  assertEqual(normalizedPooledHost, normalizedHost, "pooled/direct endpoint");
  assertEqual(hostSha256, expectedHostSha256, "URL host fingerprint");

  const localChecksums = localMigrationChecksums();
  assertEqual(localChecksums.size, 26, "local migration count");
  for (const [name, checksum] of expectedPending) {
    assertEqual(localChecksums.get(name), checksum, `local checksum ${name}`);
  }

  const client = new Client({
    connectionString,
    application_name: "streampump-p4-m3-readonly-verifier",
  });

  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");

    const identity = await client.query<{
      database_name: string;
      role_name: string;
      server_version: string;
      checked_at_utc: string;
    }>(`
      SELECT
        current_database() AS database_name,
        current_user AS role_name,
        current_setting('server_version') AS server_version,
        timezone('UTC', now())::text AS checked_at_utc
    `);
    assertEqual(identity.rows[0].database_name, expectedDatabase, "connected database");
    const roleSha256 = sha256(identity.rows[0].role_name);
    assertEqual(roleSha256, expectedRoleSha256, "connected role fingerprint");

    const migrations = await client.query<{
      migration_name: string;
      checksum: string;
      finished: boolean;
      rolled_back: boolean;
      applied_steps_count: number;
    }>(`
      SELECT
        migration_name,
        checksum,
        finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS rolled_back,
        applied_steps_count
      FROM "_prisma_migrations"
      ORDER BY migration_name
    `);

    const failed = migrations.rows.filter((row) => !row.finished && !row.rolled_back);
    const rolledBack = migrations.rows.filter((row) => row.rolled_back);
    assertEqual(failed.length, 0, "failed migrations");
    assertEqual(rolledBack.length, 0, "rolled-back migrations");
    const applied = migrations.rows.filter((row) => row.finished && !row.rolled_back);
    assertEqual(applied.length, phase === "pre" ? 20 : 26, "applied migration count");
    for (const row of applied) {
      assertEqual(localChecksums.get(row.migration_name), row.checksum, `database checksum ${row.migration_name}`);
      assertEqual(row.applied_steps_count, 1, `applied step count ${row.migration_name}`);
    }
    for (const name of expectedPending.keys()) {
      assertEqual(
        applied.some((row) => row.migration_name === name),
        phase === "post",
        `pending migration presence ${name}`
      );
    }
    const expectedAppliedNames = [...localChecksums.keys()]
      .filter((name) => phase === "post" || !expectedPending.has(name))
      .sort();
    const appliedNames = applied.map((row) => row.migration_name).sort();
    assertEqual(appliedNames, expectedAppliedNames, "exact applied migration names");

    const clientBackends = await client.query<{ other_client_backends: string }>(`
      SELECT count(*)::text AS other_client_backends
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND backend_type = 'client backend'
    `);
    const otherClientBackends = clientBackends.rows[0].other_client_backends;
    if (process.env.P4_M3_REQUIRE_QUIESCED === "true") {
      assertEqual(otherClientBackends, "0", "other client backends during quiescence");
    }

    const impact = await client.query<{
      verified_publications: string;
      feed_eligible_manifests: string;
      scoped_proposals: string;
      scoped_proposals_with_publication_truth: string;
      unverifiable_manifest_anchor_claims: string;
      proposal_anchor_claims: string;
      verified_publications_digest: string;
      feed_eligible_digest: string;
      scoped_proposals_digest: string;
      unverifiable_manifest_anchor_digest: string;
    }>(`
      SELECT
        (SELECT count(*) FROM "ContentPublication" WHERE "verificationStatus" = 'VERIFIED')::text AS verified_publications,
        (SELECT count(*) FROM "ContentManifest" WHERE "isPublicFeedEligible" = true)::text AS feed_eligible_manifests,
        (SELECT count(*) FROM "Proposal" WHERE "status" IN ('OPEN','FUNDED') AND "track1Claimed" = false)::text AS scoped_proposals,
        (SELECT count(*) FROM "Proposal" WHERE "status" IN ('OPEN','FUNDED') AND "track1Claimed" = false AND "contentPublishedVerifiedAt" IS NOT NULL)::text AS scoped_proposals_with_publication_truth,
        (
          SELECT count(*) FROM "ContentManifest" m
          WHERE m."currentAnchorTx" IS NOT NULL
            AND (m."currentAnchorPda" IS NULL OR NOT EXISTS (
              SELECT 1 FROM "ChainEvent" e
              WHERE e."signature" = m."currentAnchorTx"
                AND e."instructionName" = 'anchor_content_hash'
                AND e."entityPda" = m."currentAnchorPda"
            ))
        )::text AS unverifiable_manifest_anchor_claims,
        (SELECT count(*) FROM "Proposal" WHERE "contentAnchorTx" IS NOT NULL)::text AS proposal_anchor_claims,
        coalesce((SELECT md5(string_agg(concat_ws('|', "id", "manifestId", "platform", "externalUrl"), E'\\n' ORDER BY "id")) FROM "ContentPublication" WHERE "verificationStatus" = 'VERIFIED'), md5('')) AS verified_publications_digest,
        coalesce((SELECT md5(string_agg(concat_ws('|', "id", "status"::text, coalesce("currentAnchorPda", '')), E'\\n' ORDER BY "id")) FROM "ContentManifest" WHERE "isPublicFeedEligible" = true), md5('')) AS feed_eligible_digest,
        coalesce((SELECT md5(string_agg(concat_ws('|', "id", "status"::text, "track1Claimed"::text, coalesce("contentPublishedVerifiedAt"::text, '')), E'\\n' ORDER BY "id")) FROM "Proposal" WHERE "status" IN ('OPEN','FUNDED') AND "track1Claimed" = false), md5('')) AS scoped_proposals_digest,
        coalesce((
          SELECT md5(string_agg(concat_ws('|', m."id", m."currentAnchorTx", coalesce(m."currentAnchorPda", '')), E'\\n' ORDER BY m."id"))
          FROM "ContentManifest" m
          WHERE m."currentAnchorTx" IS NOT NULL
            AND (m."currentAnchorPda" IS NULL OR NOT EXISTS (
              SELECT 1 FROM "ChainEvent" e
              WHERE e."signature" = m."currentAnchorTx"
                AND e."instructionName" = 'anchor_content_hash'
                AND e."entityPda" = m."currentAnchorPda"
            ))
        ), md5('')) AS unverifiable_manifest_anchor_digest
    `);

    if (phase === "post") {
      assertEqual(impact.rows[0].verified_publications, "0", "post VERIFIED publications");
      assertEqual(impact.rows[0].feed_eligible_manifests, "0", "post feed eligibility");
      assertEqual(
        impact.rows[0].scoped_proposals_with_publication_truth,
        "0",
        "post scoped proposal publication truth"
      );
      assertEqual(
        impact.rows[0].unverifiable_manifest_anchor_claims,
        "0",
        "post unverifiable manifest anchor claims"
      );
      assertEqual(impact.rows[0].proposal_anchor_claims, "0", "post proposal anchor claims");
    }

    let schemaEvidence: Record<string, unknown> | null = null;
    if (phase === "post") {
      const tables = await client.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name
      `, [expectedTables]);
      assertEqual(tables.rows.map((row) => row.table_name), expectedTables, "new tables");

      const columns = await client.query<{ qualified_name: string }>(`
        SELECT table_name || '.' || column_name AS qualified_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name || '.' || column_name) = ANY($1::text[])
        ORDER BY qualified_name
      `, [expectedColumns]);
      assertEqual(columns.rows.map((row) => row.qualified_name), sorted(expectedColumns), "new columns");

      const indexes = await client.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])
        ORDER BY indexname
      `, [expectedIndexes]);
      assertEqual(indexes.rows.map((row) => row.indexname), sorted(expectedIndexes), "new indexes");

      const enums = await client.query<{ enum_name: string; labels: string[] }>(`
        SELECT t.typname AS enum_name,
               array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[] AS labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = ANY($1::text[])
        GROUP BY t.typname
        ORDER BY t.typname
      `, [Object.keys(expectedEnums)]);
      assertEqual(
        Object.fromEntries(enums.rows.map((row) => [row.enum_name, row.labels])),
        Object.fromEntries(Object.entries(expectedEnums).sort(([a], [b]) => a.localeCompare(b))),
        "new enums"
      );

      const foreignKey = await client.query<{ count: string }>(`
        SELECT count(*)::text AS count
        FROM pg_constraint c
        JOIN pg_class r ON r.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = 'public'
          AND r.relname = 'Track1SettlementOperation'
          AND c.conname = 'Track1SettlementOperation_proposalId_fkey'
          AND c.contype = 'f'
      `);
      assertEqual(foreignKey.rows[0].count, "1", "Track1 proposal foreign key");
      schemaEvidence = {
        tables: tables.rows.map((row) => row.table_name),
        columns: columns.rows.map((row) => row.qualified_name),
        indexes: indexes.rows.map((row) => row.indexname),
        enums: Object.fromEntries(enums.rows.map((row) => [row.enum_name, row.labels])),
        track1ProposalForeignKey: true,
      };
    }

    await client.query("ROLLBACK");
    const evidence = {
      ok: true,
      phase,
      target: {
        database: identity.rows[0].database_name,
        roleSha256,
        hostSha256,
        serverVersion: identity.rows[0].server_version,
      },
      checkedAtUtc: identity.rows[0].checked_at_utc,
      migrations: {
        localCount: localChecksums.size,
        appliedCount: applied.length,
        failedCount: failed.length,
        rolledBackCount: rolledBack.length,
        appliedChecksums: Object.fromEntries(
          applied
            .map((row) => [row.migration_name, row.checksum] as const)
            .sort(([a], [b]) => a.localeCompare(b))
        ),
        frozenPendingChecksums: Object.fromEntries(expectedPending),
      },
      quiescence: {
        required: process.env.P4_M3_REQUIRE_QUIESCED === "true",
        otherClientBackends,
      },
      data: impact.rows[0],
      schema: schemaEvidence,
    };
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may have failed before a transaction existed.
    }
    process.stderr.write(`${JSON.stringify({ ok: false, phase, errorCode: safeErrorCode(error) })}\n`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
};

void main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, errorCode: safeErrorCode(error) })}\n`);
  process.exitCode = 1;
});
