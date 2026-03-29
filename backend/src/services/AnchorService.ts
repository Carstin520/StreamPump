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
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
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

  private constructor() {
    this.connection = new Connection(config.solana.rpcEndpoint, PROGRAM_COMMITMENT);
    this.oracleAuthority = loadOracleAuthorityKeypair();
    this.contentAnchorSigner = loadOptionalContentAnchorSigner();
    this.provider = new AnchorProvider(
      this.connection,
      new Wallet(this.oracleAuthority),
      AnchorProvider.defaultOptions()
    );

    // The backend reads the locally generated IDL so RPC method names stay aligned with the Rust program.
    const idlPath = resolveIdlPath();
    const rawIdl = readFileSync(idlPath, "utf8");
    const idl = JSON.parse(rawIdl) as Idl;

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

  async fetchProtocolConfigAccount(): Promise<any> {
    const protocolConfigPda = this.deriveProtocolConfigPda();

    return this.withRpcTimeout(
      (this.program.account as any).protocolConfig.fetch(protocolConfigPda),
      "fetch protocol_config account"
    );
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
      const accounts = await this.resolveSettlementAccounts(proposalPda, "track1");

      const signature = (await this.withRpcTimeout(
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
          .rpc(),
        "settle_track1_base rpc"
      )) as string;

      await this.confirmSignature(signature, "settle_track1_base confirm");
      return signature;
    } catch (error) {
      throw this.wrapRpcError("executeSettleTrack1Base", error);
    }
  }

  async executeSettleTrack2(proposalPda: PublicKey, actualValue: number): Promise<string> {
    try {
      const accounts = await this.resolveSettlementAccounts(proposalPda, "track2");
      const sponsorUsdcAta = this.requireSponsorAta(accounts);

      const signature = (await this.withRpcTimeout(
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
            sponsorUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
        "settle_track2 rpc"
      )) as string;

      await this.confirmSignature(signature, "settle_track2 confirm");
      return signature;
    } catch (error) {
      throw this.wrapRpcError("executeSettleTrack2", error);
    }
  }

  async executeSettleTrack3Cps(
    proposalPda: PublicKey,
    approvedCpsPayout: number
  ): Promise<string> {
    try {
      const accounts = await this.resolveSettlementAccounts(proposalPda, "track3");
      const sponsorUsdcAta = this.requireSponsorAta(accounts);

      const signature = (await this.withRpcTimeout(
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
            sponsorUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
        "settle_track3_cps rpc"
      )) as string;

      await this.confirmSignature(signature, "settle_track3_cps confirm");
      return signature;
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
      const trimmedUrl = canonicalUrl.trim();
      if (!trimmedUrl) {
        throw new Error("canonicalUrl is required");
      }

      const contentDigest = parseDigestHex(contentHashHex, "contentHashHex");
      const urlDigest = keccak_256(new TextEncoder().encode(trimmedUrl));
      const creatorProfilePda = this.deriveCreatorProfilePda(creator);
      const contentAnchorPda = this.deriveContentAnchorPda(creatorProfilePda, urlDigest);
      // In the current hybrid model, server-assisted anchoring works only when the backend controls a matching signer.
      const creatorSigner = this.resolveCreatorSigner(creator);

      const signature = (await this.withRpcTimeout(
        (this.program.methods as any)
          .anchorContentHash({
            canonicalUrl: trimmedUrl,
            urlDigest: Array.from(urlDigest),
            contentDigest: Array.from(contentDigest),
          })
          .accounts({
            creatorAuthority: creator,
            payer: creator,
            creatorProfile: creatorProfilePda,
            contentAnchor: contentAnchorPda,
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
    const trimmedUrl = params.canonicalUrl.trim();
    if (!trimmedUrl) {
      throw new Error("canonicalUrl is required");
    }

    const creator = new PublicKey(params.creatorWallet);
    const payer = new PublicKey(params.payerWallet);
    const creatorProfilePda = this.deriveCreatorProfilePda(creator);
    const urlDigest = keccak_256(new TextEncoder().encode(trimmedUrl));
    const contentDigest = parseDigestHex(params.contentHashHex, "contentHashHex");
    const contentAnchorPda = this.deriveContentAnchorPda(creatorProfilePda, urlDigest);

    return (this.program.methods as any)
      .anchorContentHash({
        canonicalUrl: trimmedUrl,
        urlDigest: Array.from(urlDigest),
        contentDigest: Array.from(contentDigest),
      })
      .accounts({
        creatorAuthority: creator,
        payer,
        creatorProfile: creatorProfilePda,
        contentAnchor: contentAnchorPda,
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
  ): Promise<{
    protocolConfigPda: PublicKey;
    proposalUsdcVaultPda: PublicKey;
    creatorProfilePda: PublicKey;
    creatorUsdcAta: PublicKey;
    sponsorUsdcAta?: PublicKey;
  }> {
    const proposal = await this.fetchProposalState(proposalPda);
    if (!proposal) {
      throw new Error(`Proposal not found on-chain: ${proposalPda.toBase58()}`);
    }

    const protocolConfigPda = this.deriveProtocolConfigPda();
    const protocolConfig = (await this.withRpcTimeout(
      (this.program.account as any).protocolConfig.fetch(protocolConfigPda),
      "fetch protocol_config account"
    )) as any;

    if (
      !this.oracleAuthority.publicKey.equals(
        protocolConfig.oracleAuthority as PublicKey
      )
    ) {
      throw new Error(
        `Loaded oracle authority (${this.oracleAuthority.publicKey.toBase58()}) does not match protocol_config.oracle_authority (${(
          protocolConfig.oracleAuthority as PublicKey
        ).toBase58()})`
      );
    }

    const creatorProfilePda = this.deriveCreatorProfilePda(proposal.creator);
    const creatorProfile = (await this.withRpcTimeout(
      (this.program.account as any).creatorProfile.fetch(creatorProfilePda),
      "fetch creator_profile account"
    )) as any;

    const proposalUsdcVaultPda = this.deriveProposalUsdcVaultPda(proposalPda);
    const creatorUsdcAta = creatorProfile.payoutUsdcAta as PublicKey;

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

  private requireSponsorAta(accounts: {
    sponsorUsdcAta?: PublicKey;
  }): PublicKey {
    if (!accounts.sponsorUsdcAta) {
      throw new Error("Missing sponsor USDC ATA for settlement");
    }

    return accounts.sponsorUsdcAta;
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
