"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startIndexer = exports.mergeAnchorEventsWithInstructions = exports.parseAnchorEvents = exports.mapEventNameToInstructionName = exports.selectPrimaryEntityPda = exports.mapInstructionAccounts = exports.normalizeIndexerJson = void 0;
/**
 * CN: 链上日志索引器，基于交易签名拉取交易详情、解码指令并同步数据库投影。
 * EN: On-chain log indexer that fetches transaction details by signature, decodes instructions, and syncs DB projections.
 */
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const default_1 = require("../../config/default");
const chainProjectionService_1 = require("./chainProjectionService");
const AnchorService_1 = require("./AnchorService");
const prisma_1 = require("./prisma");
const INDEXER_FETCH_RETRY_DELAY_MS = 1_000;
const INDEXER_FETCH_MAX_RETRIES = 5;
const PROGRAM_INSTRUCTIONS_FOR_PROJECTION = new Set([
    "create_proposal",
    "sponsor_fund",
    "settle_track1_base",
    "settle_track2",
    "settle_track3_cps",
    "cancel_proposal",
    "emergency_void",
]);
const EVENT_NAME_TO_INSTRUCTION_NAME = {
    ContentAnchored: "anchor_content_hash",
    ProposalCreated: "create_proposal",
    ProposalFunded: "sponsor_fund",
    S1BuyoutAuctionOpened: "init_s1_buyout",
    S1BuyoutOfferSubmitted: "submit_buyout_offer",
    S1BuyoutOfferAccepted: "accept_buyout_offer",
    S1BuyoutOfferReclaimed: "reclaim_expired_buyout_offer",
    S1BuyoutOfferCancelled: "cancel_buyout_offer",
    Track1Settled: "settle_track1_base",
    Track2Settled: "settle_track2",
    Track3Settled: "settle_track3_cps",
    EndorsementSettled: "claim_endorsement",
    ProposalCancelled: "cancel_proposal",
    ProposalVoided: "emergency_void",
    UserProfileRegistered: "register_user",
};
const asErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const sleep = async (delayMs) => new Promise((resolve) => {
    setTimeout(resolve, delayMs);
});
const isPartiallyDecodedInstruction = (instruction) => "accounts" in instruction && "data" in instruction;
const normalizeIndexerJson = (value) => {
    if (value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        return value;
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (value instanceof web3_js_1.PublicKey) {
        return value.toBase58();
    }
    if (Array.isArray(value)) {
        return value.map((item) => (0, exports.normalizeIndexerJson)(item));
    }
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return Buffer.from(value).toString("hex");
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
            key,
            (0, exports.normalizeIndexerJson)(entry),
        ]));
    }
    return String(value);
};
exports.normalizeIndexerJson = normalizeIndexerJson;
const mapInstructionAccounts = (params) => Object.fromEntries(params.accountNames.map((name, index) => [
    name,
    params.accountPubkeys[index]?.toBase58() ?? null,
]));
exports.mapInstructionAccounts = mapInstructionAccounts;
const selectPrimaryEntityPda = (accounts) => accounts.proposal ??
    accounts.creator_profile ??
    accounts.content_anchor ??
    accounts.proposal_usdc_vault ??
    null;
exports.selectPrimaryEntityPda = selectPrimaryEntityPda;
const mapEventNameToInstructionName = (eventName) => EVENT_NAME_TO_INSTRUCTION_NAME[eventName] ?? null;
exports.mapEventNameToInstructionName = mapEventNameToInstructionName;
const extractEntityFromEventPayload = (payload) => {
    const entityCandidates = [
        payload.proposal,
        payload.contentAnchor,
        payload.buyoutOffer,
        payload.userProfile,
        payload.s1BuyoutState,
        payload.creatorProfile,
    ];
    for (const candidate of entityCandidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate;
        }
    }
    return null;
};
const fetchParsedTransactionWithRetry = async (connection, signature) => {
    for (let attempt = 0; attempt < INDEXER_FETCH_MAX_RETRIES; attempt += 1) {
        const response = await connection.getParsedTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
        if (response) {
            return response;
        }
        await sleep(INDEXER_FETCH_RETRY_DELAY_MS);
    }
    return null;
};
const decodeProgramInstructions = (response, targetProgram) => {
    const anchorService = (0, AnchorService_1.getAnchorService)();
    const coder = new anchor_1.BorshCoder(anchorService.program.idl);
    const idlInstructions = anchorService.program.idl.instructions ?? [];
    return response.transaction.message.instructions.flatMap((instruction, instructionIndex) => {
        if (!isPartiallyDecodedInstruction(instruction)) {
            return [];
        }
        if (!instruction.programId.equals(targetProgram)) {
            return [];
        }
        const decodedInstruction = coder.instruction.decode(instruction.data, "base58");
        if (!decodedInstruction) {
            return [];
        }
        const idlInstruction = idlInstructions.find((candidate) => candidate.name === decodedInstruction.name);
        const namedAccounts = (0, exports.mapInstructionAccounts)({
            accountNames: (idlInstruction?.accounts ?? []).map((account) => account.name),
            accountPubkeys: instruction.accounts,
        });
        return [
            {
                instructionIndex,
                instructionName: decodedInstruction.name,
                proposalPda: namedAccounts.proposal ?? null,
                entityPda: (0, exports.selectPrimaryEntityPda)(namedAccounts),
                payload: {
                    args: (0, exports.normalizeIndexerJson)(decodedInstruction.data),
                    accounts: namedAccounts,
                    remainingAccounts: instruction.accounts
                        .slice(idlInstruction?.accounts.length ?? 0)
                        .map((account) => account.toBase58()),
                },
            },
        ];
    });
};
const parseAnchorEvents = (params) => {
    const anchorService = (0, AnchorService_1.getAnchorService)();
    const coder = new anchor_1.BorshCoder(anchorService.program.idl);
    const parser = new anchor_1.EventParser(params.targetProgram, coder);
    return Array.from(parser.parseLogs(params.logMessages)).map((event) => {
        const payload = (0, exports.normalizeIndexerJson)(event.data);
        return {
            eventName: event.name,
            instructionName: (0, exports.mapEventNameToInstructionName)(event.name),
            proposalPda: typeof payload.proposal === "string" && payload.proposal.trim()
                ? payload.proposal
                : null,
            entityPda: extractEntityFromEventPayload(payload),
            payload,
        };
    });
};
exports.parseAnchorEvents = parseAnchorEvents;
const mergeAnchorEventsWithInstructions = (params) => {
    const unmatchedByInstruction = new Map();
    const consumedInstructionIndexes = new Set();
    for (const instruction of params.instructions) {
        const queue = unmatchedByInstruction.get(instruction.instructionName) ?? [];
        queue.push(instruction);
        unmatchedByInstruction.set(instruction.instructionName, queue);
    }
    const mergedFromEvents = [];
    for (const event of params.events) {
        if (!event.instructionName) {
            continue;
        }
        const queue = unmatchedByInstruction.get(event.instructionName);
        const matchedInstruction = queue?.shift();
        if (!matchedInstruction) {
            continue;
        }
        consumedInstructionIndexes.add(matchedInstruction.instructionIndex);
        mergedFromEvents.push({
            instructionIndex: matchedInstruction.instructionIndex,
            instructionName: matchedInstruction.instructionName,
            proposalPda: event.proposalPda ?? matchedInstruction.proposalPda,
            entityPda: event.entityPda ?? matchedInstruction.entityPda,
            payload: {
                source: "anchor_event",
                eventName: event.eventName,
                eventData: event.payload,
                accounts: matchedInstruction.payload.accounts,
                args: matchedInstruction.payload.args,
            },
        });
    }
    const fallbackInstructions = params.instructions.filter((instruction) => !consumedInstructionIndexes.has(instruction.instructionIndex));
    return [...mergedFromEvents, ...fallbackInstructions].sort((left, right) => left.instructionIndex - right.instructionIndex);
};
exports.mergeAnchorEventsWithInstructions = mergeAnchorEventsWithInstructions;
const persistChainInstructions = async (params) => {
    for (const instruction of params.instructions) {
        await prisma_1.prisma.chainEvent.upsert({
            where: {
                signature_instructionIndex: {
                    signature: params.signature,
                    instructionIndex: instruction.instructionIndex,
                },
            },
            update: {
                slot: params.slot,
                programId: params.programId,
                instructionName: instruction.instructionName,
                proposalPda: instruction.proposalPda,
                entityPda: instruction.entityPda,
                payloadJson: instruction.payload,
            },
            create: {
                signature: params.signature,
                instructionIndex: instruction.instructionIndex,
                slot: params.slot,
                programId: params.programId,
                instructionName: instruction.instructionName,
                proposalPda: instruction.proposalPda,
                entityPda: instruction.entityPda,
                payloadJson: instruction.payload,
            },
        });
        if (instruction.proposalPda &&
            PROGRAM_INSTRUCTIONS_FOR_PROJECTION.has(instruction.instructionName)) {
            await (0, chainProjectionService_1.syncProposalProjectionFromChain)({
                proposalPda: instruction.proposalPda,
                signature: params.signature,
                instructionName: instruction.instructionName,
            });
        }
    }
};
const updateIndexerCursor = async (slot, signature) => {
    await prisma_1.prisma.indexerCursor.upsert({
        where: {
            consumerKey: default_1.config.indexer.consumerKey,
        },
        update: {
            lastSeenSlot: slot,
            lastSeenSignature: signature,
        },
        create: {
            consumerKey: default_1.config.indexer.consumerKey,
            lastSeenSlot: slot,
            lastSeenSignature: signature,
        },
    });
};
const processSignature = async (params) => {
    const response = await fetchParsedTransactionWithRetry(params.connection, params.signature);
    if (!response || response.meta?.err) {
        await updateIndexerCursor(params.slot, params.signature);
        return;
    }
    const decodedInstructions = decodeProgramInstructions(response, params.targetProgram);
    const parsedEvents = (0, exports.parseAnchorEvents)({
        logMessages: response.meta?.logMessages ?? [],
        targetProgram: params.targetProgram,
    });
    const instructions = parsedEvents.length > 0
        ? (0, exports.mergeAnchorEventsWithInstructions)({
            events: parsedEvents,
            instructions: decodedInstructions,
        })
        : decodedInstructions;
    if (instructions.length === 0) {
        await updateIndexerCursor(params.slot, params.signature);
        return;
    }
    await persistChainInstructions({
        signature: params.signature,
        slot: params.slot,
        programId: params.targetProgram.toBase58(),
        instructions,
    });
    await updateIndexerCursor(params.slot, params.signature);
};
const backfillRecentSignatures = async (connection, targetProgram) => {
    const cursor = await prisma_1.prisma.indexerCursor.findUnique({
        where: {
            consumerKey: default_1.config.indexer.consumerKey,
        },
    });
    const signatures = await connection.getSignaturesForAddress(targetProgram, {
        limit: default_1.config.indexer.backfillLimit,
    });
    const pending = signatures
        .filter((entry) => !cursor || BigInt(entry.slot) > cursor.lastSeenSlot)
        .sort((left, right) => left.slot - right.slot);
    for (const entry of pending) {
        await processSignature({
            connection,
            targetProgram,
            signature: entry.signature,
            slot: BigInt(entry.slot),
        });
    }
};
const startIndexer = async (rpcEndpoint, programId) => {
    if (!default_1.config.indexer.enabled) {
        console.log("[indexer] disabled by INDEXER_ENABLED=false");
        return null;
    }
    const connection = new web3_js_1.Connection(rpcEndpoint, "confirmed");
    const targetProgram = new web3_js_1.PublicKey(programId);
    const inFlight = new Set();
    await backfillRecentSignatures(connection, targetProgram);
    return connection.onLogs(targetProgram, (logs, context) => {
        if (inFlight.has(logs.signature)) {
            return;
        }
        inFlight.add(logs.signature);
        void processSignature({
            connection,
            targetProgram,
            signature: logs.signature,
            slot: BigInt(context.slot),
        })
            .catch((error) => {
            console.error(`[indexer] failed to ingest ${logs.signature}`, asErrorMessage(error));
        })
            .finally(() => {
            inFlight.delete(logs.signature);
        });
    }, "confirmed");
};
exports.startIndexer = startIndexer;
