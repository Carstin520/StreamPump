"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnchorService = exports.AnchorService = void 0;
/**
 * CN: Anchor 服务封装，负责 IDL 加载、PDA 推导和后端可代执行的链上结算调用。
 * EN: Anchor service wrapper responsible for IDL loading, PDA derivation, and backend-driven on-chain settlement calls.
 */
const fs_1 = require("fs");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const sha3_1 = require("@noble/hashes/sha3");
const anchor_1 = require("@coral-xyz/anchor");
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const default_1 = require("../../config/default");
const RPC_TIMEOUT_MS = Number(process.env.ORACLE_RPC_TIMEOUT_MS ?? 25_000);
const PROGRAM_COMMITMENT = "confirmed";
class RpcTimeoutError extends Error {
    constructor(operation, timeoutMs) {
        super(`RPC timeout after ${timeoutMs}ms (${operation})`);
        this.name = "RpcTimeoutError";
    }
}
const toBigInt = (value) => {
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
const toU64Bn = (value, fieldName) => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }
    if (!Number.isSafeInteger(value)) {
        throw new Error(`${fieldName} exceeds JavaScript safe integer range`);
    }
    return new anchor_1.BN(String(value));
};
const anchorEnumKey = (value) => {
    if (typeof value === "string") {
        return value.trim();
    }
    if (value && typeof value === "object") {
        const firstKey = Object.keys(value)[0];
        if (firstKey) {
            return firstKey;
        }
    }
    throw new Error(`Unable to resolve Anchor enum key from value: ${String(value)}`);
};
const mapProposalStatus = (value) => {
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
const mapProposalMetricType = (value) => {
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
const mapProposalContentKind = (value) => {
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
const resolveHomePath = (inputPath) => {
    if (inputPath.startsWith("~/")) {
        return path_1.default.join(os_1.default.homedir(), inputPath.slice(2));
    }
    return inputPath;
};
const parseKeypairSecret = (secret, envName) => {
    try {
        const parsed = JSON.parse(secret);
        return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
    catch (error) {
        throw new Error(`Failed to parse ${envName}: ${String(error)}`);
    }
};
const loadKeypairFromPath = (keypairPath, label) => {
    const resolvedPath = resolveHomePath(keypairPath);
    if (!(0, fs_1.existsSync)(resolvedPath)) {
        throw new Error(`${label} keypair not found at ${resolvedPath}`);
    }
    try {
        const raw = (0, fs_1.readFileSync)(resolvedPath, "utf8");
        const parsed = JSON.parse(raw);
        return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
    catch (error) {
        throw new Error(`Failed to load ${label} keypair: ${String(error)}`);
    }
};
const loadOracleAuthorityKeypair = () => {
    const inlineSecret = process.env.ORACLE_AUTHORITY_SECRET_KEY?.trim();
    if (inlineSecret) {
        return parseKeypairSecret(inlineSecret, "ORACLE_AUTHORITY_SECRET_KEY");
    }
    const keypairPath = process.env.ORACLE_AUTHORITY_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json";
    return loadKeypairFromPath(keypairPath, "Oracle authority");
};
const loadOptionalContentAnchorSigner = () => {
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
const parseDigestHex = (digestHex, label) => {
    const normalized = digestHex.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
        throw new Error(`${label} must be a 64-character hex string`);
    }
    return Uint8Array.from(Buffer.from(normalized, "hex"));
};
const resolveIdlPath = () => {
    const explicitPath = process.env.STREAMPUMP_IDL_PATH?.trim();
    if (explicitPath) {
        const resolved = resolveHomePath(explicitPath);
        if ((0, fs_1.existsSync)(resolved)) {
            return resolved;
        }
    }
    const candidates = [
        path_1.default.resolve(process.cwd(), "target/idl/streampump_core.json"),
        path_1.default.resolve(process.cwd(), "../target/idl/streampump_core.json"),
        path_1.default.resolve(__dirname, "../../../target/idl/streampump_core.json"),
        path_1.default.resolve(__dirname, "../../../../target/idl/streampump_core.json"),
    ];
    for (const candidate of candidates) {
        if ((0, fs_1.existsSync)(candidate)) {
            return candidate;
        }
    }
    throw new Error("Unable to find streampump_core IDL. Set STREAMPUMP_IDL_PATH or place IDL under target/idl.");
};
class AnchorService {
    static instance = null;
    connection;
    provider;
    program;
    oracleAuthority;
    contentAnchorSigner;
    constructor() {
        this.connection = new web3_js_1.Connection(default_1.config.solana.rpcEndpoint, PROGRAM_COMMITMENT);
        this.oracleAuthority = loadOracleAuthorityKeypair();
        this.contentAnchorSigner = loadOptionalContentAnchorSigner();
        this.provider = new anchor_1.AnchorProvider(this.connection, new anchor_1.Wallet(this.oracleAuthority), anchor_1.AnchorProvider.defaultOptions());
        // The backend reads the locally generated IDL so RPC method names stay aligned with the Rust program.
        const idlPath = resolveIdlPath();
        const rawIdl = (0, fs_1.readFileSync)(idlPath, "utf8");
        const idl = JSON.parse(rawIdl);
        this.program = new anchor_1.Program(idl, this.provider);
    }
    static getInstance() {
        if (!AnchorService.instance) {
            AnchorService.instance = new AnchorService();
        }
        return AnchorService.instance;
    }
    getProgramId() {
        return this.program.programId;
    }
    getOracleAuthorityPublicKey() {
        return this.oracleAuthority.publicKey;
    }
    deriveProtocolConfigPda() {
        const [protocolConfig] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("protocol_config")], this.program.programId);
        return protocolConfig;
    }
    deriveCreatorProfilePda(creator) {
        const [creatorProfile] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("creator"), creator.toBuffer()], this.program.programId);
        return creatorProfile;
    }
    deriveProposalPda(creator, deadlineUnix) {
        const deadlineSeed = Buffer.alloc(8);
        deadlineSeed.writeBigInt64LE(deadlineUnix);
        const [proposal] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("proposal"), creator.toBuffer(), deadlineSeed], this.program.programId);
        return proposal;
    }
    deriveProposalUsdcVaultPda(proposalPda) {
        const [vault] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("proposal_usdc_vault"), proposalPda.toBuffer()], this.program.programId);
        return vault;
    }
    deriveContentAnchorPda(creatorProfilePda, urlDigest) {
        const [contentAnchor] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("content_anchor"), creatorProfilePda.toBuffer(), Buffer.from(urlDigest)], this.program.programId);
        return contentAnchor;
    }
    async fetchProtocolConfigAccount() {
        const protocolConfigPda = this.deriveProtocolConfigPda();
        return this.withRpcTimeout(this.program.account.protocolConfig.fetch(protocolConfigPda), "fetch protocol_config account");
    }
    async fetchProposalState(proposalPda) {
        try {
            const proposal = (await this.withRpcTimeout(this.program.account.proposal.fetch(proposalPda), "fetch proposal account"));
            return {
                creator: proposal.creator,
                sponsor: proposal.sponsor ?? null,
                status: mapProposalStatus(proposal.status),
                contentKind: mapProposalContentKind(proposal.contentKind),
                contentHashHex: Buffer.from(proposal.contentHash).toString("hex"),
                contentAnchorPda: proposal.contentAnchor
                    ? proposal.contentAnchor.toBase58()
                    : null,
                track1BaseUsdc: toBigInt(proposal.track1BaseUsdc),
                track1Claimed: Boolean(proposal.track1Claimed),
                track2MetricType: mapProposalMetricType(proposal.track2MetricType),
                track2TargetValue: toBigInt(proposal.track2TargetValue),
                track2MinAchievementBps: Number(proposal.track2MinAchievementBps ?? 0),
                track2UsdcDeposited: toBigInt(proposal.track2UsdcDeposited),
                track2ActualValue: proposal.track2ActualValue === null || proposal.track2ActualValue === undefined
                    ? null
                    : toBigInt(proposal.track2ActualValue),
                track2SettledAtUnix: toBigInt(proposal.track2SettledAt),
                track3UsdcDeposited: toBigInt(proposal.track3UsdcDeposited),
                track3CpsPayout: proposal.track3CpsPayout === null || proposal.track3CpsPayout === undefined
                    ? null
                    : toBigInt(proposal.track3CpsPayout),
                track3DelayDays: Number(proposal.track3DelayDays ?? 0),
                track3SettledAtUnix: toBigInt(proposal.track3SettledAt),
                deadlineUnix: toBigInt(proposal.deadline),
            };
        }
        catch (error) {
            const message = String(error);
            if (message.includes("Account does not exist")) {
                return null;
            }
            throw error;
        }
    }
    async getSignatureState(signature) {
        const result = await this.withRpcTimeout(this.connection.getSignatureStatuses([signature], {
            searchTransactionHistory: true,
        }), "get signature status");
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
    async executeSettleTrack1Base(proposalPda) {
        try {
            const accounts = await this.resolveSettlementAccounts(proposalPda, "track1");
            const signature = (await this.withRpcTimeout(this.program.methods
                .settleTrack1Base()
                .accounts({
                oracle: this.oracleAuthority.publicKey,
                protocolConfig: accounts.protocolConfigPda,
                proposal: proposalPda,
                proposalUsdcVault: accounts.proposalUsdcVaultPda,
                creatorProfile: accounts.creatorProfilePda,
                creatorUsdcAta: accounts.creatorUsdcAta,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            })
                .rpc(), "settle_track1_base rpc"));
            await this.confirmSignature(signature, "settle_track1_base confirm");
            return signature;
        }
        catch (error) {
            throw this.wrapRpcError("executeSettleTrack1Base", error);
        }
    }
    async executeSettleTrack2(proposalPda, actualValue) {
        try {
            const accounts = await this.resolveSettlementAccounts(proposalPda, "track2");
            const sponsorUsdcAta = this.requireSponsorAta(accounts);
            const signature = (await this.withRpcTimeout(this.program.methods
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
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            })
                .rpc(), "settle_track2 rpc"));
            await this.confirmSignature(signature, "settle_track2 confirm");
            return signature;
        }
        catch (error) {
            throw this.wrapRpcError("executeSettleTrack2", error);
        }
    }
    async executeSettleTrack3Cps(proposalPda, approvedCpsPayout) {
        try {
            const accounts = await this.resolveSettlementAccounts(proposalPda, "track3");
            const sponsorUsdcAta = this.requireSponsorAta(accounts);
            const signature = (await this.withRpcTimeout(this.program.methods
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
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            })
                .rpc(), "settle_track3_cps rpc"));
            await this.confirmSignature(signature, "settle_track3_cps confirm");
            return signature;
        }
        catch (error) {
            throw this.wrapRpcError("executeSettleTrack3Cps", error);
        }
    }
    async executeAnchorContentHash(creator, canonicalUrl, contentHashHex) {
        try {
            const trimmedUrl = canonicalUrl.trim();
            if (!trimmedUrl) {
                throw new Error("canonicalUrl is required");
            }
            const contentDigest = parseDigestHex(contentHashHex, "contentHashHex");
            const urlDigest = (0, sha3_1.keccak_256)(new TextEncoder().encode(trimmedUrl));
            const creatorProfilePda = this.deriveCreatorProfilePda(creator);
            const contentAnchorPda = this.deriveContentAnchorPda(creatorProfilePda, urlDigest);
            // In the current hybrid model, server-assisted anchoring works only when the backend controls a matching signer.
            const creatorSigner = this.resolveCreatorSigner(creator);
            const signature = (await this.withRpcTimeout(this.program.methods
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
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([creatorSigner])
                .rpc(), "anchor_content_hash rpc"));
            await this.confirmSignature(signature, "anchor_content_hash confirm");
            return signature;
        }
        catch (error) {
            throw this.wrapRpcError("executeAnchorContentHash", error);
        }
    }
    async buildAnchorContentHashInstruction(params) {
        const trimmedUrl = params.canonicalUrl.trim();
        if (!trimmedUrl) {
            throw new Error("canonicalUrl is required");
        }
        const creator = new web3_js_1.PublicKey(params.creatorWallet);
        const payer = new web3_js_1.PublicKey(params.payerWallet);
        const creatorProfilePda = this.deriveCreatorProfilePda(creator);
        const urlDigest = (0, sha3_1.keccak_256)(new TextEncoder().encode(trimmedUrl));
        const contentDigest = parseDigestHex(params.contentHashHex, "contentHashHex");
        const contentAnchorPda = this.deriveContentAnchorPda(creatorProfilePda, urlDigest);
        return this.program.methods
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
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
    }
    async buildCreateProposalInstruction(params) {
        const protocolConfigPda = this.deriveProtocolConfigPda();
        const protocolConfig = await this.fetchProtocolConfigAccount();
        const creator = new web3_js_1.PublicKey(params.creatorWallet);
        const payer = new web3_js_1.PublicKey(params.payerWallet);
        const proposal = new web3_js_1.PublicKey(params.proposalPda);
        const proposalUsdcVault = new web3_js_1.PublicKey(params.proposalUsdcVaultPda);
        const creatorProfilePda = this.deriveCreatorProfilePda(creator);
        const contentAnchorPda = new web3_js_1.PublicKey(params.contentAnchorPda);
        return this.program.methods
            .createProposal({
            contentKind: params.contentKind,
            contentHash: Array.from(parseDigestHex(params.contentHashHex, "contentHashHex")),
            contentAnchorPda,
            track1BaseUsdc: new anchor_1.BN(params.track1BaseUsdc.toString()),
            track2MetricType: params.track2MetricType,
            track2TargetValue: new anchor_1.BN(params.track2TargetValue.toString()),
            track2MinAchievementBps: params.track2MinAchievementBps,
            track3DelayDays: params.track3DelayDays,
            deadline: new anchor_1.BN(params.deadlineUnix.toString()),
        })
            .accounts({
            creator,
            payer,
            protocolConfig: protocolConfigPda,
            creatorProfile: creatorProfilePda,
            proposal,
            usdcVault: proposalUsdcVault,
            usdcMint: protocolConfig.usdcMint,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
            rent: web3_js_1.SYSVAR_RENT_PUBKEY,
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
    async buildSponsorFundInstruction(params) {
        const protocolConfig = await this.fetchProtocolConfigAccount();
        const sponsor = new web3_js_1.PublicKey(params.sponsorWallet);
        const proposal = new web3_js_1.PublicKey(params.proposalPda);
        const proposalUsdcVault = new web3_js_1.PublicKey(params.proposalUsdcVaultPda);
        const sponsorUsdcAta = (0, spl_token_1.getAssociatedTokenAddressSync)(protocolConfig.usdcMint, sponsor);
        return this.program.methods
            .sponsorFund({
            track1Amount: new anchor_1.BN(params.track1Amount.toString()),
            track2Amount: new anchor_1.BN(params.track2Amount.toString()),
            track3Amount: new anchor_1.BN(params.track3Amount.toString()),
        })
            .accounts({
            sponsor,
            proposal,
            sponsorUsdcAta,
            proposalUsdcVault,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .instruction();
    }
    async sendAndConfirmVersionedTransaction(params) {
        const signature = await this.sendVersionedTransaction(params.serializedTxBase64);
        await this.confirmSubmittedVersionedTransaction({
            signature,
            recentBlockhash: params.recentBlockhash,
            lastValidBlockHeight: params.lastValidBlockHeight,
        });
        return signature;
    }
    async sendVersionedTransaction(serializedTxBase64) {
        const transaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(serializedTxBase64, "base64"));
        return this.withRpcTimeout(this.connection.sendRawTransaction(transaction.serialize(), {
            preflightCommitment: PROGRAM_COMMITMENT,
            maxRetries: 3,
        }), "send versioned transaction");
    }
    async confirmSubmittedVersionedTransaction(params) {
        const confirmation = await this.withRpcTimeout(this.connection.confirmTransaction({
            blockhash: params.recentBlockhash,
            lastValidBlockHeight: Number(params.lastValidBlockHeight),
            signature: params.signature,
        }, PROGRAM_COMMITMENT), "confirm versioned transaction");
        if (confirmation.value.err) {
            throw new Error(`Transaction ${params.signature} failed during confirmation: ${JSON.stringify(confirmation.value.err)}`);
        }
    }
    async resolveSettlementAccounts(proposalPda, track) {
        const proposal = await this.fetchProposalState(proposalPda);
        if (!proposal) {
            throw new Error(`Proposal not found on-chain: ${proposalPda.toBase58()}`);
        }
        const protocolConfigPda = this.deriveProtocolConfigPda();
        const protocolConfig = (await this.withRpcTimeout(this.program.account.protocolConfig.fetch(protocolConfigPda), "fetch protocol_config account"));
        if (!this.oracleAuthority.publicKey.equals(protocolConfig.oracleAuthority)) {
            throw new Error(`Loaded oracle authority (${this.oracleAuthority.publicKey.toBase58()}) does not match protocol_config.oracle_authority (${protocolConfig.oracleAuthority.toBase58()})`);
        }
        const creatorProfilePda = this.deriveCreatorProfilePda(proposal.creator);
        const creatorProfile = (await this.withRpcTimeout(this.program.account.creatorProfile.fetch(creatorProfilePda), "fetch creator_profile account"));
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
        const sponsorUsdcAta = (0, spl_token_1.getAssociatedTokenAddressSync)(protocolConfig.usdcMint, proposal.sponsor);
        return {
            protocolConfigPda,
            proposalUsdcVaultPda,
            creatorProfilePda,
            creatorUsdcAta,
            sponsorUsdcAta,
        };
    }
    requireSponsorAta(accounts) {
        if (!accounts.sponsorUsdcAta) {
            throw new Error("Missing sponsor USDC ATA for settlement");
        }
        return accounts.sponsorUsdcAta;
    }
    resolveCreatorSigner(creator) {
        if (creator.equals(this.oracleAuthority.publicKey)) {
            return this.oracleAuthority;
        }
        if (this.contentAnchorSigner && creator.equals(this.contentAnchorSigner.publicKey)) {
            return this.contentAnchorSigner;
        }
        // If neither signer matches, the backend must fall back to a client-sign flow instead of server-assisted anchoring.
        throw new Error(`No backend signer available for creator ${creator.toBase58()}. Configure CONTENT_ANCHOR_SIGNER_SECRET_KEY or CONTENT_ANCHOR_SIGNER_KEYPAIR_PATH.`);
    }
    async confirmSignature(signature, operation) {
        const latestBlockhash = await this.withRpcTimeout(this.connection.getLatestBlockhash(PROGRAM_COMMITMENT), "fetch latest blockhash");
        const confirmation = await this.withRpcTimeout(this.connection.confirmTransaction({
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature,
        }, PROGRAM_COMMITMENT), operation);
        if (confirmation.value.err) {
            throw new Error(`Transaction ${signature} failed during confirmation: ${JSON.stringify(confirmation.value.err)}`);
        }
    }
    async withRpcTimeout(promise, operation) {
        let timeoutId;
        try {
            const timeoutPromise = new Promise((_resolve, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new RpcTimeoutError(operation, RPC_TIMEOUT_MS));
                }, RPC_TIMEOUT_MS);
            });
            return await Promise.race([promise, timeoutPromise]);
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
    wrapRpcError(operation, error) {
        if (error instanceof RpcTimeoutError) {
            return error;
        }
        const message = String(error);
        if (message.toLowerCase().includes("timeout") ||
            message.includes("ETIMEDOUT") ||
            message.toLowerCase().includes("fetch failed")) {
            return new RpcTimeoutError(operation, RPC_TIMEOUT_MS);
        }
        return error instanceof Error ? error : new Error(message);
    }
}
exports.AnchorService = AnchorService;
const getAnchorService = () => AnchorService.getInstance();
exports.getAnchorService = getAnchorService;
