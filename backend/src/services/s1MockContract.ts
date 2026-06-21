import { config } from "../../config/default";

export const S1_MOCK_ACCESS_TOKEN = "mock-s1-demo";
export const S1_MOCK_USER_WALLET = "DemoWallet111111111111111111111111111111111";
export const DEMO_S1_CREATOR_WALLET =
  process.env.DEMO_S1_CREATOR_WALLET?.trim() ||
  process.env.NEXT_PUBLIC_DEMO_S1_CREATOR_WALLET?.trim() ||
  "EoMRsbLnHx21hMnY1KVzCL39WBTKLozLcRPt7SU2fVpg";

const nowIso = () => new Date().toISOString();
const DEMO_CREATOR_PROFILE_PDA = "demo-profile-mika-zhou";
const DEMO_BUYOUT_STATE_PDA = "demo-buyout-luna-cai";
const DEMO_SPONSOR_WALLET = "Sponsor111111111111111111111111111111111";

export const isS1MockApiEnabled = () => config.s1.mockApiEnabled;

export const isS1MockToken = (token: string | null | undefined) =>
  isS1MockApiEnabled() && token === S1_MOCK_ACCESS_TOKEN;

export const isS1MockWallet = (wallet: string | null | undefined) =>
  isS1MockApiEnabled() && wallet === S1_MOCK_USER_WALLET;

export const isDemoS1CreatorWallet = (wallet: string | null | undefined) =>
  isS1MockApiEnabled() && wallet === DEMO_S1_CREATOR_WALLET;

export const buildMockS1MarketProfile = () => {
  const updatedAt = nowIso();
  const latestOfferUsdc = String(850_000 * 1_000_000);

  return {
    creator: {
      creatorWallet: DEMO_S1_CREATOR_WALLET,
      creatorProfilePda: DEMO_CREATOR_PROFILE_PDA,
      handle: "mika-zhou",
      displayName: "胶片落进沙里",
      stage: "S1_DISCOVERY",
      level: 1,
      s1Supply: "1680",
      currentPriceSpump: String(2.08 * 1_000_000_000),
      nextPriceSpump: String(2.26 * 1_000_000_000),
      supporterPoolSpump: String(45_000 * 1_000_000_000),
      holderCount: 1600,
      graduationProgressBps: 5100,
      activeCampaignCount: 2,
      latestBuyoutOfferUsdc: latestOfferUsdc,
      acceptedBuyoutOfferUsdc: latestOfferUsdc,
      buyoutStatePda: DEMO_BUYOUT_STATE_PDA,
      metadata: {
        demo: true,
        routeCreatorId: "mika-zhou",
        niche: "film notes",
      },
      updatedAt,
    },
    buyout: {
      status: "EXECUTION_PENDING",
      buyoutStatePda: DEMO_BUYOUT_STATE_PDA,
      winningSponsorWallet: DEMO_SPONSOR_WALLET,
      acceptedOfferPda: "demo-offer-apex-motion",
      acceptedOfferUsdc: latestOfferUsdc,
      latestOfferPda: "demo-offer-apex-motion",
      latestOfferUsdc,
      usdcDeposited: latestOfferUsdc,
      creatorPayoutUsdc: String(680_000 * 1_000_000),
      discoveryPoolUsdc: String(170_000 * 1_000_000),
      discoveryPoolRemaining: String(124_000 * 1_000_000),
      eligibleHolderCount: 571,
      earlyHolderCount: 160,
      regularHolderCount: 411,
      rewardModelSnapshot: 1,
      residualToSnapshot: 0,
      discoveryRewardCapUsdc: String(25 * 1_000_000),
      statusThankyouUsdc: String(5 * 1_000_000),
      creatorPaid: false,
      claimableUsdcRemaining: String(124_000 * 1_000_000),
      claimableS1SupplyRemaining: "571",
      rageQuitDeadlineAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    },
    offers: [
      {
        buyoutOfferPda: "demo-offer-apex-motion",
        sponsorWallet: DEMO_SPONSOR_WALLET,
        usdcAmount: latestOfferUsdc,
        status: "ACCEPTED",
        sponsorCancelAfterAt: null,
      },
      {
        buyoutOfferPda: "demo-offer-gridline",
        sponsorWallet: "Gridline11111111111111111111111111111111",
        usdcAmount: String(720_000 * 1_000_000),
        status: "OUTBID",
        sponsorCancelAfterAt: null,
      },
    ],
    campaigns: [],
  };
};

export const buildMockS1Portfolio = (userWallet = S1_MOCK_USER_WALLET) => {
  const profile = buildMockS1MarketProfile();

  return {
    userWallet,
    positions: [
      {
        positionPda: "demo-position-s1",
        creatorWallet: DEMO_S1_CREATOR_WALLET,
        creatorProfilePda: profile.creator.creatorProfilePda,
        creator: profile.creator,
        internalTokenBalance: "120",
        spumpCostBasis: "288000000000",
        estimatedClaimableUsdc: profile.buyout.discoveryRewardCapUsdc,
        discoveryRewardClaimed: false,
        lastDiscoveryRewardUsdc: "0",
        discoveryRewardCapped: true,
        discoveryRewardEligible: true,
        updatedAt: profile.creator.updatedAt,
      },
    ],
  };
};

export const buildMockS1Transaction = (params: {
  action: string;
  creatorWallet?: string;
  userWallet?: string;
  sponsorWallet?: string;
  amount?: unknown;
}) => {
  const creatorWallet = params.creatorWallet || DEMO_S1_CREATOR_WALLET;
  const userWallet = params.userWallet || S1_MOCK_USER_WALLET;
  const sponsorWallet = params.sponsorWallet || DEMO_SPONSOR_WALLET;
  const payload = {
    action: params.action,
    amount: params.amount === undefined ? null : String(params.amount),
    creatorWallet,
    userWallet,
    mock: true,
  };

  return {
    action: params.action,
    submitMode: "CLIENT_RELAY" as const,
    transactionBase64: Buffer.from(JSON.stringify(payload)).toString("base64"),
    recentBlockhash: "mock-recent-blockhash-s1-demo",
    lastValidBlockHeight: "999999999",
    requiredSigners: [userWallet],
    derived: {
      protocolConfigPda: "mock-protocol-config",
      userProfilePda: `mock-user-profile-${userWallet.slice(0, 8)}`,
      creatorProfilePda: DEMO_CREATOR_PROFILE_PDA,
      s1PositionPda: "demo-position-s1",
      s1BuyoutStatePda: DEMO_BUYOUT_STATE_PDA,
      buyoutOfferPda: "demo-offer-apex-motion",
      offerUsdcVaultPda: sponsorWallet ? "demo-offer-usdc-vault" : null,
    },
  };
};

export const buildMockS1SubmitResponse = (signedTransactionBase64: string) => ({
  signature: `mock-s1-${Buffer.from(signedTransactionBase64 || "empty")
    .toString("base64url")
    .slice(0, 32)}`,
  projectionSync: {
    status: "SYNCED" as const,
    instructionCount: 1,
    indexerStatus: "MOCK_SYNCED",
  },
});
