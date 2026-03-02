export type MarketOutcome = "YES" | "NO" | "VOID";

export interface TrafficMarket {
  id: string;
  campaignId: string;
  closeTs: number;
  yesStakeSpump: string;
  noStakeSpump: string;
  rewardsUsdc: string;
  resolved: boolean;
  outcome?: MarketOutcome;
  createdAt: Date;
  updatedAt: Date;
}
