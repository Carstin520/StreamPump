/**
 * CN: 链上日志索引器，基于交易签名拉取交易详情、解码指令并同步数据库投影。
 * EN: On-chain log indexer that fetches transaction details by signature, decodes instructions, and syncs DB projections.
 */
import { BN, BorshCoder, EventParser } from "@coral-xyz/anchor";
import {
  Connection,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";

import { config } from "../../config/default";
import { syncProposalProjectionFromChain } from "./chainProjectionService";
import { getAnchorService } from "./AnchorService";
import { syncMarketProjectionFromChainInstruction } from "./marketProjectionService";
import { prisma } from "./prisma";

const INDEXER_FETCH_RETRY_DELAY_MS = 1_000;
const INDEXER_FETCH_MAX_RETRIES = 5;

type DecodedChainInstruction = {
  instructionIndex: number;
  instructionName: string;
  proposalPda: string | null;
  entityPda: string | null;
  payload: Record<string, unknown>;
};

type ParsedAnchorEventRecord = {
  eventName: string;
  instructionName: string | null;
  proposalPda: string | null;
  entityPda: string | null;
  payload: Record<string, unknown>;
};

const PROGRAM_INSTRUCTIONS_FOR_PROJECTION = new Set([
  "create_proposal",
  "sponsor_fund",
  "settle_track1_base",
  "settle_track2",
  "settle_track3_cps",
  "claim_endorsement",
  "cancel_proposal",
  "emergency_void",
]);

const EVENT_NAME_TO_INSTRUCTION_NAME: Record<string, string> = {
  ContentAnchored: "anchor_content_hash",
  ProposalCreated: "create_proposal",
  ProposalFunded: "sponsor_fund",
  S1BuyoutAuctionOpened: "init_s1_buyout",
  S1BuyoutOfferSubmitted: "submit_buyout_offer",
  S1BuyoutOfferAccepted: "accept_buyout_offer",
  S1BuyoutOfferReclaimed: "reclaim_expired_buyout_offer",
  S1BuyoutOfferCancelled: "cancel_buyout_offer",
  S1BuyoutAborted: "abort_s1_buyout",
  S1TokenBought: "buy_s1_token",
  S1TokenSold: "sell_s1_token",
  S1RageQuit: "rage_quit_s1",
  CreatorS1RatingUpdated: "update_creator_s1_rating",
  ProtocolS1EmissionUpdated: "update_protocol_s1_emission",
  S1Graduated: "execute_s1_graduation",
  S1BuyoutUsdcClaimed: "claim_s1_buyout_usdc",
  Track1Settled: "settle_track1_base",
  Track2Settled: "settle_track2",
  Track3Settled: "settle_track3_cps",
  EndorsementSettled: "claim_endorsement",
  ProposalCancelled: "cancel_proposal",
  ProposalVoided: "emergency_void",
  UserProfileRegistered: "register_user",
};

const asErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const sleep = async (delayMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const normalizeInstructionName = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const isPartiallyDecodedInstruction = (
  instruction: ParsedInstruction | PartiallyDecodedInstruction
): instruction is PartiallyDecodedInstruction => "accounts" in instruction && "data" in instruction;

export const normalizeIndexerJson = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (BN.isBN(value)) {
    return (value as BN).toString();
  }

  if (value instanceof PublicKey) {
    return value.toBase58();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeIndexerJson(item));
  }

  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString("hex");
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeIndexerJson(entry),
      ])
    );
  }

  return String(value);
};

export const mapInstructionAccounts = (params: {
  accountNames: string[];
  accountPubkeys: PublicKey[];
}) =>
  Object.fromEntries(
    params.accountNames.map((name, index) => [
      name,
      params.accountPubkeys[index]?.toBase58() ?? null,
    ])
  );

export const selectPrimaryEntityPda = (accounts: Record<string, string | null>): string | null =>
  accounts.proposal ??
  accounts.creator_profile ??
  accounts.creatorProfile ??
  accounts.content_anchor ??
  accounts.contentAnchor ??
  accounts.proposal_usdc_vault ??
  accounts.proposalUsdcVault ??
  accounts.s1UserPosition ??
  accounts.s1_buyout_state ??
  accounts.s1BuyoutState ??
  accounts.buyoutOffer ??
  null;

export const mapEventNameToInstructionName = (eventName: string): string | null =>
  EVENT_NAME_TO_INSTRUCTION_NAME[eventName] ?? null;

const extractEntityFromEventPayload = (payload: Record<string, unknown>): string | null => {
  const entityCandidates = [
    payload.proposal,
    payload.contentAnchor,
    payload.buyoutOffer,
    payload.userProfile,
    payload.creatorProfile,
    payload.s1UserPosition,
    payload.s1BuyoutState,
  ];

  for (const candidate of entityCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
};

const fetchParsedTransactionWithRetry = async (
  connection: Connection,
  signature: string
): Promise<ParsedTransactionWithMeta | null> => {
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

const decodeProgramInstructions = (
  response: ParsedTransactionWithMeta,
  targetProgram: PublicKey
): DecodedChainInstruction[] => {
  const anchorService = getAnchorService();
  const coder = new BorshCoder(anchorService.program.idl as any);
  const idlInstructions =
    ((anchorService.program.idl as any).instructions as Array<{
      name: string;
      accounts: Array<{ name: string }>;
    }>) ?? [];

  return response.transaction.message.instructions.flatMap((instruction, instructionIndex) => {
    if (!isPartiallyDecodedInstruction(instruction)) {
      return [];
    }

    if (!instruction.programId.equals(targetProgram)) {
      return [];
    }

    const decodedInstruction = coder.instruction.decode(instruction.data, "base58") as
      | {
          name: string;
          data: Record<string, unknown>;
        }
      | null;
    if (!decodedInstruction) {
      return [];
    }

    const idlInstruction = idlInstructions.find(
      (candidate) => candidate.name === decodedInstruction.name
    );
    const namedAccounts = mapInstructionAccounts({
      accountNames: (idlInstruction?.accounts ?? []).map((account) => account.name),
      accountPubkeys: instruction.accounts,
    });

    return [
      {
        instructionIndex,
        instructionName: normalizeInstructionName(decodedInstruction.name),
        proposalPda: namedAccounts.proposal ?? null,
        entityPda: selectPrimaryEntityPda(namedAccounts),
        payload: {
          args: normalizeIndexerJson(decodedInstruction.data) as Record<string, unknown>,
          accounts: namedAccounts,
          remainingAccounts: instruction.accounts
            .slice(idlInstruction?.accounts.length ?? 0)
            .map((account) => account.toBase58()),
        },
      },
    ];
  });
};

export const parseAnchorEvents = (params: {
  logMessages: string[];
  targetProgram: PublicKey;
}): ParsedAnchorEventRecord[] => {
  const anchorService = getAnchorService();
  const coder = new BorshCoder(anchorService.program.idl as any);
  const parser = new EventParser(params.targetProgram, coder);

  return Array.from(parser.parseLogs(params.logMessages)).map((event) => {
    const payload = normalizeIndexerJson(event.data) as Record<string, unknown>;

    return {
      eventName: event.name,
      instructionName: mapEventNameToInstructionName(event.name),
      proposalPda:
        typeof payload.proposal === "string" && payload.proposal.trim()
          ? payload.proposal
          : null,
      entityPda: extractEntityFromEventPayload(payload),
      payload,
    };
  });
};

export const mergeAnchorEventsWithInstructions = (params: {
  events: ParsedAnchorEventRecord[];
  instructions: DecodedChainInstruction[];
}): DecodedChainInstruction[] => {
  const unmatchedByInstruction = new Map<string, DecodedChainInstruction[]>();
  const consumedInstructionIndexes = new Set<number>();

  for (const instruction of params.instructions) {
    const queue = unmatchedByInstruction.get(instruction.instructionName) ?? [];
    queue.push(instruction);
    unmatchedByInstruction.set(instruction.instructionName, queue);
  }

  const mergedFromEvents: DecodedChainInstruction[] = [];

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

  const fallbackInstructions = params.instructions.filter(
    (instruction) => !consumedInstructionIndexes.has(instruction.instructionIndex)
  );

  return [...mergedFromEvents, ...fallbackInstructions].sort(
    (left, right) => left.instructionIndex - right.instructionIndex
  );
};

const persistChainInstructions = async (params: {
  signature: string;
  slot: bigint;
  programId: string;
  instructions: DecodedChainInstruction[];
}): Promise<number> => {
  let persistedCount = 0;

  for (const instruction of params.instructions) {
    await prisma.chainEvent.upsert({
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
        payloadJson: instruction.payload as any,
      },
      create: {
        signature: params.signature,
        instructionIndex: instruction.instructionIndex,
        slot: params.slot,
        programId: params.programId,
        instructionName: instruction.instructionName,
        proposalPda: instruction.proposalPda,
        entityPda: instruction.entityPda,
        payloadJson: instruction.payload as any,
      },
    });

    if (
      instruction.proposalPda &&
      PROGRAM_INSTRUCTIONS_FOR_PROJECTION.has(instruction.instructionName)
    ) {
      await syncProposalProjectionFromChain({
        proposalPda: instruction.proposalPda,
        signature: params.signature,
        instructionName: instruction.instructionName,
      });
    }

    try {
      await syncMarketProjectionFromChainInstruction({
        signature: params.signature,
        instructionName: instruction.instructionName,
        proposalPda: instruction.proposalPda,
        entityPda: instruction.entityPda,
        payload: instruction.payload,
      });
    } catch (error) {
      console.warn(
        `[indexer] market projection failed for ${instruction.instructionName} in ${params.signature}: ${asErrorMessage(error)}`
      );
    }

    persistedCount += 1;
  }

  return persistedCount;
};

const updateIndexerCursor = async (slot: bigint, signature: string) => {
  await prisma.indexerCursor.upsert({
    where: {
      consumerKey: config.indexer.consumerKey,
    },
    update: {
      lastSeenSlot: slot,
      lastSeenSignature: signature,
    },
    create: {
      consumerKey: config.indexer.consumerKey,
      lastSeenSlot: slot,
      lastSeenSignature: signature,
    },
  });
};

const resolveSignatureSlot = async (
  connection: Connection,
  signature: string
): Promise<bigint | null> => {
  const response = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const slot = response.value[0]?.slot;
  return typeof slot === "number" ? BigInt(slot) : null;
};

export type IngestConfirmedProgramTransactionResult = {
  signature: string;
  slot: string | null;
  status: "NOT_FOUND" | "FAILED" | "NO_PROGRAM_INSTRUCTIONS" | "SYNCED";
  instructionCount: number;
};

export const ingestConfirmedProgramTransaction = async (
  signature: string,
  options: {
    connection?: Connection;
    targetProgram?: PublicKey;
    slot?: bigint;
    updateCursor?: boolean;
  } = {}
): Promise<IngestConfirmedProgramTransactionResult> => {
  const connection = options.connection ?? new Connection(config.solana.rpcEndpoint, "confirmed");
  const targetProgram = options.targetProgram ?? new PublicKey(config.solana.programId);
  const shouldUpdateCursor = options.updateCursor ?? false;
  const response = await fetchParsedTransactionWithRetry(connection, signature);
  const responseSlot =
    typeof (response as { slot?: number } | null)?.slot === "number"
      ? BigInt((response as { slot: number }).slot)
      : null;
  const slot = options.slot ?? responseSlot ?? (await resolveSignatureSlot(connection, signature));

  if (!response) {
    if (shouldUpdateCursor && slot !== null) {
      await updateIndexerCursor(slot, signature);
    }

    return {
      signature,
      slot: slot?.toString() ?? null,
      status: "NOT_FOUND",
      instructionCount: 0,
    };
  }

  if (response.meta?.err) {
    if (shouldUpdateCursor && slot !== null) {
      await updateIndexerCursor(slot, signature);
    }

    return {
      signature,
      slot: slot?.toString() ?? null,
      status: "FAILED",
      instructionCount: 0,
    };
  }

  const decodedInstructions = decodeProgramInstructions(response, targetProgram);
  const parsedEvents = parseAnchorEvents({
    logMessages: response.meta?.logMessages ?? [],
    targetProgram,
  });
  const instructions =
    parsedEvents.length > 0
      ? mergeAnchorEventsWithInstructions({
          events: parsedEvents,
          instructions: decodedInstructions,
        })
      : decodedInstructions;

  if (instructions.length === 0) {
    if (shouldUpdateCursor && slot !== null) {
      await updateIndexerCursor(slot, signature);
    }

    return {
      signature,
      slot: slot?.toString() ?? null,
      status: "NO_PROGRAM_INSTRUCTIONS",
      instructionCount: 0,
    };
  }

  const instructionCount = await persistChainInstructions({
    signature,
    slot: slot ?? 0n,
    programId: targetProgram.toBase58(),
    instructions,
  });

  if (shouldUpdateCursor && slot !== null) {
    await updateIndexerCursor(slot, signature);
  }

  return {
    signature,
    slot: slot?.toString() ?? null,
    status: "SYNCED",
    instructionCount,
  };
};

const processSignature = async (params: {
  connection: Connection;
  targetProgram: PublicKey;
  signature: string;
  slot: bigint;
}) => {
  await ingestConfirmedProgramTransaction(params.signature, {
    connection: params.connection,
    targetProgram: params.targetProgram,
    slot: params.slot,
    updateCursor: true,
  });
};

const backfillRecentSignatures = async (connection: Connection, targetProgram: PublicKey) => {
  const cursor = await prisma.indexerCursor.findUnique({
    where: {
      consumerKey: config.indexer.consumerKey,
    },
  });

  const signatures = await connection.getSignaturesForAddress(targetProgram, {
    limit: config.indexer.backfillLimit,
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

export const startIndexer = async (rpcEndpoint: string, programId: string) => {
  if (!config.indexer.enabled) {
    console.log("[indexer] disabled by INDEXER_ENABLED=false");
    return null;
  }

  const connection = new Connection(rpcEndpoint, "confirmed");
  const targetProgram = new PublicKey(programId);
  const inFlight = new Set<string>();

  await backfillRecentSignatures(connection, targetProgram);

  return connection.onLogs(
    targetProgram,
    (logs, context) => {
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
    },
    "confirmed"
  );
};
