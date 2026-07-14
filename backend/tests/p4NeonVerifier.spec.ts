import { expect } from "chai";
import path from "path";

import {
  assertPostMigrationDataInvariants,
  resolveMigrationsDir,
} from "../scripts/p4-verify-neon-migration";

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

  const impact = {
    verified_publications: "1",
    feed_eligible_manifests: "1",
    scoped_proposals: "13",
    scoped_proposals_with_publication_truth: "0",
    unverifiable_manifest_anchor_claims: "1",
    proposal_anchor_claims: "1",
  };

  it("allows legitimate post-migration pilot data during runtime deploys", () => {
    expect(() => assertPostMigrationDataInvariants(impact, "runtime")).not.to.throw();
  });

  it("preserves the point-in-time cleanup assertions for baseline verification", () => {
    expect(() =>
      assertPostMigrationDataInvariants(impact, "migration-baseline")
    ).to.throw("invariant failed: post VERIFIED publications");
  });

  it("rejects malformed runtime counts", () => {
    expect(() =>
      assertPostMigrationDataInvariants(
        { ...impact, verified_publications: "not-a-count" },
        "runtime"
      )
    ).to.throw("invariant failed: verified_publications count");
  });

  it("rejects impossible scoped publication truth counts", () => {
    expect(() =>
      assertPostMigrationDataInvariants(
        {
          ...impact,
          scoped_proposals: "1",
          scoped_proposals_with_publication_truth: "2",
        },
        "runtime"
      )
    ).to.throw("invariant failed: scoped proposal publication truth count");
  });
});
