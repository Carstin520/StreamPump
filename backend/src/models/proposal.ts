/**
 * CN: 旧版 proposal 数据接口，主要用于原型层的类型表达。
 * EN: Legacy proposal data interface used mainly by prototype-layer typings.
 */
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
