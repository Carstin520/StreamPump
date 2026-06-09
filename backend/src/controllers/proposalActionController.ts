/**
 * CN: S2 proposal action 控制器，生成需要用户钱包签名的 endorsement 交易。
 * EN: S2 proposal action controller that builds user-wallet-signed endorsement transactions.
 */
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

import {
  HttpError,
  ok,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  requireSessionWallet,
  withController,
} from "./http";
import { getAnchorService } from "../services/AnchorService";
import { ingestConfirmedProgramTransaction } from "../services/indexer";
import { prisma } from "../services/prisma";

const ZERO_SIGNATURE = new Uint8Array(64);

const parsePositiveBigInt = (value: unknown, fieldName: string): bigint => {
  const parsed = parseNonNegativeBigInt(value, fieldName);
  if (parsed <= 0n) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const assertTransactionSignedByWallet = (serializedTxBase64: string, wallet: string): void => {
  const transaction = VersionedTransaction.deserialize(Buffer.from(serializedTxBase64, "base64"));
  const signerWallets = transaction.message.staticAccountKeys
    .slice(0, transaction.message.header.numRequiredSignatures)
    .map((key) => key.toBase58());
  const signerIndex = signerWallets.findIndex((signerWallet) => signerWallet === wallet);

  if (signerIndex === -1) {
    throw new HttpError(403, "FORBIDDEN", "transaction does not require the authenticated wallet");
  }

  const signature = transaction.signatures[signerIndex];
  const isMissingSignature =
    signature.length === ZERO_SIGNATURE.length &&
    signature.every((value, index) => value === ZERO_SIGNATURE[index]);

  if (isMissingSignature) {
    throw new HttpError(400, "MISSING_SIGNATURE", "transaction is missing the authenticated wallet signature");
  }
};

const resolveProposalPda = async (proposalRef: string): Promise<string> => {
  const proposal = await prisma.proposal.findFirst({
    where: {
      OR: [{ id: proposalRef }, { proposalPda: proposalRef }],
    },
    select: {
      proposalPda: true,
    },
  });
  if (proposal) {
    return proposal.proposalPda;
  }

  try {
    return new PublicKey(proposalRef).toBase58();
  } catch (_error) {
    throw new HttpError(404, "PROPOSAL_NOT_FOUND", "proposal not found");
  }
};

const buildResponse = async (params: {
  action: string;
  payerWallet: string;
  proposalPda: string;
  instruction: Promise<unknown>;
}) => {
  const anchorService = getAnchorService();
  const proposal = new PublicKey(params.proposalPda);
  const user = new PublicKey(params.payerWallet);
  const instruction = await params.instruction;
  const built = await anchorService.buildClientSignedTransaction({
    payerWallet: params.payerWallet,
    instructions: [instruction as never],
  });

  return {
    action: params.action,
    submitMode: "CLIENT_RELAY",
    transactionBase64: built.transactionBase64,
    recentBlockhash: built.recentBlockhash,
    lastValidBlockHeight: built.lastValidBlockHeight.toString(),
    requiredSigners: [params.payerWallet],
    derived: {
      proposalPda: proposal.toBase58(),
      endorsementPositionPda: anchorService.deriveEndorsementPositionPda(user, proposal).toBase58(),
      proposalUsdcVaultPda: anchorService.deriveProposalUsdcVaultPda(proposal).toBase58(),
    },
  };
};

const syncSubmittedProposalProjection = async (signature: string) => {
  try {
    const projectionSync = await ingestConfirmedProgramTransaction(signature, {
      updateCursor: false,
    });

    return {
      status: projectionSync.status === "SYNCED" ? "SYNCED" : "FAILED",
      instructionCount: projectionSync.instructionCount,
      indexerStatus: projectionSync.status,
    };
  } catch (error) {
    return {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const buildEndorseProposalTransaction = withController(
  "BUILD_S2_ENDORSE_PROPOSAL_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const proposalPda = await resolveProposalPda(parseNonEmptyString(req.params.id, "id"));
    const amount = parsePositiveBigInt(req.body.amount, "amount");

    ok(
      res,
      await buildResponse({
        action: "ENDORSE_PROPOSAL",
        payerWallet: userWallet,
        proposalPda,
        instruction: getAnchorService().buildEndorseProposalInstruction({
          userWallet,
          proposalPda,
          amount,
        }),
      })
    );
  }
);

export const buildClaimEndorsementTransaction = withController(
  "BUILD_S2_CLAIM_ENDORSEMENT_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const proposalPda = await resolveProposalPda(parseNonEmptyString(req.params.id, "id"));

    ok(
      res,
      await buildResponse({
        action: "CLAIM_ENDORSEMENT",
        payerWallet: userWallet,
        proposalPda,
        instruction: getAnchorService().buildClaimEndorsementInstruction({
          userWallet,
          proposalPda,
        }),
      })
    );
  }
);

export const submitProposalActionTransaction = withController(
  "SUBMIT_S2_PROPOSAL_TRANSACTION_FAILED",
  async (req, res) => {
    const wallet = requireSessionWallet(req);
    const signedTransactionBase64 = parseNonEmptyString(
      req.body.signedTransactionBase64,
      "signedTransactionBase64"
    );
    assertTransactionSignedByWallet(signedTransactionBase64, wallet);

    const signature = await getAnchorService().sendAndConfirmVersionedTransaction({
      serializedTxBase64: signedTransactionBase64,
      recentBlockhash: parseNonEmptyString(req.body.recentBlockhash, "recentBlockhash"),
      lastValidBlockHeight: parseNonNegativeBigInt(
        req.body.lastValidBlockHeight,
        "lastValidBlockHeight"
      ),
    });

    ok(res, {
      signature,
      projectionSync: await syncSubmittedProposalProjection(signature),
    });
  }
);
