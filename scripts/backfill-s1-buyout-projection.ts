import "../backend/config/loadEnv";

const targetCreator =
  process.env.DEMO_S1_CREATOR_WALLET?.trim() ||
  process.argv[2]?.trim() ||
  "EoMRsbLnHx21hMnY1KVzCL39WBTKLozLcRPt7SU2fVpg";

const main = async () => {
  const { reconcileGraduatedS1BuyoutProjection, getCreatorMarketProjection } = await import(
    "../backend/src/services/marketProjectionService"
  );
  const { prisma } = await import("../backend/src/services/prisma");

  try {
    const creatorWallet = targetCreator;
    const updated = await reconcileGraduatedS1BuyoutProjection(creatorWallet, {
      signature: "manual-s1-buyout-projection-backfill",
      observedAt: new Date(),
    });
    const projection = await getCreatorMarketProjection(creatorWallet);

    console.log(
      JSON.stringify(
        {
          creatorWallet,
          updated: Boolean(updated),
          buyout: projection?.buyout ?? null,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
