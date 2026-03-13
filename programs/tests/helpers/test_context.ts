import * as anchor from "@coral-xyz/anchor";
import type { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import type { StreampumpCore } from "../../../target/types/streampump_core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";

export type BN = anchor.BN;

export interface CreateFundedProposalParams {
  creator: Keypair;
  sponsor: Keypair;
  track1Base: bigint;
  track2Amount: bigint;
  track3Amount: bigint;
  track2Target: bigint;
  track2MinAchievementBps: number;
  track3DelayDays?: number;
  deadlineOffsetSeconds?: number;
}

export interface FundedProposalInfo {
  creatorProfile: PublicKey;
  proposal: PublicKey;
  proposalUsdcVault: PublicKey;
  deadline: BN;
}

export interface TestContext {
  provider: anchor.AnchorProvider;
  program: Program<StreampumpCore>;
  connection: anchor.web3.Connection;
  payer: Keypair;

  oracle: Keypair;
  creatorS2: Keypair;
  creatorS1: Keypair;
  sponsorA: Keypair;
  sponsorB: Keypair;
  fanA: Keypair;

  protocolConfig: PublicKey;
  usdcMint: PublicKey;
  spumpMint: PublicKey;

  creatorS2UsdcAta: PublicKey;
  creatorS1UsdcAta: PublicKey;
  sponsorAUsdcAta: PublicKey;
  sponsorBUsdcAta: PublicKey;
  fanAUsdcAta: PublicKey;

  creatorS1SpumpAta: PublicKey;
  fanASpumpAta: PublicKey;

  bn: (n: number | bigint | string) => BN;
  nowTs: () => number;
  enumKey: (variant: unknown) => string;
  tokenAmount: (ata: PublicKey, tokenProgramId: PublicKey) => Promise<bigint>;
  waitUntilDeadline: (deadline: BN) => Promise<void>;
  expectAnchorError: (
    fn: () => Promise<string>,
    expectedNeedle: string
  ) => Promise<void>;

  deriveCreatorProfile: (authority: PublicKey) => PublicKey;
  deriveProposal: (creator: PublicKey, deadline: BN) => PublicKey;
  deriveProposalUsdcVault: (proposal: PublicKey) => PublicKey;
  deriveEndorsementPosition: (user: PublicKey, proposal: PublicKey) => PublicKey;
  deriveUpgradeReceipt: (creatorProfile: PublicKey, reportId: number[]) => PublicKey;
  deriveBuyoutOffer: (sponsor: PublicKey, creatorProfile: PublicKey) => PublicKey;
  deriveOfferUsdcVault: (buyoutOffer: PublicKey) => PublicKey;
  deriveS1BuyoutState: (creatorProfile: PublicKey) => PublicKey;

  createFundedProposal: (params: CreateFundedProposalParams) => Promise<FundedProposalInfo>;
}

let contextPromise: Promise<TestContext> | null = null;

export const getTestContext = async (): Promise<TestContext> => {
  if (!contextPromise) {
    contextPromise = buildContext();
  }
  return contextPromise;
};

const buildContext = async (): Promise<TestContext> => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StreampumpCore as Program<StreampumpCore>;
  const connection = provider.connection;
  const payer = (provider.wallet as unknown as { payer: Keypair }).payer;

  if (!payer) {
    throw new Error("Provider wallet payer is required for test setup");
  }

  const oracle = Keypair.generate();
  const creatorS2 = Keypair.generate();
  const creatorS1 = Keypair.generate();
  const sponsorA = Keypair.generate();
  const sponsorB = Keypair.generate();
  const fanA = Keypair.generate();

  const protocolConfig = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    program.programId
  )[0];

  let deadlineNonce = 0;

  const bn = (n: number | bigint | string) => new anchor.BN(n.toString());
  const nowTs = () => Math.floor(Date.now() / 1000);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const nextDeadline = (offsetSeconds = 3): BN => {
    deadlineNonce += 1;
    return bn(nowTs() + offsetSeconds + deadlineNonce * 5);
  };

  const enumKey = (variant: unknown): string => Object.keys(variant as object)[0];

  const deriveCreatorProfile = (authority: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync([Buffer.from("creator"), authority.toBuffer()], program.programId)[0];

  const deriveProposal = (creator: PublicKey, deadline: BN): PublicKey =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        creator.toBuffer(),
        deadline.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

  const deriveProposalUsdcVault = (proposal: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("proposal_usdc_vault"), proposal.toBuffer()],
      program.programId
    )[0];

  const deriveEndorsementPosition = (user: PublicKey, proposal: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("endorsement"), user.toBuffer(), proposal.toBuffer()],
      program.programId
    )[0];

  const deriveUpgradeReceipt = (creatorProfile: PublicKey, reportId: number[]): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("upgrade_receipt"), creatorProfile.toBuffer(), Buffer.from(reportId)],
      program.programId
    )[0];

  const deriveBuyoutOffer = (sponsor: PublicKey, creatorProfile: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("buyout_offer"), sponsor.toBuffer(), creatorProfile.toBuffer()],
      program.programId
    )[0];

  const deriveOfferUsdcVault = (buyoutOffer: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("offer_usdc_vault"), buyoutOffer.toBuffer()],
      program.programId
    )[0];

  const deriveS1BuyoutState = (creatorProfile: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("s1_buyout_state"), creatorProfile.toBuffer()],
      program.programId
    )[0];

  const tokenAmount = async (
    ata: PublicKey,
    tokenProgramId: PublicKey
  ): Promise<bigint> => {
    const account = await getAccount(connection, ata, undefined, tokenProgramId);
    return account.amount;
  };

  const airdropSol = async (pubkey: PublicKey, sol = 4): Promise<void> => {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  };

  const waitUntilDeadline = async (deadline: BN): Promise<void> => {
    while (nowTs() <= deadline.toNumber() + 1) {
      await sleep(500);
    }
    await sleep(1_500);
  };

  const expectAnchorError = async (
    fn: () => Promise<string>,
    expectedNeedle: string
  ): Promise<void> => {
    try {
      await fn();
      assert.fail(`Expected error containing: ${expectedNeedle}`);
    } catch (err: any) {
      const text = [
        err?.error?.errorCode?.code,
        err?.error?.errorMessage,
        err?.toString?.(),
        Array.isArray(err?.logs) ? err.logs.join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");

      assert(
        text.includes(expectedNeedle),
        `Expected error containing "${expectedNeedle}", got:\n${text}`
      );
    }
  };

  await airdropSol(payer.publicKey, 20);
  for (const kp of [oracle, creatorS2, creatorS1, sponsorA, sponsorB, fanA]) {
    await airdropSol(kp.publicKey, 5);
  }

  const usdcMint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );

  const spumpMint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  const creatorS2UsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdcMint,
      creatorS2.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;
  const creatorS1UsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdcMint,
      creatorS1.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;
  const sponsorAUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdcMint,
      sponsorA.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;
  const sponsorBUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdcMint,
      sponsorB.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;
  const fanAUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdcMint,
      fanA.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;

  const creatorS1SpumpAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      spumpMint,
      creatorS1.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;
  const fanASpumpAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      spumpMint,
      fanA.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  ).address;

  await mintTo(
    connection,
    payer,
    usdcMint,
    sponsorAUsdcAta,
    payer.publicKey,
    5_000_000_000n,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );
  await mintTo(
    connection,
    payer,
    usdcMint,
    sponsorBUsdcAta,
    payer.publicKey,
    5_000_000_000n,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );
  await mintTo(
    connection,
    payer,
    spumpMint,
    fanASpumpAta,
    payer.publicKey,
    3_000_000_000n,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  await program.methods
    .initializeProtocol({
      oracleAuthority: oracle.publicKey,
      usdcMint,
      spumpMint,
      maxProposalDurationSeconds: bn(7 * 24 * 3_600),
      maxExitTaxBps: 1_500,
      minExitTaxBps: 500,
      taxDecayThresholdSupply: bn(1_000_000),
      s2MinFollowers: bn(100),
      s2MinValidViews: bn(1_000),
    })
    .accounts({
      admin: payer.publicKey,
      protocolConfig,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await setAuthority(
    connection,
    payer,
    spumpMint,
    payer.publicKey,
    AuthorityType.MintTokens,
    protocolConfig,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  const creatorS2Profile = deriveCreatorProfile(creatorS2.publicKey);
  const creatorS1Profile = deriveCreatorProfile(creatorS1.publicKey);

  await program.methods
    .registerCreator({
      handle: "creator_s2",
      payoutUsdcAta: creatorS2UsdcAta,
    })
    .accounts({
      authority: creatorS2.publicKey,
      protocolConfig,
      creatorProfile: creatorS2Profile,
      systemProgram: SystemProgram.programId,
    })
    .signers([creatorS2])
    .rpc();

  await program.methods
    .registerCreator({
      handle: "creator_s1",
      payoutUsdcAta: creatorS1UsdcAta,
    })
    .accounts({
      authority: creatorS1.publicKey,
      protocolConfig,
      creatorProfile: creatorS1Profile,
      systemProgram: SystemProgram.programId,
    })
    .signers([creatorS1])
    .rpc();

  const reportId = Array.from(Keypair.generate().publicKey.toBytes());
  const reportDigest = Array.from(Keypair.generate().publicKey.toBytes());
  const upgradeReceipt = deriveUpgradeReceipt(creatorS2Profile, reportId);

  await program.methods
    .upgradeCreator({
      newLevel: 2,
      metricType: { followers: {} },
      metricValue: bn(500),
      reportId,
      reportDigest,
      observedAt: bn(nowTs() - 5),
    })
    .accounts({
      oracle: oracle.publicKey,
      protocolConfig,
      creatorProfile: creatorS2Profile,
      upgradeReceipt,
      systemProgram: SystemProgram.programId,
    })
    .signers([oracle])
    .rpc();

  const createFundedProposal = async (
    params: CreateFundedProposalParams
  ): Promise<FundedProposalInfo> => {
    const creatorProfile = deriveCreatorProfile(params.creator.publicKey);
    const deadline = nextDeadline(params.deadlineOffsetSeconds ?? 3);
    const proposal = deriveProposal(params.creator.publicKey, deadline);
    const proposalUsdcVault = deriveProposalUsdcVault(proposal);

    const sponsorUsdcAta = params.sponsor.publicKey.equals(sponsorA.publicKey)
      ? sponsorAUsdcAta
      : sponsorBUsdcAta;

    await program.methods
      .createProposal({
        track1BaseUsdc: bn(params.track1Base),
        track2MetricType: { views: {} },
        track2TargetValue: bn(params.track2Target),
        track2MinAchievementBps: params.track2MinAchievementBps,
        track3DelayDays: params.track3DelayDays ?? 45,
        deadline,
      })
      .accounts({
        creator: params.creator.publicKey,
        protocolConfig,
        creatorProfile,
        proposal,
        usdcVault: proposalUsdcVault,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([params.creator])
      .rpc();

    await program.methods
      .sponsorFund({
        track1Amount: bn(params.track1Base),
        track2Amount: bn(params.track2Amount),
        track3Amount: bn(params.track3Amount),
      })
      .accounts({
        sponsor: params.sponsor.publicKey,
        proposal,
        sponsorUsdcAta,
        proposalUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([params.sponsor])
      .rpc();

    return { creatorProfile, proposal, proposalUsdcVault, deadline };
  };

  return {
    provider,
    program,
    connection,
    payer,

    oracle,
    creatorS2,
    creatorS1,
    sponsorA,
    sponsorB,
    fanA,

    protocolConfig,
    usdcMint,
    spumpMint,

    creatorS2UsdcAta,
    creatorS1UsdcAta,
    sponsorAUsdcAta,
    sponsorBUsdcAta,
    fanAUsdcAta,

    creatorS1SpumpAta,
    fanASpumpAta,

    bn,
    nowTs,
    enumKey,
    tokenAmount,
    waitUntilDeadline,
    expectAnchorError,

    deriveCreatorProfile,
    deriveProposal,
    deriveProposalUsdcVault,
    deriveEndorsementPosition,
    deriveUpgradeReceipt,
    deriveBuyoutOffer,
    deriveOfferUsdcVault,
    deriveS1BuyoutState,

    createFundedProposal,
  };
};
