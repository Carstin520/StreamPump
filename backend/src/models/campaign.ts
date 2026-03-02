export type CampaignStatus = "OPEN" | "SETTLED" | "EXPIRED_REFUNDED";

export interface Campaign {
  id: string;
  sponsorWallet: string;
  creatorWallet: string;
  targetViewCount: number;
  deadlineTs: number;
  depositedUsdc: string;
  predictorPoolBps: number;
  creatorSuccessPayoutBps: number;
  oracleReported: boolean;
  oracleFinalViews?: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}
