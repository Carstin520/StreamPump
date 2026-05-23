/**
 * CN: Anchor 服务封装，负责 IDL 加载、PDA 推导和后端可代执行的链上结算调用。
 * EN: Anchor service wrapper responsible for IDL loading, PDA derivation, and backend-driven on-chain settlement calls.
 */
import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";

import { keccak_256 } from "@noble/hashes/sha3";
import {
  AnchorProvider,
  BN,
  Idl,
  Program,
  Wallet,
} from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";

import { config } from "../../config/default";

const RPC_TIMEOUT_MS = Number(process.env.ORACLE_RPC_TIMEOUT_MS ?? 25_000);
const PROGRAM_COMMITMENT: Commitment = "confirmed";

export type SignatureState = "SUCCESS" | "FAILED" | "PENDING" | "NOT_FOUND";

export interface OnChainProposalState {
  creator: PublicKey;
  sponsor: PublicKey | null;
  status: "OPEN" | "FUNDED" | "RESOLVED_SUCCESS" | "RESOLVED_FAIL" | "CANCELLED" | "VOIDED";
  contentKind: "SHORT_VIDEO" | "IMAGE_CAROUSEL" | "MIXED_MEDIA_NOTE";
  contentHashHex: string;
  contentAnchorPda: string | null;
  track1BaseUsdc: bigint;
  track1Claimed: boolean;
  track2MetricType: "VIEWS" | "CLICKS" | "SAVES";
  track2TargetValue: bigint;
  track2MinAchievementBps: number;
  track2UsdcDeposited: bigint;
  track2ActualValue: bigint | null;
  track2SettledAtUnix: bigint;
  track3UsdcDeposited: bigint;
  track3CpsPayout: bigint | null;
  track3DelayDays: number;
  track3SettledAtUnix: bigint;
  deadlineUnix: bigint;
}

export interface OnChainCreatorProfileState {
  authority: PublicKey;
  handle: string;
  payoutUsdcAta: PublicKey;
  level: number;
  status: "S1_ACTIVE" | "S1_AUCTION_PENDING" | "S1_EXECUTION_PENDING" | "S2_ACTIVE";
  s1Supply: bigint;
  s1EarlyCohortSupply: bigint;
  s1RatingBps: number;
  s1GraduationTargetSupply: bigint;
  pendingS1RatingBps: number;
  pendingS1GraduationTargetSupply: bigint;
  pendingRatingEffectiveAtUnix: bigint;
  pendingRatingReportDigestHex: string | null;
  lastRatingUpdateAtUnix: bigint;
  lastRatingReportDigestHex: string | null;
  lastUpgradeAtUnix: bigint;
  createdAtUnix: bigint;
  updatedAtUnix: bigint;
  bump: number;
}

export interface OnChainS1BuyoutState {
  creatorProfile: PublicKey;
  winningSponsor: PublicKey | null;
  usdcDeposited: bigint;
  claimableUsdcRemaining: bigint;
  claimableS1SupplyRemaining: bigint;
  earlyClaimableUsdcRemaining: bigint;
  earlyClaimableS1SupplyRemaining: bigint;
  regularClaimableUsdcRemaining: bigint;
  regularClaimableS1SupplyRemaining: bigint;
  rageQuitDeadlineUnix: bigint;
  bump: number;
}

export interface OnChainS1BuyoutOfferState {
  sponsor: PublicKey;
  creatorProfile: PublicKey;
  usdcAmount: bigint;
  createdAtUnix: bigint;
  sponsorCancelAfterUnix: bigint;
  bump: number;
}

export interface OnChainS1UserPositionState {
  user: PublicKey;
  creatorProfile: PublicKey;
  internalTokenBalance: bigint;
  earlyCohortBalance: bigint;
  spumpCostBasis: bigint;
  firstBoughtAtUnix: bigint;
  lastBuyDay: bigint;
  dailyBoughtSpump: bigint;
  bump: number;
}

type ProtocolConfigAccount = {
  admin: PublicKey;
  oracleAuthority: PublicKey;
  usdcMint: PublicKey;
  spumpMint: PublicKey;
  dailySpumpEmissionMultiplierBps?: number;
  newUserEmissionBps?: number;
  newUserEmissionWindowSeconds?: BN | bigint | number;
  s1MinUserXp?: BN | bigint | number;
  maxS1DailyBuySpump?: BN | bigint | number;
  s1EarlyCohortSupplyThreshold?: BN | bigint | number;
  s1EarlyCohortBuyoutCapBps?: number;
  s1RageQuitWindowSeconds?: BN | bigint | number;
  minCreatorRatingBps?: number;
  maxCreatorRatingBps?: number;
  maxCreatorRatingDailyDeltaBps?: number;
  s1RatingEffectiveDelaySeconds?: BN | bigint | number;
  defaultS1GraduationTargetSupply?: BN | bigint | number;
};

type CreatorProfileAccount = {
  authority: PublicKey;
  handle: string;
  payoutUsdcAta: PublicKey;
  level: number;
  status: unknown;
  s1Supply: BN | bigint | number;
  s1EarlyCohortSupply?: BN | bigint | number;
  s1RatingBps?: number;
  s1GraduationTargetSupply?: BN | bigint | number;
  pendingS1RatingBps?: number;
  pendingS1GraduationTargetSupply?: BN | bigint | number;
  pendingRatingEffectiveAt?: BN | bigint | number;
  pendingRatingReportDigest?: number[];
  lastRatingUpdateAt?: BN | bigint | number;
  lastRatingReportDigest?: number[];
  lastUpgradeAt: BN | bigint | number;
  createdAt: BN | bigint | number;
  updatedAt: BN | bigint | number;
  bump: number;
};

type S1BuyoutStateAccount = {
  creator: PublicKey;
  winningSponsor: PublicKey | null;
  usdcDeposited: BN | bigint | number;
  claimableUsdcRemaining: BN | bigint | number;
  claimableS1SupplyRemaining: BN | bigint | number;
  earlyClaimableUsdcRemaining?: BN | bigint | number;
  earlyClaimableS1SupplyRemaining?: BN | bigint | number;
  regularClaimableUsdcRemaining?: BN | bigint | number;
  regularClaimableS1SupplyRemaining?: BN | bigint | number;
  rageQuitDeadline: BN | bigint | number;
  bump: number;
};

type S1BuyoutOfferAccount = {
  sponsor: PublicKey;
  creator: PublicKey;
  usdcAmount: BN | bigint | number;
  createdAt: BN | bigint | number;
  sponsorCancelAfter: BN | bigint | number;
  bump: number;
};

type S1UserPositionAccount = {
  user: PublicKey;
  creator: PublicKey;
  internalTokenBalance: BN | bigint | number;
  earlyCohortBalance?: BN | bigint | number;
  spumpCostBasis: BN | bigint | number;
  firstBoughtAt?: BN | bigint | number;
  lastBuyDay?: BN | bigint | number;
  dailyBoughtSpump?: BN | bigint | number;
  bump: number;
};

export type UpdateCreatorS1RatingParams = {
  creatorWallet: string;
  ratingBps: number;
  graduationTargetSupply: number;
  reportIdHex: string;
  reportDigestHex: string;
  observedAtUnix: bigint;
};

export type UpdateProtocolS1EmissionParams = {
  dailySpumpEmissionMultiplierBps: number;
  newUserEmissionBps: number;
  newUserEmissionWindowSeconds: number;
  s1MinUserXp: bigint;
  maxS1DailyBuySpump: bigint;
  s1EarlyCohortSupplyThreshold: bigint;
  s1EarlyCohortBuyoutCapBps: number;
  s1RageQuitWindowSeconds: number;
};

export type ProtocolS1ConfigState = UpdateProtocolS1EmissionParams & {
  admin: PublicKey;
};

export type UserMissionTypeName =
  | "DAILY_SESSION_5_MIN"
  | "LIKE_10_POSTS"
  | "FOLLOW_3_CREATORS"
  | "SHARE_1_POST"
  | "PUBLISH_FIRST_POST"
  | "COMPLETE_PROFILE"
  | "SPONSOR_CAMPAIGN_REVIEW";

export type BuiltClientTransaction = {
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: bigint;
};

type ResolvedSettlementAccounts = {
  protocolConfigPda: PublicKey;
  proposalUsdcVaultPda: PublicKey;
  creatorProfilePda: PublicKey;
  creatorUsdcAta: PublicKey;
  sponsorUsdcAta?: PublicKey;
};

type ContentAnchorContext = {
  trimmedUrl: string;
  contentDigest: Uint8Array;
  urlDigest: Uint8Array;
  creatorProfilePda: PublicKey;
  contentAnchorPda: PublicKey;
};

class RpcTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`RPC timeout after ${timeoutMs}ms (${operation})`);
    this.name = "RpcTimeoutError";
  }
}

const toBigInt = (value: BN | bigint | number | null | undefined): bigint => {
  if (value === null || value === undefined) {
    return 0n;
  }

  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value.toString());
};

const toU64Bn = (value: number, fieldName: string): BN => {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} exceeds JavaScript safe integer range`);
  }

  return new BN(String(value));
};

const anchorEnumKey = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const firstKey = Object.keys(value as Record<string, unknown>)[0];
    if (firstKey) {
      return firstKey;
    }
  }

  throw new Error(`Unable to resolve Anchor enum key from value: ${String(value)}`);
};

const mapProposalStatus = (
  value: unknown
): OnChainProposalState["status"] => {
  const normalized = anchorEnumKey(value).toLowerCase();

  switch (normalized) {
    case "open":
      return "OPEN";
    case "funded":
      return "FUNDED";
    case "resolved_success":
    case "resolvedsuccess":
      return "RESOLVED_SUCCESS";
    case "resolved_fail":
    case "resolvedfail":
      return "RESOLVED_FAIL";
    case "cancelled":
      return "CANCELLED";
    case "voided":
      return "VOIDED";
    default:
      throw new Error(`Unsupported on-chain proposal status: ${normalized}`);
  }
};

const mapCreatorStatus = (
  value: unknown
): OnChainCreatorProfileState["status"] => {
  const normalized = anchorEnumKey(value).toLowerCase();

  switch (normalized) {
    case "s1_active":
    case "s1active":
      return "S1_ACTIVE";
    case "s1_auction_pending":
    case "s1auctionpending":
      return "S1_AUCTION_PENDING";
    case "s1_execution_pending":
    case "s1executionpending":
      return "S1_EXECUTION_PENDING";
    case "s2_active":
    case "s2active":
      return "S2_ACTIVE";
    default:
      throw new Error(`Unsupported on-chain creator status: ${normalized}`);
  }
};

const mapProposalMetricType = (
  value: unknown
): OnChainProposalState["track2MetricType"] => {
  const normalized = anchorEnumKey(value).toLowerCase();

  switch (normalized) {
    case "views":
      return "VIEWS";
    case "clicks":
      return "CLICKS";
    case "saves":
      return "SAVES";
    default:
      throw new Error(`Unsupported on-chain proposal metric type: ${normalized}`);
  }
};

const mapProposalContentKind = (
  value: unknown
): OnChainProposalState["contentKind"] => {
  const normalized = anchorEnumKey(value).toLowerCase();

  switch (normalized) {
    case "short_video":
    case "shortvideo":
      return "SHORT_VIDEO";
    case "image_carousel":
    case "imagecarousel":
      return "IMAGE_CAROUSEL";
    case "mixed_media_note":
    case "mixedmedianote":
      return "MIXED_MEDIA_NOTE";
    default:
      throw new Error(`Unsupported on-chain proposal content kind: ${normalized}`);
  }
};

const resolveHomePath = (inputPath: string): string => {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
};

const parseKeypairSecret = (secret: string, envName: string): Keypair => {
  try {
    const parsed = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch (error) {
    throw new Error(`Failed to parse ${envName}: ${String(error)}`);
  }
};

const loadKeypairFromPath = (keypairPath: string, label: string): Keypair => {
  const resolvedPath = resolveHomePath(keypairPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`${label} keypair not found at ${resolvedPath}`);
  }

  try {
    const raw = readFileSync(resolvedPath, "utf8");
    const parsed = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch (error) {
    throw new Error(`Failed to load ${label} keypair: ${String(error)}`);
  }
};

const loadOracleAuthorityKeypair = (): Keypair => {
  const inlineSecret = process.env.ORACLE_AUTHORITY_SECRET_KEY?.trim();
  if (inlineSecret) {
    return parseKeypairSecret(inlineSecret, "ORACLE_AUTHORITY_SECRET_KEY");
  }

  const keypairPath =
    process.env.ORACLE_AUTHORITY_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json";
  return loadKeypairFromPath(keypairPath, "Oracle authority");
};

const loadOptionalContentAnchorSigner = (): Keypair | null => {
  const inlineSecret = process.env.CONTENT_ANCHOR_SIGNER_SECRET_KEY?.trim();
  if (inlineSecret) {
    return parseKeypairSecret(inlineSecret, "CONTENT_ANCHOR_SIGNER_SECRET_KEY");
  }

  const keypairPath = process.env.CONTENT_ANCHOR_SIGNER_KEYPAIR_PATH?.trim();
  if (!keypairPath) {
    return null;
  }

  return loadKeypairFromPath(keypairPath, "Content anchor signer");
};

const loadOptionalProtocolAdminKeypair = (): Keypair | null => {
  const inlineSecret = process.env.PROTOCOL_ADMIN_SECRET_KEY?.trim();
  if (inlineSecret) {
    return parseKeypairSecret(inlineSecret, "PROTOCOL_ADMIN_SECRET_KEY");
  }

  const keypairPath = process.env.PROTOCOL_ADMIN_KEYPAIR_PATH?.trim();
  if (!keypairPath) {
    return null;
  }

  return loadKeypairFromPath(keypairPath, "Protocol admin");
};

const parseDigestHex = (digestHex: string, label: string): Uint8Array => {
  const normalized = digestHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a 64-character hex string`);
  }

  return Uint8Array.from(Buffer.from(normalized, "hex"));
};

const resolveIdlPath = (): string => {
  const explicitPath = process.env.STREAMPUMP_IDL_PATH?.trim();
  if (explicitPath) {
    const resolved = resolveHomePath(explicitPath);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  const candidates = [
    path.resolve(process.cwd(), "target/idl/streampump_core.json"),
    path.resolve(process.cwd(), "../target/idl/streampump_core.json"),
    path.resolve(__dirname, "../../../target/idl/streampump_core.json"),
    path.resolve(__dirname, "../../../../target/idl/streampump_core.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to find streampump_core IDL. Set STREAMPUMP_IDL_PATH or place IDL under target/idl."
  );
};

export class AnchorService {
  private static instance: AnchorService | null = null;

  readonly connection: Connection;
  readonly provider: AnchorProvider;
  readonly program: Program<Idl>;
  readonly oracleAuthority: Keypair;
  readonly contentAnchorSigner: Keypair | null;
  readonly protocolAdmin: Keypair | null;

  private constructor() {
    this.connection = new Connection(config.solana.rpcEndpoint, PROGRAM_COMMITMENT);
    this.oracleAuthority = loadOracleAuthorityKeypair();
    this.contentAnchorSigner = loadOptionalContentAnchorSigner();
    this.protocolAdmin = loadOptionalProtocolAdminKeypair();
    this.provider = new AnchorProvider(
      this.connection,
      new Wallet(this.oracleAuthority),
      AnchorProvider.defaultOptions()
    );

    // The backend reads the locally generated IDL so RPC method names stay aligned with the Rust program.
    const idlPath = resolveIdlPath();
    const rawIdl = readFileSync(idlPath, "utf8");
    const idl = JSON.parse(rawIdl) as Idl;
    (idl as Idl & { address?: string }).address = config.solana.programId;

    this.program = new Program(idl, this.provider);
  }

  static getInstance(): AnchorService {
    if (!AnchorService.instance) {
      AnchorService.instance = new AnchorService();
    }

    return AnchorService.instance;
  }

  getProgramId(): PublicKey {
    return this.program.programId;
  }

  getOracleAuthorityPublicKey(): PublicKey {
    return this.oracleAuthority.publicKey;
  }

  deriveProtocolConfigPda(): PublicKey {
    const [protocolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      this.program.programId
    );

    return protocolConfig;
  }

  deriveCreatorProfilePda(creator: PublicKey): PublicKey {
    const [creatorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), creator.toBuffer()],
      this.program.programId
    );

    return creatorProfile;
  }

  deriveProposalPda(creator: PublicKey, deadlineUnix: bigint): PublicKey {
    const deadlineSeed = Buffer.alloc(8);
    deadlineSeed.writeBigInt64LE(deadlineUnix);

    const [proposal] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), creator.toBuffer(), deadlineSeed],
      this.program.programId
    );

    return proposal;
  }

  deriveProposalUsdcVaultPda(proposalPda: PublicKey): PublicKey {
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal_usdc_vault"), proposalPda.toBuffer()],
      this.program.programId
    );

    return vault;
  }

  deriveContentAnchorPda(creatorProfilePda: PublicKey, urlDigest: Uint8Array): PublicKey {
    const [contentAnchor] = PublicKey.findProgramAddressSync(
      [Buffer.from("content_anchor"), creatorProfilePda.toBuffer(), Buffer.from(urlDigest)],
      this.program.programId
    );

    return contentAnchor;
  }

  deriveS1PositionPda(user: PublicKey, creatorProfilePda: PublicKey): PublicKey {
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("s1_position"), user.toBuffer(), creatorProfilePda.toBuffer()],
      this.program.programId
    );

    return position;
  }

  deriveUserProfilePda(user: PublicKey): PublicKey {
    const [userProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.toBuffer()],
      this.program.programId
    );

    return userProfile;
  }

  deriveUserRewardReceiptPda(userProfilePda: PublicKey, reportId: Uint8Array): PublicKey {
    const [rewardReceipt] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_reward_receipt"), userProfilePda.toBuffer(), Buffer.from(reportId)],
      this.program.programId
    );

    return rewardReceipt;
  }

  deriveS1BuyoutStatePda(creatorProfilePda: PublicKey): PublicKey {
    const [buyoutState] = PublicKey.findProgramAddressSync(
      [Buffer.from("s1_buyout_state"), creatorProfilePda.toBuffer()],
      this.program.programId
    );

    return buyoutState;
  }

  deriveBuyoutOfferPda(sponsor: PublicKey, creatorProfilePda: PublicKey): PublicKey {
    const [buyoutOffer] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyout_offer"), sponsor.toBuffer(), creatorProfilePda.toBuffer()],
      this.program.programId
    );

    return buyoutOffer;
  }

  deriveOfferUsdcVaultPda(buyoutOfferPda: PublicKey): PublicKey {
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("offer_usdc_vault"), buyoutOfferPda.toBuffer()],
      this.program.programId
    );

    return vault;
  }

  async fetchProtocolConfigAccount(): Promise<any> {
    const { account } = await this.fetchProtocolConfigState();
    return account;
  }

  async fetchCreatorProfileByWallet(
    creatorWallet: PublicKey
  ): Promise<OnChainCreatorProfileState | null> {
    const pda = this.deriveCreatorProfilePda(creatorWallet);
    return this.fetchCreatorProfileByPda(pda);
  }

  async fetchCreatorProfileByPda(
    creatorProfilePda: PublicKey
  ): Promise<OnChainCreatorProfileState | null> {
    const creator = await this.fetchOptionalProgramAccount<CreatorProfileAccount>(
      "creatorProfile",
      creatorProfilePda,
      "fetch creator_profile account"
    );
    if (!creator) {
      return null;
    }

    return {
      authority: creator.authority,
      handle: creator.handle,
      payoutUsdcAta: creator.payoutUsdcAta,
      level: Number(creator.level ?? 0),
      status: mapCreatorStatus(creator.status),
      s1Supply: toBigInt(creator.s1Supply),
      s1EarlyCohortSupply: toBigInt(creator.s1EarlyCohortSupply),
      s1RatingBps: Number(creator.s1RatingBps ?? 10_000),
      s1GraduationTargetSupply: toBigInt(creator.s1GraduationTargetSupply ?? 2_500),
      pendingS1RatingBps: Number(creator.pendingS1RatingBps ?? 0),
      pendingS1GraduationTargetSupply: toBigInt(creator.pendingS1GraduationTargetSupply),
      pendingRatingEffectiveAtUnix: toBigInt(creator.pendingRatingEffectiveAt),
      pendingRatingReportDigestHex: creator.pendingRatingReportDigest
        ? Buffer.from(creator.pendingRatingReportDigest).toString("hex")
        : null,
      lastRatingUpdateAtUnix: toBigInt(creator.lastRatingUpdateAt),
      lastRatingReportDigestHex: creator.lastRatingReportDigest
        ? Buffer.from(creator.lastRatingReportDigest).toString("hex")
        : null,
      lastUpgradeAtUnix: toBigInt(creator.lastUpgradeAt),
      createdAtUnix: toBigInt(creator.createdAt),
      updatedAtUnix: toBigInt(creator.updatedAt),
      bump: Number(creator.bump ?? 0),
    };
  }

  async fetchS1BuyoutStateByPda(
    buyoutStatePda: PublicKey
  ): Promise<OnChainS1BuyoutState | null> {
    const buyout = await this.fetchOptionalProgramAccount<S1BuyoutStateAccount>(
      "s1BuyoutState",
      buyoutStatePda,
      "fetch s1_buyout_state account"
    );
    if (!buyout) {
      return null;
    }

    return {
      creatorProfile: buyout.creator,
      winningSponsor: buyout.winningSponsor ?? null,
      usdcDeposited: toBigInt(buyout.usdcDeposited),
      claimableUsdcRemaining: toBigInt(buyout.claimableUsdcRemaining),
      claimableS1SupplyRemaining: toBigInt(buyout.claimableS1SupplyRemaining),
      earlyClaimableUsdcRemaining: toBigInt(buyout.earlyClaimableUsdcRemaining),
      earlyClaimableS1SupplyRemaining: toBigInt(buyout.earlyClaimableS1SupplyRemaining),
      regularClaimableUsdcRemaining: toBigInt(buyout.regularClaimableUsdcRemaining),
      regularClaimableS1SupplyRemaining: toBigInt(buyout.regularClaimableS1SupplyRemaining),
      rageQuitDeadlineUnix: toBigInt(buyout.rageQuitDeadline),
      bump: Number(buyout.bump ?? 0),
    };
  }

  async fetchS1BuyoutOfferByPda(
    buyoutOfferPda: PublicKey
  ): Promise<OnChainS1BuyoutOfferState | null> {
    const offer = await this.fetchOptionalProgramAccount<S1BuyoutOfferAccount>(
      "s1BuyoutOffer",
      buyoutOfferPda,
      "fetch s1_buyout_offer account"
    );
    if (!offer) {
      return null;
    }

    return {
      sponsor: offer.sponsor,
      creatorProfile: offer.creator,
      usdcAmount: toBigInt(offer.usdcAmount),
      createdAtUnix: toBigInt(offer.createdAt),
      sponsorCancelAfterUnix: toBigInt(offer.sponsorCancelAfter),
      bump: Number(offer.bump ?? 0),
    };
  }

  async fetchS1PositionByPda(
    positionPda: PublicKey
  ): Promise<OnChainS1UserPositionState | null> {
    const position = await this.fetchOptionalProgramAccount<S1UserPositionAccount>(
      "s1UserPosition",
      positionPda,
      "fetch s1_user_position account"
    );
    if (!position) {
      return null;
    }

    return {
      user: position.user,
      creatorProfile: position.creator,
      internalTokenBalance: toBigInt(position.internalTokenBalance),
      earlyCohortBalance: toBigInt(position.earlyCohortBalance),
      spumpCostBasis: toBigInt(position.spumpCostBasis),
      firstBoughtAtUnix: toBigInt(position.firstBoughtAt),
      lastBuyDay: toBigInt(position.lastBuyDay),
      dailyBoughtSpump: toBigInt(position.dailyBoughtSpump),
      bump: Number(position.bump ?? 0),
    };
  }

  async fetchProtocolS1Config(): Promise<ProtocolS1ConfigState> {
    const { account } = await this.fetchProtocolConfigState();

    return {
      admin: account.admin,
      dailySpumpEmissionMultiplierBps: Number(account.dailySpumpEmissionMultiplierBps ?? 10_000),
      newUserEmissionBps: Number(account.newUserEmissionBps ?? 10_000),
      newUserEmissionWindowSeconds: Number(toBigInt(account.newUserEmissionWindowSeconds)),
      s1MinUserXp: toBigInt(account.s1MinUserXp),
      maxS1DailyBuySpump: toBigInt(account.maxS1DailyBuySpump),
      s1EarlyCohortSupplyThreshold: toBigInt(account.s1EarlyCohortSupplyThreshold),
      s1EarlyCohortBuyoutCapBps: Number(account.s1EarlyCohortBuyoutCapBps ?? 0),
      s1RageQuitWindowSeconds: Number(toBigInt(account.s1RageQuitWindowSeconds)),
    };
  }

  async updateCreatorS1Rating(params: UpdateCreatorS1RatingParams): Promise<string> {
    const { pda: protocolConfigPda, account: protocolConfig } =
      await this.fetchProtocolConfigState();
    this.assertOracleAuthorityMatches(protocolConfig);

    const creator = new PublicKey(params.creatorWallet);
    const creatorProfilePda = this.deriveCreatorProfilePda(creator);
    const signature = (await this.withRpcTimeout(
      (this.program.methods as any)
        .updateCreatorS1Rating({
          ratingBps: params.ratingBps,
          graduationTargetSupply: toU64Bn(params.graduationTargetSupply, "graduationTargetSupply"),
          reportId: Array.from(parseDigestHex(params.reportIdHex, "reportIdHex")),
          reportDigest: Array.from(parseDigestHex(params.reportDigestHex, "reportDigestHex")),
          observedAt: new BN(params.observedAtUnix.toString()),
        })
        .accounts({
          oracle: this.oracleAuthority.publicKey,
          protocolConfig: protocolConfigPda,
          creatorProfile: creatorProfilePda,
        })
        .rpc(),
      "update creator s1 rating rpc"
    )) as string;

    await this.confirmSignature(signature, "update creator s1 rating confirm");
    return signature;
  }

  async updateProtocolS1Emission(params: UpdateProtocolS1EmissionParams): Promise<string> {
    if (!this.protocolAdmin) {
      throw new Error(
        "Protocol admin keypair is required. Set PROTOCOL_ADMIN_SECRET_KEY or PROTOCOL_ADMIN_KEYPAIR_PATH."
      );
    }

    const { pda: protocolConfigPda, account: protocolConfig } =
      await this.fetchProtocolConfigState();
    this.assertProtocolAdminMatches(protocolConfig);

    const signature = (await this.withRpcTimeout(
      (this.program.methods as any)
        .updateProtocolS1Emission({
          dailySpumpEmissionMultiplierBps: params.dailySpumpEmissionMultiplierBps,
          newUserEmissionBps: params.newUserEmissionBps,
          newUserEmissionWindowSeconds: new BN(String(params.newUserEmissionWindowSeconds)),
          s1MinUserXp: new BN(params.s1MinUserXp.toString()),
          maxS1DailyBuySpump: new BN(params.maxS1DailyBuySpump.toString()),
          s1EarlyCohortSupplyThreshold: new BN(
            params.s1EarlyCohortSupplyThreshold.toString()
          ),
          s1EarlyCohortBuyoutCapBps: params.s1EarlyCohortBuyoutCapBps,
          s1RageQuitWindowSeconds: new BN(String(params.s1RageQuitWindowSeconds)),
        })
        .accounts({
          admin: this.protocolAdmin.publicKey,
          protocolConfig: protocolConfigPda,
        })
        .signers([this.protocolAdmin])
        .rpc(),
      "update protocol s1 emission rpc"
    )) as string;

    await this.confirmSignature(signature, "update protocol s1 emission confirm");
    return signature;
  }

  async fetchProposalState(proposalPda: PublicKey): Promise<OnChainProposalState | null> {
    try {
      const proposal = (await this.withRpcTimeout(
        (this.program.account as any).proposal.fetch(proposalPda),
        "fetch proposal account"
      )) as any;

      return {
        creator: proposal.creator as PublicKey,
        sponsor: (proposal.sponsor as PublicKey | null) ?? null,
        status: mapProposalStatus(proposal.status),
        contentKind: mapProposalContentKind(proposal.contentKind),
        contentHashHex: Buffer.from(proposal.contentHash as number[]).toString("hex"),
        contentAnchorPda: proposal.contentAnchor
          ? (proposal.contentAnchor as PublicKey).toBase58()
          : null,
        track1BaseUsdc: toBigInt(proposal.track1BaseUsdc),
        track1Claimed: Boolean(proposal.track1Claimed),
        track2MetricType: mapProposalMetricType(proposal.track2MetricType),
        track2TargetValue: toBigInt(proposal.track2TargetValue),
        track2MinAchievementBps: Number(proposal.track2MinAchievementBps ?? 0),
        track2UsdcDeposited: toBigInt(proposal.track2UsdcDeposited),
        track2ActualValue:
          proposal.track2ActualValue === null || proposal.track2ActualValue === undefined
            ? null
            : toBigInt(proposal.track2ActualValue),
        track2SettledAtUnix: toBigInt(proposal.track2SettledAt),
        track3UsdcDeposited: toBigInt(proposal.track3UsdcDeposited),
        track3CpsPayout:
          proposal.track3CpsPayout === null || proposal.track3CpsPayout === undefined
            ? null
            : toBigInt(proposal.track3CpsPayout),
        track3DelayDays: Number(proposal.track3DelayDays ?? 0),
        track3SettledAtUnix: toBigInt(proposal.track3SettledAt),
        deadlineUnix: toBigInt(proposal.deadline),
      };
    } catch (error) {
      const message = String(error);
      if (message.includes("Account does not exist")) {
        return null;
      }

      throw error;
    }
  }

  async getSignatureState(signature: string): Promise<SignatureState> {
    const result = await this.withRpcTimeout(
      this.connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      }),
      "get signature status"
    );

    const status = result.value[0];
    if (!status) {
      return "NOT_FOUND";
    }

    if (status.err) {
      return "FAILED";
    }

    if (status.confirmationStatus === "finalized" || status.confirmationStatus === "confirmed") {
      return "SUCCESS";
    }

    return "PENDING";
  }

  async executeSettleTrack1Base(proposalPda: PublicKey): Promise<string> {
    try {
      return await this.executeSettlementRpc({
        operation: "settle_track1_base",
        proposalPda,
        track: "track1",
        rpcFactory: (accounts) =>
          (this.program.methods as any)
            .settleTrack1Base()
            .accounts({
              oracle: this.oracleAuthority.publicKey,
              protocolConfig: accounts.protocolConfigPda,
              proposal: proposalPda,
              proposalUsdcVault: accounts.proposalUsdcVaultPda,
              creatorProfile: accounts.creatorProfilePda,
              creatorUsdcAta: accounts.creatorUsdcAta,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc() as Promise<string>,
      });
    } catch (error) {
      throw this.wrapRpcError("executeSettleTrack1Base", error);
    }
  }

  async executeSettleTrack2(proposalPda: PublicKey, actualValue: number): Promise<string> {
    try {
      return await this.executeSettlementRpc({
        operation: "settle_track2",
        proposalPda,
        track: "track2",
        rpcFactory: (accounts) =>
          (this.program.methods as any)
            .settleTrack2({
              actualValue: toU64Bn(actualValue, "actualValue"),
            })
            .accounts({
              oracle: this.oracleAuthority.publicKey,
              protocolConfig: accounts.protocolConfigPda,
              proposal: proposalPda,
              proposalUsdcVault: accounts.proposalUsdcVaultPda,
              creatorProfile: accounts.creatorProfilePda,
              creatorUsdcAta: accounts.creatorUsdcAta,
              sponsorUsdcAta: this.requireSponsorAta(accounts),
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc() as Promise<string>,
      });
    } catch (error) {
      throw this.wrapRpcError("executeSettleTrack2", error);
    }
  }

  async executeSettleTrack3Cps(
    proposalPda: PublicKey,
    approvedCpsPayout: number
  ): Promise<string> {
    try {
      return await this.executeSettlementRpc({
        operation: "settle_track3_cps",
        proposalPda,
        track: "track3",
        rpcFactory: (accounts) =>
          (this.program.methods as any)
            .settleTrack3Cps({
              approvedCpsPayout: toU64Bn(approvedCpsPayout, "approvedCpsPayout"),
            })
            .accounts({
              oracle: this.oracleAuthority.publicKey,
              protocolConfig: accounts.protocolConfigPda,
              proposal: proposalPda,
              proposalUsdcVault: accounts.proposalUsdcVaultPda,
              creatorProfile: accounts.creatorProfilePda,
              creatorUsdcAta: accounts.creatorUsdcAta,
              sponsorUsdcAta: this.requireSponsorAta(accounts),
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc() as Promise<string>,
      });
    } catch (error) {
      throw this.wrapRpcError("executeSettleTrack3Cps", error);
    }
  }

  async executeAnchorContentHash(
    creator: PublicKey,
    canonicalUrl: string,
    contentHashHex: string
  ): Promise<string> {
    try {
      const context = this.buildContentAnchorContext({
        creator,
        canonicalUrl,
        contentHashHex,
      });
      // In the current hybrid model, server-assisted anchoring works only when the backend controls a matching signer.
      const creatorSigner = this.resolveCreatorSigner(creator);

      const signature = (await this.withRpcTimeout(
        (this.program.methods as any)
          .anchorContentHash({
            canonicalUrl: context.trimmedUrl,
            urlDigest: Array.from(context.urlDigest),
            contentDigest: Array.from(context.contentDigest),
          })
          .accounts({
            creatorAuthority: creator,
            payer: creator,
            creatorProfile: context.creatorProfilePda,
            contentAnchor: context.contentAnchorPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([creatorSigner])
          .rpc(),
        "anchor_content_hash rpc"
      )) as string;

      await this.confirmSignature(signature, "anchor_content_hash confirm");
      return signature;
    } catch (error) {
      throw this.wrapRpcError("executeAnchorContentHash", error);
    }
  }

  async buildAnchorContentHashInstruction(params: {
    creatorWallet: string;
    payerWallet: string;
    canonicalUrl: string;
    contentHashHex: string;
  }): Promise<TransactionInstruction> {
    const creator = new PublicKey(params.creatorWallet);
    const payer = new PublicKey(params.payerWallet);
    const context = this.buildContentAnchorContext({
      creator,
      canonicalUrl: params.canonicalUrl,
      contentHashHex: params.contentHashHex,
    });

    return (this.program.methods as any)
      .anchorContentHash({
        canonicalUrl: context.trimmedUrl,
        urlDigest: Array.from(context.urlDigest),
        contentDigest: Array.from(context.contentDigest),
      })
      .accounts({
        creatorAuthority: creator,
        payer,
        creatorProfile: context.creatorProfilePda,
        contentAnchor: context.contentAnchorPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async buildCreateProposalInstruction(params: {
    creatorWallet: string;
    payerWallet: string;
    proposalPda: string;
    proposalUsdcVaultPda: string;
    contentKind: Record<string, any>;
    contentHashHex: string;
    contentAnchorPda: string;
    track1BaseUsdc: bigint;
    track2MetricType: Record<string, any>;
    track2TargetValue: bigint;
    track2MinAchievementBps: number;
    track3DelayDays: number;
    deadlineUnix: bigint;
  }): Promise<TransactionInstruction> {
    const protocolConfigPda = this.deriveProtocolConfigPda();
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const creator = new PublicKey(params.creatorWallet);
    const payer = new PublicKey(params.payerWallet);
    const proposal = new PublicKey(params.proposalPda);
    const proposalUsdcVault = new PublicKey(params.proposalUsdcVaultPda);
    const creatorProfilePda = this.deriveCreatorProfilePda(creator);
    const contentAnchorPda = new PublicKey(params.contentAnchorPda);

    return (this.program.methods as any)
      .createProposal({
        contentKind: params.contentKind,
        contentHash: Array.from(parseDigestHex(params.contentHashHex, "contentHashHex")),
        contentAnchorPda,
        track1BaseUsdc: new BN(params.track1BaseUsdc.toString()),
        track2MetricType: params.track2MetricType,
        track2TargetValue: new BN(params.track2TargetValue.toString()),
        track2MinAchievementBps: params.track2MinAchievementBps,
        track3DelayDays: params.track3DelayDays,
        deadline: new BN(params.deadlineUnix.toString()),
      })
      .accounts({
        creator,
        payer,
        protocolConfig: protocolConfigPda,
        creatorProfile: creatorProfilePda,
        proposal,
        usdcVault: proposalUsdcVault,
        usdcMint: protocolConfig.usdcMint as PublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .remainingAccounts([
        {
          pubkey: contentAnchorPda,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();
  }

  async buildSponsorFundInstruction(params: {
    sponsorWallet: string;
    proposalPda: string;
    proposalUsdcVaultPda: string;
    track1Amount: bigint;
    track2Amount: bigint;
    track3Amount: bigint;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const sponsor = new PublicKey(params.sponsorWallet);
    const proposal = new PublicKey(params.proposalPda);
    const proposalUsdcVault = new PublicKey(params.proposalUsdcVaultPda);
    const sponsorUsdcAta = getAssociatedTokenAddressSync(
      protocolConfig.usdcMint as PublicKey,
      sponsor
    );

    return (this.program.methods as any)
      .sponsorFund({
        track1Amount: new BN(params.track1Amount.toString()),
        track2Amount: new BN(params.track2Amount.toString()),
        track3Amount: new BN(params.track3Amount.toString()),
      })
      .accounts({
        sponsor,
        proposal,
        sponsorUsdcAta,
        proposalUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async buildClientSignedTransaction(params: {
    payerWallet: string;
    instructions: TransactionInstruction[];
    backendSigners?: Keypair[];
  }): Promise<BuiltClientTransaction> {
    const payer = new PublicKey(params.payerWallet);
    const latestBlockhash = await this.withRpcTimeout(
      this.connection.getLatestBlockhash(PROGRAM_COMMITMENT),
      "fetch latest blockhash for client transaction"
    );
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: params.instructions,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(message);

    if (params.backendSigners && params.backendSigners.length > 0) {
      transaction.sign(params.backendSigners);
    }

    return {
      transactionBase64: Buffer.from(transaction.serialize()).toString("base64"),
      recentBlockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: BigInt(latestBlockhash.lastValidBlockHeight),
    };
  }

  async buildRegisterUserInstruction(params: {
    userWallet: string;
    roleFlags: number;
  }): Promise<TransactionInstruction> {
    const user = new PublicKey(params.userWallet);
    return (this.program.methods as any)
      .registerUser({
        roleFlags: params.roleFlags,
      })
      .accounts({
        authority: user,
        protocolConfig: this.deriveProtocolConfigPda(),
        userProfile: this.deriveUserProfilePda(user),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async buildClaimDailySpumpInstruction(params: {
    userWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const user = new PublicKey(params.userWallet);
    const spumpMint = protocolConfig.spumpMint as PublicKey;

    return (this.program.methods as any)
      .claimDailySpump()
      .accounts({
        user,
        protocolConfig: this.deriveProtocolConfigPda(),
        userProfile: this.deriveUserProfilePda(user),
        userSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          user,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  }

  async buildBuyS1TokenInstruction(params: {
    userWallet: string;
    creatorWallet: string;
    amount: bigint;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const user = new PublicKey(params.userWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const spumpMint = protocolConfig.spumpMint as PublicKey;

    return (this.program.methods as any)
      .buyS1Token({
        amount: new BN(params.amount.toString()),
      })
      .accounts({
        user,
        protocolConfig: this.deriveProtocolConfigPda(),
        userProfile: this.deriveUserProfilePda(user),
        creatorProfile,
        s1UserPosition: this.deriveS1PositionPda(user, creatorProfile),
        userSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          user,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
  }

  async buildSellS1TokenInstruction(params: {
    userWallet: string;
    creatorWallet: string;
    amount: bigint;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const user = new PublicKey(params.userWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const spumpMint = protocolConfig.spumpMint as PublicKey;

    return (this.program.methods as any)
      .sellS1Token({
        amount: new BN(params.amount.toString()),
      })
      .accounts({
        user,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        s1UserPosition: this.deriveS1PositionPda(user, creatorProfile),
        userSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          user,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        creatorRevenueSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          creator,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  }

  async buildInitS1BuyoutInstruction(params: {
    creatorWallet: string;
  }): Promise<TransactionInstruction> {
    const creator = new PublicKey(params.creatorWallet);
    return (this.program.methods as any)
      .initS1Buyout()
      .accounts({
        creator,
        creatorProfile: this.deriveCreatorProfilePda(creator),
      })
      .instruction();
  }

  async buildSubmitBuyoutOfferInstruction(params: {
    sponsorWallet: string;
    creatorWallet: string;
    usdcAmount: bigint;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const sponsor = new PublicKey(params.sponsorWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const buyoutOffer = this.deriveBuyoutOfferPda(sponsor, creatorProfile);
    const usdcMint = protocolConfig.usdcMint as PublicKey;

    return (this.program.methods as any)
      .submitBuyoutOffer({
        usdcAmount: new BN(params.usdcAmount.toString()),
      })
      .accounts({
        sponsor,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        buyoutOffer,
        sponsorUsdcAta: getAssociatedTokenAddressSync(usdcMint, sponsor),
        offerUsdcVault: this.deriveOfferUsdcVaultPda(buyoutOffer),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
  }

  async buildAcceptBuyoutOfferInstruction(params: {
    creatorWallet: string;
    sponsorWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const creator = new PublicKey(params.creatorWallet);
    const sponsor = new PublicKey(params.sponsorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const buyoutOffer = this.deriveBuyoutOfferPda(sponsor, creatorProfile);
    const usdcMint = protocolConfig.usdcMint as PublicKey;

    return (this.program.methods as any)
      .acceptBuyoutOffer()
      .accounts({
        creator,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        buyoutOffer,
        offerUsdcVault: this.deriveOfferUsdcVaultPda(buyoutOffer),
        s1BuyoutState: this.deriveS1BuyoutStatePda(creatorProfile),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async buildCancelBuyoutOfferInstruction(params: {
    sponsorWallet: string;
    creatorWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const sponsor = new PublicKey(params.sponsorWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const buyoutOffer = this.deriveBuyoutOfferPda(sponsor, creatorProfile);
    const usdcMint = protocolConfig.usdcMint as PublicKey;

    return (this.program.methods as any)
      .cancelBuyoutOffer()
      .accounts({
        sponsor,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        s1BuyoutState: this.deriveS1BuyoutStatePda(creatorProfile),
        buyoutOffer,
        sponsorUsdcAta: getAssociatedTokenAddressSync(usdcMint, sponsor),
        offerUsdcVault: this.deriveOfferUsdcVaultPda(buyoutOffer),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async buildReclaimExpiredBuyoutOfferInstruction(params: {
    sponsorWallet: string;
    creatorWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const sponsor = new PublicKey(params.sponsorWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const buyoutOffer = this.deriveBuyoutOfferPda(sponsor, creatorProfile);
    const usdcMint = protocolConfig.usdcMint as PublicKey;

    return (this.program.methods as any)
      .reclaimExpiredBuyoutOffer()
      .accounts({
        sponsor,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        buyoutOffer,
        sponsorUsdcAta: getAssociatedTokenAddressSync(usdcMint, sponsor),
        offerUsdcVault: this.deriveOfferUsdcVaultPda(buyoutOffer),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async buildAbortS1BuyoutInstruction(params: {
    sponsorWallet: string;
    creatorWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const sponsor = new PublicKey(params.sponsorWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const buyoutOffer = this.deriveBuyoutOfferPda(sponsor, creatorProfile);
    const usdcMint = protocolConfig.usdcMint as PublicKey;

    return (this.program.methods as any)
      .abortS1Buyout()
      .accounts({
        sponsor,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        s1BuyoutState: this.deriveS1BuyoutStatePda(creatorProfile),
        buyoutOffer,
        sponsorUsdcAta: getAssociatedTokenAddressSync(usdcMint, sponsor),
        offerUsdcVault: this.deriveOfferUsdcVaultPda(buyoutOffer),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async buildRageQuitS1Instruction(params: {
    userWallet: string;
    creatorWallet: string;
    amount: bigint;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const user = new PublicKey(params.userWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const spumpMint = protocolConfig.spumpMint as PublicKey;

    return (this.program.methods as any)
      .rageQuitS1({
        amount: new BN(params.amount.toString()),
      })
      .accounts({
        user,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        s1BuyoutState: this.deriveS1BuyoutStatePda(creatorProfile),
        s1UserPosition: this.deriveS1PositionPda(user, creatorProfile),
        userSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          user,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  }

  async buildExecuteS1GraduationInstruction(params: {
    executorWallet: string;
    creatorWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const executor = new PublicKey(params.executorWallet);
    const creator = new PublicKey(params.creatorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const spumpMint = protocolConfig.spumpMint as PublicKey;

    return (this.program.methods as any)
      .executeS1Graduation()
      .accounts({
        executor,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        s1BuyoutState: this.deriveS1BuyoutStatePda(creatorProfile),
        creatorRevenueSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          creator,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  }

  async buildClaimS1BuyoutUsdcInstruction(params: {
    userWallet: string;
    creatorWallet: string;
    sponsorWallet: string;
  }): Promise<TransactionInstruction> {
    const protocolConfig = await this.fetchProtocolConfigAccount();
    const user = new PublicKey(params.userWallet);
    const creator = new PublicKey(params.creatorWallet);
    const sponsor = new PublicKey(params.sponsorWallet);
    const creatorProfile = this.deriveCreatorProfilePda(creator);
    const buyoutOffer = this.deriveBuyoutOfferPda(sponsor, creatorProfile);
    const usdcMint = protocolConfig.usdcMint as PublicKey;

    return (this.program.methods as any)
      .claimS1BuyoutUsdc()
      .accounts({
        user,
        protocolConfig: this.deriveProtocolConfigPda(),
        creatorProfile,
        s1BuyoutState: this.deriveS1BuyoutStatePda(creatorProfile),
        s1UserPosition: this.deriveS1PositionPda(user, creatorProfile),
        buyoutOffer,
        offerUsdcVault: this.deriveOfferUsdcVaultPda(buyoutOffer),
        userUsdcAta: getAssociatedTokenAddressSync(usdcMint, user),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async buildClaimEngagementRewardInstruction(params: {
    userWallet: string;
    missionType: UserMissionTypeName;
    rewardAmount: bigint;
    xpGain: bigint;
    newLevel: number | null;
    reportIdHex: string;
    reportDigestHex: string;
    observedAtUnix: bigint;
  }): Promise<{ instruction: TransactionInstruction; oracleSigner: Keypair; rewardReceipt: PublicKey }> {
    const { pda: protocolConfigPda, account: protocolConfig } =
      await this.fetchProtocolConfigState();
    this.assertOracleAuthorityMatches(protocolConfig);

    const user = new PublicKey(params.userWallet);
    const spumpMint = protocolConfig.spumpMint as PublicKey;
    const userProfile = this.deriveUserProfilePda(user);
    const reportId = parseDigestHex(params.reportIdHex, "reportIdHex");
    const rewardReceipt = this.deriveUserRewardReceiptPda(userProfile, reportId);
    const missionType = this.mapUserMissionType(params.missionType);

    const instruction = await (this.program.methods as any)
      .claimEngagementReward({
        missionType,
        rewardAmount: new BN(params.rewardAmount.toString()),
        xpGain: new BN(params.xpGain.toString()),
        newLevel: params.newLevel,
        reportId: Array.from(reportId),
        reportDigest: Array.from(parseDigestHex(params.reportDigestHex, "reportDigestHex")),
        observedAt: new BN(params.observedAtUnix.toString()),
      })
      .accounts({
        user,
        oracle: this.oracleAuthority.publicKey,
        protocolConfig: protocolConfigPda,
        userProfile,
        rewardReceipt,
        userSpumpAta: getAssociatedTokenAddressSync(
          spumpMint,
          user,
          false,
          TOKEN_2022_PROGRAM_ID
        ),
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return {
      instruction,
      oracleSigner: this.oracleAuthority,
      rewardReceipt,
    };
  }

  async sendAndConfirmVersionedTransaction(params: {
    serializedTxBase64: string;
    recentBlockhash: string;
    lastValidBlockHeight: bigint;
  }): Promise<string> {
    const signature = await this.sendVersionedTransaction(params.serializedTxBase64);
    await this.confirmSubmittedVersionedTransaction({
      signature,
      recentBlockhash: params.recentBlockhash,
      lastValidBlockHeight: params.lastValidBlockHeight,
    });

    return signature;
  }

  async sendVersionedTransaction(serializedTxBase64: string): Promise<string> {
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(serializedTxBase64, "base64")
    );

    return this.withRpcTimeout(
      this.connection.sendRawTransaction(transaction.serialize(), {
        preflightCommitment: PROGRAM_COMMITMENT,
        maxRetries: 3,
      }),
      "send versioned transaction"
    );
  }

  async confirmSubmittedVersionedTransaction(params: {
    signature: string;
    recentBlockhash: string;
    lastValidBlockHeight: bigint;
  }): Promise<void> {
    const confirmation = await this.withRpcTimeout(
      this.connection.confirmTransaction(
        {
          blockhash: params.recentBlockhash,
          lastValidBlockHeight: Number(params.lastValidBlockHeight),
          signature: params.signature,
        },
        PROGRAM_COMMITMENT
      ),
      "confirm versioned transaction"
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction ${params.signature} failed during confirmation: ${JSON.stringify(confirmation.value.err)}`
      );
    }
  }

  private async resolveSettlementAccounts(
    proposalPda: PublicKey,
    track: "track1" | "track2" | "track3"
  ): Promise<ResolvedSettlementAccounts> {
    const proposal = await this.fetchProposalState(proposalPda);
    if (!proposal) {
      throw new Error(`Proposal not found on-chain: ${proposalPda.toBase58()}`);
    }

    const { pda: protocolConfigPda, account: protocolConfig } = await this.fetchProtocolConfigState();
    this.assertOracleAuthorityMatches(protocolConfig);
    const { pda: creatorProfilePda, account: creatorProfile } = await this.fetchCreatorProfileState(
      proposal.creator
    );

    const proposalUsdcVaultPda = this.deriveProposalUsdcVaultPda(proposalPda);
    const creatorUsdcAta = creatorProfile.payoutUsdcAta;

    if (track === "track1") {
      return {
        protocolConfigPda,
        proposalUsdcVaultPda,
        creatorProfilePda,
        creatorUsdcAta,
      };
    }

    if (!proposal.sponsor) {
      throw new Error("Proposal has no sponsor; Track2/Track3 settlement requires sponsor ATA");
    }

    const sponsorUsdcAta = getAssociatedTokenAddressSync(
      protocolConfig.usdcMint as PublicKey,
      proposal.sponsor
    );

    return {
      protocolConfigPda,
      proposalUsdcVaultPda,
      creatorProfilePda,
      creatorUsdcAta,
      sponsorUsdcAta,
    };
  }

  private async executeSettlementRpc(params: {
    operation: string;
    proposalPda: PublicKey;
    track: "track1" | "track2" | "track3";
    rpcFactory: (accounts: ResolvedSettlementAccounts) => Promise<string>;
  }): Promise<string> {
    const accounts = await this.resolveSettlementAccounts(params.proposalPda, params.track);
    const signature = await this.withRpcTimeout(
      params.rpcFactory(accounts),
      `${params.operation} rpc`
    );

    await this.confirmSignature(signature, `${params.operation} confirm`);
    return signature;
  }

  private async fetchProgramAccount<T>(
    accountName: string,
    accountAddress: PublicKey,
    operation: string
  ): Promise<T> {
    return this.withRpcTimeout(
      (this.program.account as any)[accountName].fetch(accountAddress),
      operation
    ) as Promise<T>;
  }

  private async fetchOptionalProgramAccount<T>(
    accountName: string,
    accountAddress: PublicKey,
    operation: string
  ): Promise<T | null> {
    try {
      return await this.fetchProgramAccount<T>(accountName, accountAddress, operation);
    } catch (error) {
      const message = String(error);
      if (
        message.includes("Account does not exist") ||
        message.includes("AccountNotFound") ||
        message.includes("could not find account")
      ) {
        return null;
      }

      throw error;
    }
  }

  private async fetchProtocolConfigState(): Promise<{
    pda: PublicKey;
    account: ProtocolConfigAccount;
  }> {
    const pda = this.deriveProtocolConfigPda();
    const account = await this.fetchProgramAccount<ProtocolConfigAccount>(
      "protocolConfig",
      pda,
      "fetch protocol_config account"
    );

    return { pda, account };
  }

  private async fetchCreatorProfileState(creator: PublicKey): Promise<{
    pda: PublicKey;
    account: CreatorProfileAccount;
  }> {
    const pda = this.deriveCreatorProfilePda(creator);
    const account = await this.fetchProgramAccount<CreatorProfileAccount>(
      "creatorProfile",
      pda,
      "fetch creator_profile account"
    );

    return { pda, account };
  }

  private assertOracleAuthorityMatches(protocolConfig: ProtocolConfigAccount): void {
    if (this.oracleAuthority.publicKey.equals(protocolConfig.oracleAuthority)) {
      return;
    }

    throw new Error(
      `Loaded oracle authority (${this.oracleAuthority.publicKey.toBase58()}) does not match protocol_config.oracle_authority (${protocolConfig.oracleAuthority.toBase58()})`
    );
  }

  private assertProtocolAdminMatches(protocolConfig: ProtocolConfigAccount): void {
    if (this.protocolAdmin?.publicKey.equals(protocolConfig.admin)) {
      return;
    }

    const loadedAdmin = this.protocolAdmin?.publicKey.toBase58() ?? "not configured";
    throw new Error(
      `Loaded protocol admin (${loadedAdmin}) does not match protocol_config.admin (${protocolConfig.admin.toBase58()})`
    );
  }

  private buildContentAnchorContext(params: {
    creator: PublicKey;
    canonicalUrl: string;
    contentHashHex: string;
  }): ContentAnchorContext {
    const trimmedUrl = params.canonicalUrl.trim();
    if (!trimmedUrl) {
      throw new Error("canonicalUrl is required");
    }

    const contentDigest = parseDigestHex(params.contentHashHex, "contentHashHex");
    const urlDigest = keccak_256(new TextEncoder().encode(trimmedUrl));
    const creatorProfilePda = this.deriveCreatorProfilePda(params.creator);
    const contentAnchorPda = this.deriveContentAnchorPda(creatorProfilePda, urlDigest);

    return {
      trimmedUrl,
      contentDigest,
      urlDigest,
      creatorProfilePda,
      contentAnchorPda,
    };
  }

  private requireSponsorAta(accounts: {
    sponsorUsdcAta?: PublicKey;
  }): PublicKey {
    if (!accounts.sponsorUsdcAta) {
      throw new Error("Missing sponsor USDC ATA for settlement");
    }

    return accounts.sponsorUsdcAta;
  }

  private mapUserMissionType(missionType: UserMissionTypeName): Record<string, unknown> {
    switch (missionType) {
      case "DAILY_SESSION_5_MIN":
        return { dailySession5Min: {} };
      case "LIKE_10_POSTS":
        return { like10Posts: {} };
      case "FOLLOW_3_CREATORS":
        return { follow3Creators: {} };
      case "SHARE_1_POST":
        return { share1Post: {} };
      case "PUBLISH_FIRST_POST":
        return { publishFirstPost: {} };
      case "COMPLETE_PROFILE":
        return { completeProfile: {} };
      case "SPONSOR_CAMPAIGN_REVIEW":
        return { sponsorCampaignReview: {} };
      default:
        throw new Error(`Unsupported user mission type: ${String(missionType)}`);
    }
  }

  private resolveCreatorSigner(creator: PublicKey): Keypair {
    if (creator.equals(this.oracleAuthority.publicKey)) {
      return this.oracleAuthority;
    }

    if (this.contentAnchorSigner && creator.equals(this.contentAnchorSigner.publicKey)) {
      return this.contentAnchorSigner;
    }

    // If neither signer matches, the backend must fall back to a client-sign flow instead of server-assisted anchoring.
    throw new Error(
      `No backend signer available for creator ${creator.toBase58()}. Configure CONTENT_ANCHOR_SIGNER_SECRET_KEY or CONTENT_ANCHOR_SIGNER_KEYPAIR_PATH.`
    );
  }

  private async confirmSignature(signature: string, operation: string): Promise<void> {
    const latestBlockhash = await this.withRpcTimeout(
      this.connection.getLatestBlockhash(PROGRAM_COMMITMENT),
      "fetch latest blockhash"
    );

    const confirmation = await this.withRpcTimeout(
      this.connection.confirmTransaction(
        {
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          signature,
        },
        PROGRAM_COMMITMENT
      ),
      operation
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction ${signature} failed during confirmation: ${JSON.stringify(confirmation.value.err)}`
      );
    }
  }

  private async withRpcTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new RpcTimeoutError(operation, RPC_TIMEOUT_MS));
        }, RPC_TIMEOUT_MS);
      });

      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private wrapRpcError(operation: string, error: unknown): Error {
    if (error instanceof RpcTimeoutError) {
      return error;
    }

    const message = String(error);
    if (
      message.toLowerCase().includes("timeout") ||
      message.includes("ETIMEDOUT") ||
      message.toLowerCase().includes("fetch failed")
    ) {
      return new RpcTimeoutError(operation, RPC_TIMEOUT_MS);
    }

    return error instanceof Error ? error : new Error(message);
  }
}

export const getAnchorService = (): AnchorService => AnchorService.getInstance();
