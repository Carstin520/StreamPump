import { ProposalIntentStatus } from "@prisma/client";

import { HttpError } from "../controllers/http";
import {
  extractTransactionSignature,
  finalizeConfirmedLaunchBundle,
} from "../controllers/proposalIntentShared";
import { getAnchorService } from "./AnchorService";
import { prisma } from "./prisma";
import {
  assertRequiredSignerPresent,
  assertTransactionMessageMatches,
} from "./proposalLaunchService";

type RecoveryDependencies = {
  prisma: typeof prisma;
  getSignatureState(signature: string): Promise<"NOT_FOUND" | "FAILED" | "PENDING" | "SUCCESS">;
  finalize: typeof finalizeConfirmedLaunchBundle;
  extractSignature: typeof extractTransactionSignature;
  assertMessageMatches: typeof assertTransactionMessageMatches;
  assertSignerPresent: typeof assertRequiredSignerPresent;
};

const defaultDependencies = (): RecoveryDependencies => ({
  prisma,
  getSignatureState: (signature) => getAnchorService().getSignatureState(signature),
  finalize: finalizeConfirmedLaunchBundle,
  extractSignature: extractTransactionSignature,
  assertMessageMatches: assertTransactionMessageMatches,
  assertSignerPresent: assertRequiredSignerPresent,
});

export const reconcileStoredProposalIntent = async (
  intentId: string,
  overrides: Partial<RecoveryDependencies> = {}
) => {
  const defaults = defaultDependencies();
  const deps = { ...defaults, ...overrides };
  const intent = await deps.prisma.proposalIntent.findUnique({
    where: { id: intentId },
    include: {
      txBundles: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!intent) {
    throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
  }
  if (intent.status === ProposalIntentStatus.CONFIRMED) {
    const bundle = intent.txBundles.find(
      (candidate) =>
        candidate.chainTxSignature === intent.chainTxSignature &&
        Boolean(candidate.fullySignedBase64)
    );
    return {
      recovered: false,
      reason: "ALREADY_CONFIRMED" as const,
      intentId: intent.id,
      bundleId: bundle?.id ?? null,
      chainTxSignature: intent.chainTxSignature,
    };
  }

  const chainTxSignature = intent.chainTxSignature?.trim();
  if (!chainTxSignature) {
    throw new HttpError(
      409,
      "INTENT_CHAIN_SIGNATURE_MISSING",
      "proposal intent has no stored chain transaction signature to reconcile"
    );
  }
  const bundle = intent.txBundles.find(
    (candidate) => candidate.chainTxSignature === chainTxSignature
  );
  if (!bundle?.fullySignedBase64) {
    throw new HttpError(
      409,
      "INTENT_SIGNED_BUNDLE_MISSING",
      "proposal intent has no stored fully signed bundle matching its chain signature"
    );
  }

  if (!bundle.messageBase64) {
    throw new HttpError(
      409,
      "INTENT_BUNDLE_MESSAGE_MISSING",
      "stored proposal bundle has no canonical transaction message"
    );
  }
  try {
    const extractedSignature = deps.extractSignature(bundle.fullySignedBase64);
    if (extractedSignature !== chainTxSignature) {
      throw new HttpError(
        409,
        "INTENT_CHAIN_SIGNATURE_MISMATCH",
        "stored chain signature does not match the fully signed proposal transaction"
      );
    }
    deps.assertMessageMatches(bundle.messageBase64, bundle.fullySignedBase64);
    deps.assertSignerPresent(bundle.fullySignedBase64, intent.creatorWallet);
    deps.assertSignerPresent(bundle.fullySignedBase64, intent.sponsorWallet);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      409,
      "INTENT_STORED_TRANSACTION_INVALID",
      "stored fully signed proposal transaction failed integrity validation"
    );
  }

  const signatureState = await deps.getSignatureState(chainTxSignature);
  if (signatureState !== "SUCCESS") {
    throw new HttpError(
      409,
      "INTENT_CHAIN_TRANSACTION_NOT_CONFIRMED",
      `stored proposal transaction is not confirmed successful: ${signatureState}`,
      { signatureState }
    );
  }

  await deps.finalize({
    intentId: intent.id,
    bundleId: bundle.id,
    fullySignedTxBase64: bundle.fullySignedBase64,
    chainTxSignature,
  });

  return {
    recovered: true,
    reason: "CONFIRMED_FROM_STORED_TRANSACTION" as const,
    intentId: intent.id,
    bundleId: bundle.id,
    chainTxSignature,
  };
};
