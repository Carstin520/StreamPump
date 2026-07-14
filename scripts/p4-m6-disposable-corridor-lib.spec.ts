import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  assertSeparatedRoles,
  assertTokenAccountIdentity,
  buildPilotTestReport,
  calculateCreatorFundingFloor,
  calculateCreatorRecoveryTopUp,
  extractKeypairBytes,
  M6_CONSTANTS,
  parseDedicatedRpcEnv,
  parseM6Args,
} from "./p4-m6-disposable-corridor-lib";

const requiredArgs = [
  "--rpc-env-path", "/private/rpc.env",
  "--fee-payer-path", "/private/fee.json",
  "--admin-mint-authority-path", "/private/admin.json",
  "--oracle-authority-path", "/private/oracle.json",
  "--creator-path", "/private/creator.json",
  "--sponsor-path", "/private/sponsor.json",
  "--evidence-path", "/private/evidence.json",
  "--run-id", "p4m6-test-001",
  "--creator-target-lamports", "20000000",
  "--sponsor-target-lamports", "10000000",
  "--max-creator-starting-lamports", "0",
  "--max-sponsor-starting-lamports", "0",
  "--max-actor-starting-test-usdc-raw", "0",
  "--mint-test-usdc-raw", "1000000",
  "--sponsor-test-usdc-raw", "1000000",
];

const expectFailure = (operation: () => unknown, pattern: RegExp) =>
  assert.throws(operation, pattern);

const dryRun = parseM6Args(requiredArgs);
assert.equal(dryRun.execute, false);
assert.equal(dryRun.resumeExistingEvidence, false);
assert.equal(dryRun.mintTestUsdcRaw, 1_000_000n);

expectFailure(
  () => parseM6Args([...requiredArgs, "--execute"]),
  /requires --acknowledge-irreversible/
);
const execute = parseM6Args([
  ...requiredArgs,
  "--execute",
  "--acknowledge-irreversible",
  M6_CONSTANTS.irreversibleAcknowledgement,
]);
assert.equal(execute.execute, true);
const resumeDryRun = parseM6Args([...requiredArgs, "--resume-existing-evidence"]);
assert.equal(resumeDryRun.resumeExistingEvidence, true);
assert.equal(resumeDryRun.execute, false);
const resumeExecute = parseM6Args([
  ...requiredArgs,
  "--resume-existing-evidence",
  "--execute",
  "--acknowledge-irreversible",
  M6_CONSTANTS.irreversibleAcknowledgement,
]);
assert.equal(resumeExecute.resumeExistingEvidence, true);
assert.equal(resumeExecute.execute, true);
expectFailure(
  () => parseM6Args([...requiredArgs, "--resume-existing-evidence", "--resume-existing-evidence"]),
  /duplicate argument/
);
expectFailure(
  () =>
    parseM6Args([
      ...requiredArgs.slice(0, -1),
      "4000000",
    ]),
  /must match/
);
expectFailure(() => parseM6Args([...requiredArgs, "--unknown", "value"]), /unsupported/);

assert.equal(
  calculateCreatorFundingFloor({
    creatorProfileRentLamports: 2_721_360n,
    systemWalletRentLamports: 890_880n,
  }),
  3_612_240n
);
assert.equal(
  calculateCreatorRecoveryTopUp({
    currentLamports: 3_000_000n,
    creatorProfileRentLamports: 2_721_360n,
    systemWalletRentLamports: 890_880n,
  }),
  612_240n
);
assert.equal(
  calculateCreatorRecoveryTopUp({
    currentLamports: 3_612_240n,
    creatorProfileRentLamports: 2_721_360n,
    systemWalletRentLamports: 890_880n,
  }),
  0n
);
assert.equal(M6_CONSTANTS.creatorProfileAccountSpace, 263);
assert.equal(M6_CONSTANTS.upgradeReceiptAccountSpace, 164);
const excessiveSolArgs = [...requiredArgs];
excessiveSolArgs[excessiveSolArgs.indexOf("--creator-target-lamports") + 1] = "50000001";
expectFailure(() => parseM6Args(excessiveSolArgs), /fixed disposable Pilot safety cap/);
const exactUsdcCapArgs = [...requiredArgs];
exactUsdcCapArgs[exactUsdcCapArgs.indexOf("--mint-test-usdc-raw") + 1] = "25000000";
exactUsdcCapArgs[exactUsdcCapArgs.indexOf("--sponsor-test-usdc-raw") + 1] = "25000000";
assert.equal(parseM6Args(exactUsdcCapArgs).mintTestUsdcRaw, 25_000_000n);
const excessiveUsdcArgs = [...exactUsdcCapArgs];
excessiveUsdcArgs[excessiveUsdcArgs.indexOf("--mint-test-usdc-raw") + 1] = "25000001";
excessiveUsdcArgs[excessiveUsdcArgs.indexOf("--sponsor-test-usdc-raw") + 1] = "25000001";
expectFailure(() => parseM6Args(excessiveUsdcArgs), /fixed disposable Pilot safety cap/);

assert.equal(
  parseDedicatedRpcEnv("# private file\nexport PILOT_TX_RPC_URL='https://solana-devnet.example/v2/key'\n"),
  "https://solana-devnet.example/v2/key"
);
expectFailure(
  () => parseDedicatedRpcEnv("PILOT_TX_RPC_URL=https://api.devnet.solana.com\n"),
  /dedicated devnet RPC/
);
expectFailure(
  () => parseDedicatedRpcEnv("PILOT_TX_RPC_URL=https://devnet.example\nOTHER=x\n"),
  /may contain only/
);

const bytes = Array.from({ length: 64 }, (_, index) => index);
assert.deepEqual(Array.from(extractKeypairBytes(bytes, "direct")), bytes);
assert.deepEqual(Array.from(extractKeypairBytes({ secretKey: bytes }, "direct")), bytes);
assert.deepEqual(Array.from(extractKeypairBytes({ oracle: { secretKey: bytes } }, "oracle")), bytes);
expectFailure(
  () => extractKeypairBytes({ oracle: { secretKey: [1, 2] } }, "oracle"),
  /approved 64-byte signer format/
);

assert.doesNotThrow(() =>
  assertSeparatedRoles({ feePayer: "fee", admin: "admin", oracle: "oracle", creator: "creator", sponsor: "sponsor" })
);
expectFailure(
  () => assertSeparatedRoles({ creator: "same", sponsor: "same" }),
  /sponsor must be distinct from creator/
);
assert.doesNotThrow(() =>
  assertTokenAccountIdentity({
    label: "creator ATA",
    owner: "creator",
    mint: "mint",
    expectedOwner: "creator",
    expectedMint: "mint",
  })
);
expectFailure(
  () =>
    assertTokenAccountIdentity({
      label: "creator ATA",
      owner: "sponsor",
      mint: "mint",
      expectedOwner: "creator",
      expectedMint: "mint",
    }),
  /creator ATA owner\/mint mismatch/
);

const report = buildPilotTestReport({
  runId: "p4m6-test-001",
  creator: "creator",
  creatorProfile: "profile",
  metricValue: 500,
  observedAt: 1_700_000_000,
});
const replay = buildPilotTestReport({
  runId: "p4m6-test-001",
  creator: "creator",
  creatorProfile: "profile",
  metricValue: 500,
  observedAt: 1_700_000_000,
});
assert.equal(report.digestHex, replay.digestHex);
assert.equal(report.reportIdHex, replay.reportIdHex);
assert.match(String(report.report.classification), /PILOT TEST ONLY/);
assert.match(String(report.report.classification), /NOT A REAL METRIC/);
assert.equal(report.digestHex.length, 64);
assert.equal(report.reportIdHex.length, 64);

const implementation = readFileSync(
  path.join(__dirname, "p4-m6-prepare-disposable-corridor.ts"),
  "utf8"
);
const stateSource = readFileSync(
  path.join(__dirname, "../programs/streampump-core/src/state.rs"),
  "utf8"
);
const registerCreatorSource = readFileSync(
  path.join(__dirname, "../programs/streampump-core/src/instructions/register_creator.rs"),
  "utf8"
);
const upgradeCreatorSource = readFileSync(
  path.join(__dirname, "../programs/streampump-core/src/instructions/upgrade_creator.rs"),
  "utf8"
);
assert.match(registerCreatorSource, /space\s*=\s*8\s*\+\s*CreatorProfile::INIT_SPACE/);
assert.match(upgradeCreatorSource, /space\s*=\s*8\s*\+\s*UpgradeReceipt::INIT_SPACE/);
assert.match(stateSource, /impl CreatorProfile\s*\{[\s\S]*?pub const INIT_SPACE: usize/);
assert.match(stateSource, /impl UpgradeReceipt\s*\{[\s\S]*?pub const INIT_SPACE: usize/);
assert.match(implementation, /M6_CONSTANTS\.creatorProfileAccountSpace/);
assert.match(implementation, /M6_CONSTANTS\.upgradeReceiptAccountSpace/);
assert.equal(implementation.includes('coder.size("CreatorProfile")'), false);
assert.equal(implementation.includes('coder.size("UpgradeReceipt")'), false);
assert.match(implementation, /postCreatorProfile\.owner\.equals\(programId\)/);
assert.match(implementation, /postCreatorProfile\.data\.length\s*!==\s*M6_CONSTANTS\.creatorProfileAccountSpace/);
assert.match(implementation, /coder\.accountDiscriminator\("CreatorProfile"\)/);
assert.match(implementation, /coder\.accountDiscriminator\("UpgradeReceipt"\)/);
assert.match(implementation, /postCreatorSol[\s\S]*creatorSystemWalletRent/);
assert.match(implementation, /test-USDC supply delta mismatch against original evidence baseline/);
assert.match(implementation, /fresh preparation requires all three test-USDC ATAs to be absent/);
assert.match(implementation, /fresh preparation requires unfunded disposable creator and sponsor wallets/);
assert.match(implementation, /\.registerCreator\(/);
assert.match(implementation, /\.upgradeCreator\(/);
assert.match(implementation, /constants\.O_NOFOLLOW/);
assert.match(implementation, /fstatSync\(descriptor\)/);
assert.match(implementation, /fsyncSync\(descriptor\)/);
assert.match(implementation, /fsyncSync\(parentDescriptor\)/);
const sendVerifiedStart = implementation.indexOf("const sendVerified");
const durablePreRecord = implementation.indexOf("writeEvidence(evidencePath, evidence);", sendVerifiedStart);
const broadcast = implementation.indexOf("connection.sendRawTransaction", sendVerifiedStart);
assert.ok(sendVerifiedStart >= 0 && durablePreRecord > sendVerifiedStart && broadcast > durablePreRecord);
for (const forbiddenCall of [
  ".buyS1Token(",
  ".sellS1Token(",
  ".createProposal(",
  ".endorseProposal(",
  ".settleTrack1Base(",
  ".settleTrack2(",
  ".settleTrack3Cps(",
]) {
  assert.equal(
    implementation.includes(forbiddenCall),
    false,
    `preparation script must not call ${forbiddenCall}`
  );
}

console.log("P4 M6 disposable corridor helper tests: PASS");
