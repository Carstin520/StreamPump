import { expect } from "chai";
import path from "path";

import { resolveMigrationsDir } from "../scripts/p4-verify-neon-migration";

describe("P4 Neon migration verifier", () => {
  const backendRoot = path.resolve(__dirname, "..");
  const expectedMigrationsDir = path.join(backendRoot, "prisma", "migrations");

  it("resolves migrations when executed from the TypeScript source directory", () => {
    expect(resolveMigrationsDir(path.join(backendRoot, "scripts"))).to.equal(
      expectedMigrationsDir
    );
  });

  it("resolves migrations when executed from the compiled dist directory", () => {
    expect(resolveMigrationsDir(path.join(backendRoot, "dist", "scripts"))).to.equal(
      expectedMigrationsDir
    );
  });
});
