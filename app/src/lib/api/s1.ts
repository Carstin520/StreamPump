import { apiClient } from "@/lib/api/client";
import { CreatorSeasonState } from "@/lib/api/types";

export const DEMO_S1_CREATOR_WALLET =
  process.env.NEXT_PUBLIC_DEMO_S1_CREATOR_WALLET?.trim() ||
  "EoMRsbLnHx21hMnY1KVzCL39WBTKLozLcRPt7SU2fVpg";
export const S1_MOCK_ACCESS_TOKEN = "mock-s1-demo";
export const S1_MOCK_USER_WALLET = "DemoWallet111111111111111111111111111111111";

export type S1BuildTransactionResponse = {
  action: string;
  submitMode: "CLIENT_RELAY";
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: string;
  requiredSigners: string[];
  derived: Record<string, string | null>;
};

export type S1ProjectionSyncResponse =
  | {
      status: "SYNCED";
      instructionCount: number;
      indexerStatus?: string;
    }
  | {
      status: "FAILED";
      instructionCount?: number;
      indexerStatus?: string;
      error?: string;
    };

export type S1SubmitTransactionResponse = {
  signature: string;
  projectionSync: S1ProjectionSyncResponse;
};

export type S1TransactionStatusResponse = {
  signature: string;
  status: string;
};

export type S1BuyoutStatus =
  | "NONE"
  | "OFFER_OPEN"
  | "ACCEPTED"
  | "EXECUTION_PENDING"
  | "GRADUATED"
  | string;

export type S1MarketProfileResponse = {
  creator: {
    creatorWallet: string;
    creatorProfilePda: string;
    handle: string | null;
    displayName: string | null;
    stage: CreatorSeasonState;
    level: number;
    s1Supply: string;
    currentPriceSpump: string;
    nextPriceSpump: string;
    supporterPoolSpump: string;
    holderCount: number;
    graduationProgressBps: number;
    activeCampaignCount: number;
    latestBuyoutOfferUsdc: string | null;
    acceptedBuyoutOfferUsdc: string | null;
    buyoutStatePda: string | null;
    metadata: Record<string, unknown> | null;
    updatedAt: string;
  };
  buyout: {
    status: S1BuyoutStatus;
    buyoutStatePda: string;
    winningSponsorWallet: string | null;
    acceptedOfferPda: string | null;
    acceptedOfferUsdc: string | null;
    latestOfferPda: string | null;
    latestOfferUsdc: string | null;
    usdcDeposited: string | null;
    claimableUsdcRemaining: string | null;
    claimableS1SupplyRemaining: string | null;
    rageQuitDeadlineAt: string | null;
  } | null;
  offers: Array<{
    buyoutOfferPda: string;
    sponsorWallet: string;
    usdcAmount: string;
    status: string;
    sponsorCancelAfterAt: string | null;
  }>;
  campaigns: unknown[];
};

export type S1PortfolioResponse = {
  userWallet: string;
  positions: Array<{
    positionPda: string;
    creatorWallet: string;
    creatorProfilePda: string;
    creator: S1MarketProfileResponse["creator"] | null;
    internalTokenBalance: string;
    spumpCostBasis: string;
    estimatedClaimableUsdc: string | null;
    updatedAt: string;
  }>;
};

type S1BuildWithAmountInput = {
  creatorWallet: string;
  amount: number | string;
};

const amountBody = ({ creatorWallet, amount }: S1BuildWithAmountInput) => ({
  creatorWallet,
  amount: String(amount),
});

export const getS1MarketProfile = (creatorWallet: string) =>
  apiClient.get<S1MarketProfileResponse>(`/market/creators/${creatorWallet}`);

export const getS1Portfolio = (token: string) =>
  apiClient.get<S1PortfolioResponse>("/market/portfolio", { token });

export const buildS1BuyTransaction = (token: string, input: S1BuildWithAmountInput) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/buy/build", {
    token,
    body: amountBody(input),
  });

export const buildS1SellTransaction = (token: string, input: S1BuildWithAmountInput) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/sell/build", {
    token,
    body: amountBody(input),
  });

export const buildS1RageQuitTransaction = (token: string, input: S1BuildWithAmountInput) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/rage-quit/build", {
    token,
    body: amountBody(input),
  });

export const buildS1ClaimUsdcTransaction = (
  token: string,
  input: { creatorWallet: string; sponsorWallet: string },
) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/buyout/claim-usdc/build", {
    token,
    body: input,
  });

export const submitS1Transaction = (
  token: string,
  input: {
    signedTransactionBase64: string;
    recentBlockhash: string;
    lastValidBlockHeight: string;
  },
) =>
  apiClient.post<S1SubmitTransactionResponse>("/s1/transactions/submit", {
    token,
    body: input,
    timeoutMs: 30000,
  });

export const getS1TransactionStatus = (signature: string) =>
  apiClient.get<S1TransactionStatusResponse>(`/s1/transactions/${signature}/status`);
