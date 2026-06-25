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

export type S1ManagedExecuteResponse = {
  signature: string;
  action: string;
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
    s1EligibleHolderCount?: number;
    s1EarlyHolderCount?: number;
    s1RegularHolderCount?: number;
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
    creatorPayoutUsdc?: string | null;
    discoveryPoolUsdc?: string | null;
    discoveryPoolRemaining?: string | null;
    eligibleHolderCount?: number;
    earlyHolderCount?: number;
    regularHolderCount?: number;
    rewardModelSnapshot?: number;
    residualToSnapshot?: number;
    discoveryRewardCapUsdc?: string | null;
    statusThankyouUsdc?: string | null;
    creatorPaid?: boolean;
    graduatedAt?: string | null;
    residualSweptAt?: string | null;
    residualSwept?: boolean;
    vaultClosed?: boolean;
    claimableUsdcRemaining: string | null;
    claimableS1SupplyRemaining: string | null;
    earlyClaimableUsdcRemaining: string | null;
    earlyClaimableS1SupplyRemaining: string | null;
    regularClaimableUsdcRemaining: string | null;
    regularClaimableS1SupplyRemaining: string | null;
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
    earlyCohortBalance: string;
    spumpCostBasis: string;
    estimatedClaimableUsdc: string | null;
    discoveryRewardClaimed?: boolean;
    lastDiscoveryRewardUsdc?: string;
    discoveryRewardCapped?: boolean;
    discoveryRewardEligible?: boolean;
    updatedAt: string;
  }>;
  s2Endorsements?: Array<{
    positionPda: string;
    proposalPda: string;
    proposalId: string | null;
    creatorWallet: string | null;
    sponsorWallet: string | null;
    status: string | null;
    stakedSpumpAmount: string;
    claimedStatus: boolean;
    estimatedUsdcReward: string;
    rewardCapUsdc?: string;
    rewardCapped?: boolean;
    fanPoolRemaining?: string;
    residualTransferred?: string;
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

// Managed execution is now ASYNC (backend B0): /managed/execute enqueues a job
// (202 {jobId,status:"queued"}) and we poll GET /managed/jobs/:jobId to terminal.
export type ManagedJobApiStatus = "queued" | "running" | "succeeded" | "failed";

export type ManagedJobEnqueueResponse = {
  jobId: string;
  status: "queued";
};

export type ManagedJobStatusResponse = {
  status: ManagedJobApiStatus;
  signature?: string;
  projectionSync?: S1ProjectionSyncResponse;
  error?: { code?: string; message?: string };
};

export const executeManagedWalletAction = (
  token: string,
  input: { action: string; params?: Record<string, unknown> },
  idempotencyKey?: string,
) =>
  apiClient.post<ManagedJobEnqueueResponse>("/s1/managed/execute", {
    token,
    body: input,
    headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    timeoutMs: 30000,
  });

export const getManagedWalletJob = (token: string, jobId: string) =>
  apiClient.get<ManagedJobStatusResponse>(`/s1/managed/jobs/${jobId}`, { token });

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Enqueue a managed action, then poll the job to a terminal state. Returns the
// same shape the old synchronous endpoint did, so callers stay nearly identical.
export const runManagedWalletAction = async (
  token: string,
  input: { action: string; params?: Record<string, unknown> },
  options?: {
    idempotencyKey?: string;
    onStatus?: (status: ManagedJobApiStatus) => void;
    pollIntervalMs?: number;
    timeoutMs?: number;
  },
): Promise<S1ManagedExecuteResponse> => {
  const { jobId } = await executeManagedWalletAction(
    token,
    input,
    options?.idempotencyKey ?? newIdempotencyKey(),
  );
  const interval = options?.pollIntervalMs ?? 1500;
  const deadline = Date.now() + (options?.timeoutMs ?? 90_000);

  for (;;) {
    const job = await getManagedWalletJob(token, jobId);
    options?.onStatus?.(job.status);

    if (job.status === "succeeded") {
      if (!job.signature) {
        throw new Error("Managed wallet job succeeded without a signature.");
      }
      return {
        signature: job.signature,
        action: input.action,
        projectionSync: job.projectionSync ?? { status: "SYNCED", instructionCount: 0 },
      };
    }
    if (job.status === "failed") {
      throw new Error(job.error?.message ?? job.error?.code ?? "Managed wallet job failed.");
    }
    if (Date.now() > deadline) {
      throw new Error("Managed wallet job timed out before confirmation.");
    }
    await sleep(interval);
  }
};

export const buildClaimDailySpumpTransaction = (token: string) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/claim-daily-spump/build", {
    token,
    body: {},
  });

export const buildClaimEngagementRewardTransaction = (
  token: string,
  input: {
    missionType: string;
    rewardAmount: number | string;
    xpGain: number | string;
    newLevel?: number | string | null;
    reportIdHex: string;
    reportDigestHex: string;
    observedAtUnix: number | string;
  },
) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/engagement-reward/build", {
    token,
    body: input,
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

export const buildS1SweepBuyoutResidualTransaction = (
  token: string,
  input: { creatorWallet: string },
) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/buyout/sweep-residual/build", {
    token,
    body: input,
  });

export const buildS1AbortBuyoutTransaction = (
  token: string,
  input: { creatorWallet: string },
) =>
  apiClient.post<S1BuildTransactionResponse>("/s1/buyout/abort/build", {
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
