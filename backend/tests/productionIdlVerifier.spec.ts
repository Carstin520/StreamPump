import { expect } from "chai";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("production IDL verifier", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const verifierPath = path.join(repoRoot, "scripts/verify-production-idl.ts");
  const packagedIdlPath = path.join(repoRoot, "backend/idl/streampump_core.json");

  const runVerifier = (authoritativePath: string) =>
    spawnSync(
      path.join(repoRoot, "node_modules/.bin/ts-node"),
      [
        "--transpile-only",
        "--project",
        path.join(repoRoot, "tsconfig.json"),
        verifierPath,
        packagedIdlPath,
        authoritativePath,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_OPTIONS: "",
        },
        encoding: "utf8",
      }
    );

  it("accepts an exact generated schema and rejects any packaged schema drift", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "streampump-idl-"));
    try {
      const exactPath = path.join(directory, "exact.json");
      const driftedPath = path.join(directory, "drifted.json");
      const packaged = JSON.parse(readFileSync(packagedIdlPath, "utf8")) as {
        instructions: Array<Record<string, unknown>>;
      };
      writeFileSync(exactPath, JSON.stringify(packaged));
      writeFileSync(
        driftedPath,
        JSON.stringify({
          ...packaged,
          instructions: [
            { ...packaged.instructions[0], releaseDriftSentinel: true },
            ...packaged.instructions.slice(1),
          ],
        })
      );

      const exact = runVerifier(exactPath);
      expect(exact.status, `${exact.stderr}${exact.stdout}`).to.equal(0);

      const drifted = runVerifier(driftedPath);
      expect(drifted.status).not.to.equal(0);
      expect(`${drifted.stderr}${drifted.stdout}`).to.contain(
        "packaged IDL schema drifted from generated Anchor IDL"
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
