/**
 * CN: 粉丝 endorsement 仓位模型，描述某个用户在 proposal 上的支持头寸。
 * EN: Endorsement position model describing a single user's support position on a proposal.
 */
export interface EndorsementPosition {
  proposalKey: string;
  userWallet: string;
  stakedAmount: string;
  claimed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
