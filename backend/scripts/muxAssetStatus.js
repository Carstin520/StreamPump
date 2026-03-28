/**
 * CN: 查询指定 Mux asset 的实时状态，用于排查 PREPARING 长时间不回写的问题。
 * EN: Inspect a Mux asset directly to debug cases where local state remains PREPARING.
 */
const path = require("path");

const dotenv = require("dotenv");
const Mux = require("@mux/mux-node").default;

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const assetId = process.argv[2];

if (!assetId) {
  console.error("usage: node scripts/muxAssetStatus.js <muxAssetId>");
  process.exit(1);
}

const client = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

client.video.assets
  .retrieve(assetId)
  .then((asset) => {
    console.log(
      JSON.stringify(
        {
          id: asset.id,
          status: asset.status,
          playback_ids: asset.playback_ids ?? [],
          errors: asset.errors ?? null,
          duration: asset.duration ?? null,
          aspect_ratio: asset.aspect_ratio ?? null,
          tracks: asset.tracks?.length ?? 0,
        },
        null,
        2
      )
    );
  })
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    process.exit(1);
  });
