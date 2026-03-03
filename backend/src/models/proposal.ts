export type ProposalStatus =
  | "OPEN"
  | "FUNDED"
  | "RESOLVED_SUCCESS"
  | "RESOLVED_FAIL"
  | "CANCELLED"
  | "VOIDED";

export interface Proposal {
  key: string;
  creatorWallet: string;
  sponsorWallet?: string;
  targetViews: number;
  deadlineTs: number;
  totalSpumpStaked: string;
  sponsorUsdcDeposited: string;
  actualViews?: number;
  settledAt?: Date;
  status: ProposalStatus;
  createdAt: Date;
  updatedAt: Date;
}
