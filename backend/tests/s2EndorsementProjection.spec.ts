import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import { prisma } from "../src/services/prisma";
import { syncMarketProjectionFromChainInstruction } from "../src/services/marketProjectionService";

type S2PositionRecord = {
  positionPda: string;
  userWallet: string;
  proposalPda: string;
  stakedSpumpAmount: bigint;
  claimedStatus: boolean;
  estimatedUsdcReward: bigint;
  lastEventSignature: string | null;
  lastEventAt: Date | null;
};

describe("S2 endorsement projection events", () => {
  const userWallet = Keypair.generate().publicKey.toBase58();
  const proposalPda = Keypair.generate().publicKey.toBase58();
  const endorsementPosition = Keypair.generate().publicKey.toBase58();
  let positions: Map<string, S2PositionRecord>;
  let restorePrisma: (() => void) | null = null;

  beforeEach(() => {
    positions = new Map();
    const prismaAny = prisma as any;
    const original = {
      proposal: prismaAny.proposal,
      s2EndorsementPositionProjection: prismaAny.s2EndorsementPositionProjection,
    };

    prismaAny.proposal = {
      findUnique: async () => null,
      updateMany: async () => ({ count: 1 }),
      update: async () => null,
    };
    prismaAny.s2EndorsementPositionProjection = {
      findUnique: async (args: any) => positions.get(args.where.positionPda) ?? null,
      findMany: async (args: any) =>
        [...positions.values()].filter(
          (position) =>
            position.proposalPda === args.where.proposalPda &&
            position.claimedStatus === args.where.claimedStatus
        ),
      count: async (args: any) =>
        [...positions.values()].filter(
          (position) =>
            position.proposalPda === args.where.proposalPda &&
            position.claimedStatus === (args.where.claimedStatus ?? true)
        ).length,
      upsert: async (args: any) => {
        const existing = positions.get(args.where.positionPda);
        const next = existing
          ? { ...existing, ...args.update }
          : { id: `${args.where.positionPda}-id`, ...args.create };
        positions.set(args.where.positionPda, next);
        return next;
      },
      update: async (args: any) => {
        const existing = positions.get(args.where.positionPda);
        if (!existing) throw new Error("missing position");
        const next = { ...existing, ...args.data };
        positions.set(args.where.positionPda, next);
        return next;
      },
    };
    restorePrisma = () => {
      prismaAny.proposal = original.proposal;
      prismaAny.s2EndorsementPositionProjection = original.s2EndorsementPositionProjection;
    };
  });

  afterEach(() => {
    restorePrisma?.();
  });

  it("projects endorse, Track2 settlement estimates, and claim state", async () => {
    await syncMarketProjectionFromChainInstruction({
      signature: "endorse-sig",
      instructionName: "endorse_proposal",
      proposalPda,
      entityPda: endorsementPosition,
      payload: {
        accounts: {
          user: userWallet,
          proposal: proposalPda,
          endorsementPosition,
        },
        args: {
          amount: "200",
        },
      },
    });

    expect(positions.get(endorsementPosition)?.stakedSpumpAmount).to.equal(200n);
    expect(positions.get(endorsementPosition)?.claimedStatus).to.equal(false);

    await syncMarketProjectionFromChainInstruction({
      signature: "settle-sig",
      instructionName: "settle_track2",
      proposalPda,
      entityPda: proposalPda,
      payload: {
        eventData: {
          proposal: proposalPda,
          initialFanPool: "99",
          initialSpumpStaked: "300",
        },
      },
    });

    expect(positions.get(endorsementPosition)?.estimatedUsdcReward).to.equal(66n);

    await syncMarketProjectionFromChainInstruction({
      signature: "claim-sig",
      instructionName: "claim_endorsement",
      proposalPda,
      entityPda: proposalPda,
      payload: {
        accounts: {
          endorsementPosition,
        },
        eventData: {
          proposal: proposalPda,
          user: userWallet,
          stakedAmount: "200",
          usdcReward: "67",
          claimed: true,
        },
      },
    });

    expect(positions.get(endorsementPosition)?.claimedStatus).to.equal(true);
    expect(positions.get(endorsementPosition)?.estimatedUsdcReward).to.equal(67n);
    expect(positions.get(endorsementPosition)?.lastEventSignature).to.equal("claim-sig");
  });
});
