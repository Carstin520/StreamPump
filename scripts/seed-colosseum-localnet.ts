/**
 * Seeds a local validator with the same S2-ready actors used by the Anchor tests.
 *
 * Run this only against a disposable localnet/devnet demo environment. It writes
 * generated demo keypairs under `.local/`, which is ignored by Git.
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { getTestContext } from "../programs/tests/helpers/test_context";

const keypairJson = (secretKey: Uint8Array) => Array.from(secretKey);

const main = async () => {
  const ctx = await getTestContext();
  const outputDir = path.resolve(process.cwd(), ".local");
  mkdirSync(outputDir, { recursive: true });

  const seed = {
    generatedAt: new Date().toISOString(),
    cluster: ctx.provider.connection.rpcEndpoint,
    programId: ctx.program.programId.toBase58(),
    protocolConfig: ctx.protocolConfig.toBase58(),
    usdcMint: ctx.usdcMint.toBase58(),
    spumpMint: ctx.spumpMint.toBase58(),
    oracle: {
      publicKey: ctx.oracle.publicKey.toBase58(),
      secretKey: keypairJson(ctx.oracle.secretKey),
    },
    creatorS2: {
      publicKey: ctx.creatorS2.publicKey.toBase58(),
      secretKey: keypairJson(ctx.creatorS2.secretKey),
      creatorProfilePda: ctx.deriveCreatorProfile(ctx.creatorS2.publicKey).toBase58(),
      usdcAta: ctx.creatorS2UsdcAta.toBase58(),
    },
    sponsorA: {
      publicKey: ctx.sponsorA.publicKey.toBase58(),
      secretKey: keypairJson(ctx.sponsorA.secretKey),
      usdcAta: ctx.sponsorAUsdcAta.toBase58(),
    },
    fanA: {
      publicKey: ctx.fanA.publicKey.toBase58(),
      secretKey: keypairJson(ctx.fanA.secretKey),
      usdcAta: ctx.fanAUsdcAta.toBase58(),
      spumpAta: ctx.fanASpumpAta.toBase58(),
    },
  };

  const outputPath = path.join(outputDir, "colosseum-demo-seed.json");
  writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`);

  console.log(`[demo-seed] wrote ${outputPath}`);
  console.log(`[demo-seed] creatorS2=${seed.creatorS2.publicKey}`);
  console.log(`[demo-seed] sponsorA=${seed.sponsorA.publicKey}`);
};

main().catch((error) => {
  console.error("[demo-seed] failed", error);
  process.exitCode = 1;
});
