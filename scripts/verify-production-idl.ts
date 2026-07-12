import { readFileSync } from "fs";
import path from "path";
import { isDeepStrictEqual } from "util";

const EXPECTED_PROGRAM_ADDRESS = "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp";
const MIN_ACTIVE_INSTRUCTIONS = 35;
const REQUIRED_INSTRUCTIONS = [
  "create_proposal",
  "sponsor_fund",
  "settle_track1_base",
] as const;
const REQUIRED_ACCOUNT_TYPES = ["ProtocolConfig", "Proposal"] as const;

type NamedEntry = { name?: unknown };
type ProductionIdl = {
  address?: unknown;
  instructions?: unknown;
  accounts?: unknown;
  types?: unknown;
  errors?: unknown;
};

const fail = (message: string): never => {
  throw new Error(`Production IDL verification failed: ${message}`);
};

const requireNamedArray = (value: unknown, label: string): NamedEntry[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return fail(`${label} must be a non-empty array`);
  }

  if (value.some((entry) => !entry || typeof entry !== "object" || typeof entry.name !== "string")) {
    return fail(`${label} contains an entry without a name`);
  }

  return value as NamedEntry[];
};

const idlPath = path.resolve(
  process.cwd(),
  process.argv[2] ?? "backend/idl/streampump_core.json"
);
const readIdl = (filePath: string): ProductionIdl =>
  JSON.parse(readFileSync(filePath, "utf8")) as ProductionIdl;

const idl = readIdl(idlPath);

if (idl.address !== EXPECTED_PROGRAM_ADDRESS) {
  fail(`unexpected program address ${String(idl.address)}`);
}

const instructions = requireNamedArray(idl.instructions, "instructions");
if (instructions.length < MIN_ACTIVE_INSTRUCTIONS) {
  fail(`expected at least ${MIN_ACTIVE_INSTRUCTIONS} instructions, found ${instructions.length}`);
}

const instructionNames = new Set(instructions.map((entry) => entry.name));
for (const required of REQUIRED_INSTRUCTIONS) {
  if (!instructionNames.has(required)) {
    fail(`missing instruction ${required}`);
  }
}

const accounts = requireNamedArray(idl.accounts, "accounts");
const types = requireNamedArray(idl.types, "types");
requireNamedArray(idl.errors, "errors");

const accountNames = new Set(accounts.map((entry) => entry.name));
const typeNames = new Set(types.map((entry) => entry.name));
for (const required of REQUIRED_ACCOUNT_TYPES) {
  if (!accountNames.has(required) || !typeNames.has(required)) {
    fail(`missing ${required} account/type definition`);
  }
}

const authoritativePathArg = process.argv[3]?.trim();
let authoritativeMessage = "";
if (authoritativePathArg) {
  const authoritativePath = path.resolve(process.cwd(), authoritativePathArg);
  const authoritativeIdl = readIdl(authoritativePath);
  if (!isDeepStrictEqual(idl, authoritativeIdl)) {
    fail(
      `packaged IDL schema drifted from generated Anchor IDL ${authoritativePath}; regenerate backend/idl/streampump_core.json`
    );
  }
  authoritativeMessage = `; exact schema match ${authoritativePath}`;
}

console.log(
  `Verified production IDL ${idlPath}: ${instructions.length} instructions, ` +
    `${accounts.length} accounts, ${types.length} types${authoritativeMessage}.`
);
