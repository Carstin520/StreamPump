/**
 * CN: S1 action 控制器，生成需要用户钱包签名的链上交易。
 * EN: S1 action controller that builds user-wallet-signed on-chain transactions.
 */
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

import {
  HttpError,
  ok,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  parseNonNegativeInt,
  parseWallet,
  requireSessionWallet,
  withController,
} from "./http";
import { getAnchorService, UserMissionTypeName } from "../services/AnchorService";

const USER_ROLE_FAN = 1 << 0;
const ZERO_SIGNATURE = new Uint8Array(64);

const parsePositiveBigInt = (value: unknown, fieldName: string): bigint => {
  const parsed = parseNonNegativeBigInt(value, fieldName);
  if (parsed <= 0n) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const parseOptionalPositiveInt = (value: unknown, fieldName: string): number | null => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = parseNonNegativeInt(value, fieldName);
  if (parsed <= 0) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const parseMissionType = (value: unknown): UserMissionTypeName => {
  const parsed = parseNonEmptyString(value, "missionType").toUpperCase();
  const allowed: UserMissionTypeName[] = [
    "DAILY_SESSION_5_MIN",
    "LIKE_10_POSTS",
    "FOLLOW_3_CREATORS",
    "SHARE_1_POST",
    "PUBLISH_FIRST_POST",
    "COMPLETE_PROFILE",
    "SPONSOR_CAMPAIGN_REVIEW",
  ];

  if (!allowed.includes(parsed as UserMissionTypeName)) {
    throw new HttpError(400, "INVALID_INPUT", "missionType is not supported");
  }

  return parsed as UserMissionTypeName;
};

const parseDigestHex = (value: unknown, fieldName: string): string => {
  const parsed = parseNonEmptyString(value, fieldName).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be 32-byte hex`);
  }

  return parsed;
};

export const assertS1TransactionSignedByWallet = (
  serializedTxBase64: string,
  wallet: string
): void => {
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

const deriveCommonPdas = (params: {
  userWallet?: string;
  creatorWallet?: string;
  sponsorWallet?: string;
}) => {
  const anchorService = getAnchorService();
  const creatorProfilePda = params.creatorWallet
    ? anchorService.deriveCreatorProfilePda(new PublicKey(params.creatorWallet))
    : null;
  const user = params.userWallet ? new PublicKey(params.userWallet) : null;
  const sponsor = params.sponsorWallet ? new PublicKey(params.sponsorWallet) : null;
  const buyoutOfferPda =
    sponsor && creatorProfilePda ? anchorService.deriveBuyoutOfferPda(sponsor, creatorProfilePda) : null;

  return {
    protocolConfigPda: anchorService.deriveProtocolConfigPda().toBase58(),
    userProfilePda: user ? anchorService.deriveUserProfilePda(user).toBase58() : null,
    creatorProfilePda: creatorProfilePda?.toBase58() ?? null,
    s1PositionPda:
      user && creatorProfilePda
        ? anchorService.deriveS1PositionPda(user, creatorProfilePda).toBase58()
        : null,
    s1BuyoutStatePda: creatorProfilePda
      ? anchorService.deriveS1BuyoutStatePda(creatorProfilePda).toBase58()
      : null,
    buyoutOfferPda: buyoutOfferPda?.toBase58() ?? null,
    offerUsdcVaultPda: buyoutOfferPda
      ? anchorService.deriveOfferUsdcVaultPda(buyoutOfferPda).toBase58()
      : null,
  };
};

const buildResponse = async (params: {
  action: string;
  payerWallet: string;
  requiredSigners: string[];
  instruction: Promise<unknown>;
  derived: Record<string, string | null>;
  backendSigners?: Parameters<ReturnType<typeof getAnchorService>["buildClientSignedTransaction"]>[0]["backendSigners"];
}) => {
  const anchorService = getAnchorService();
  const instruction = await params.instruction;
  const built = await anchorService.buildClientSignedTransaction({
    payerWallet: params.payerWallet,
    instructions: [instruction as never],
    backendSigners: params.backendSigners,
  });

  return {
    action: params.action,
    submitMode: "CLIENT_RELAY",
    transactionBase64: built.transactionBase64,
    recentBlockhash: built.recentBlockhash,
    lastValidBlockHeight: built.lastValidBlockHeight.toString(),
    requiredSigners: params.requiredSigners,
    derived: params.derived,
  };
};

export const buildRegisterUserTransaction = withController(
  "BUILD_S1_REGISTER_USER_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const roleFlags = req.body.roleFlags === undefined ? USER_ROLE_FAN : parseNonNegativeInt(req.body.roleFlags, "roleFlags");

    ok(
      res,
      await buildResponse({
        action: "REGISTER_USER",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        instruction: getAnchorService().buildRegisterUserInstruction({ userWallet, roleFlags }),
        derived: deriveCommonPdas({ userWallet }),
      })
    );
  }
);

export const buildClaimDailySpumpTransaction = withController(
  "BUILD_S1_CLAIM_DAILY_SPUMP_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);

    ok(
      res,
      await buildResponse({
        action: "CLAIM_DAILY_SPUMP",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        instruction: getAnchorService().buildClaimDailySpumpInstruction({ userWallet }),
        derived: deriveCommonPdas({ userWallet }),
      })
    );
  }
);

export const buildBuyS1Transaction = withController(
  "BUILD_S1_BUY_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const amount = parsePositiveBigInt(req.body.amount, "amount");

    ok(
      res,
      await buildResponse({
        action: "BUY_S1_TOKEN",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        instruction: getAnchorService().buildBuyS1TokenInstruction({
          userWallet,
          creatorWallet,
          amount,
        }),
        derived: deriveCommonPdas({ userWallet, creatorWallet }),
      })
    );
  }
);

export const buildSellS1Transaction = withController(
  "BUILD_S1_SELL_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const amount = parsePositiveBigInt(req.body.amount, "amount");

    ok(
      res,
      await buildResponse({
        action: "SELL_S1_TOKEN",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        instruction: getAnchorService().buildSellS1TokenInstruction({
          userWallet,
          creatorWallet,
          amount,
        }),
        derived: deriveCommonPdas({ userWallet, creatorWallet }),
      })
    );
  }
);

export const buildInitS1BuyoutTransaction = withController(
  "BUILD_S1_INIT_BUYOUT_TRANSACTION_FAILED",
  async (req, res) => {
    const creatorWallet = requireSessionWallet(req);

    ok(
      res,
      await buildResponse({
        action: "INIT_S1_BUYOUT",
        payerWallet: creatorWallet,
        requiredSigners: [creatorWallet],
        instruction: getAnchorService().buildInitS1BuyoutInstruction({ creatorWallet }),
        derived: deriveCommonPdas({ creatorWallet }),
      })
    );
  }
);

export const buildSubmitBuyoutOfferTransaction = withController(
  "BUILD_S1_SUBMIT_BUYOUT_OFFER_TRANSACTION_FAILED",
  async (req, res) => {
    const sponsorWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const usdcAmount = parsePositiveBigInt(req.body.usdcAmount, "usdcAmount");

    ok(
      res,
      await buildResponse({
        action: "SUBMIT_BUYOUT_OFFER",
        payerWallet: sponsorWallet,
        requiredSigners: [sponsorWallet],
        instruction: getAnchorService().buildSubmitBuyoutOfferInstruction({
          sponsorWallet,
          creatorWallet,
          usdcAmount,
        }),
        derived: deriveCommonPdas({ sponsorWallet, creatorWallet }),
      })
    );
  }
);

export const buildAcceptBuyoutOfferTransaction = withController(
  "BUILD_S1_ACCEPT_BUYOUT_OFFER_TRANSACTION_FAILED",
  async (req, res) => {
    const creatorWallet = requireSessionWallet(req);
    const sponsorWallet = parseWallet(req.body.sponsorWallet, "sponsorWallet");

    ok(
      res,
      await buildResponse({
        action: "ACCEPT_BUYOUT_OFFER",
        payerWallet: creatorWallet,
        requiredSigners: [creatorWallet],
        instruction: getAnchorService().buildAcceptBuyoutOfferInstruction({
          creatorWallet,
          sponsorWallet,
        }),
        derived: deriveCommonPdas({ sponsorWallet, creatorWallet }),
      })
    );
  }
);

export const buildCancelBuyoutOfferTransaction = withController(
  "BUILD_S1_CANCEL_BUYOUT_OFFER_TRANSACTION_FAILED",
  async (req, res) => {
    const sponsorWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");

    ok(
      res,
      await buildResponse({
        action: "CANCEL_BUYOUT_OFFER",
        payerWallet: sponsorWallet,
        requiredSigners: [sponsorWallet],
        instruction: getAnchorService().buildCancelBuyoutOfferInstruction({
          sponsorWallet,
          creatorWallet,
        }),
        derived: deriveCommonPdas({ sponsorWallet, creatorWallet }),
      })
    );
  }
);

export const buildReclaimBuyoutOfferTransaction = withController(
  "BUILD_S1_RECLAIM_BUYOUT_OFFER_TRANSACTION_FAILED",
  async (req, res) => {
    const sponsorWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");

    ok(
      res,
      await buildResponse({
        action: "RECLAIM_EXPIRED_BUYOUT_OFFER",
        payerWallet: sponsorWallet,
        requiredSigners: [sponsorWallet],
        instruction: getAnchorService().buildReclaimExpiredBuyoutOfferInstruction({
          sponsorWallet,
          creatorWallet,
        }),
        derived: deriveCommonPdas({ sponsorWallet, creatorWallet }),
      })
    );
  }
);

export const buildRageQuitS1Transaction = withController(
  "BUILD_S1_RAGE_QUIT_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const amount = parsePositiveBigInt(req.body.amount, "amount");

    ok(
      res,
      await buildResponse({
        action: "RAGE_QUIT_S1",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        instruction: getAnchorService().buildRageQuitS1Instruction({
          userWallet,
          creatorWallet,
          amount,
        }),
        derived: deriveCommonPdas({ userWallet, creatorWallet }),
      })
    );
  }
);

export const buildExecuteS1GraduationTransaction = withController(
  "BUILD_S1_EXECUTE_GRADUATION_TRANSACTION_FAILED",
  async (req, res) => {
    const executorWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");

    ok(
      res,
      await buildResponse({
        action: "EXECUTE_S1_GRADUATION",
        payerWallet: executorWallet,
        requiredSigners: [executorWallet],
        instruction: getAnchorService().buildExecuteS1GraduationInstruction({
          executorWallet,
          creatorWallet,
        }),
        derived: deriveCommonPdas({ userWallet: executorWallet, creatorWallet }),
      })
    );
  }
);

export const buildClaimS1BuyoutUsdcTransaction = withController(
  "BUILD_S1_CLAIM_BUYOUT_USDC_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const sponsorWallet = parseWallet(req.body.sponsorWallet, "sponsorWallet");

    ok(
      res,
      await buildResponse({
        action: "CLAIM_S1_BUYOUT_USDC",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        instruction: getAnchorService().buildClaimS1BuyoutUsdcInstruction({
          userWallet,
          creatorWallet,
          sponsorWallet,
        }),
        derived: deriveCommonPdas({ userWallet, creatorWallet, sponsorWallet }),
      })
    );
  }
);

export const buildClaimEngagementRewardTransaction = withController(
  "BUILD_S1_CLAIM_ENGAGEMENT_REWARD_TRANSACTION_FAILED",
  async (req, res) => {
    const userWallet = requireSessionWallet(req);
    const reward = await getAnchorService().buildClaimEngagementRewardInstruction({
      userWallet,
      missionType: parseMissionType(req.body.missionType),
      rewardAmount: parseNonNegativeBigInt(req.body.rewardAmount, "rewardAmount"),
      xpGain: parseNonNegativeBigInt(req.body.xpGain, "xpGain"),
      newLevel: parseOptionalPositiveInt(req.body.newLevel, "newLevel"),
      reportIdHex: parseDigestHex(req.body.reportIdHex, "reportIdHex"),
      reportDigestHex: parseDigestHex(req.body.reportDigestHex, "reportDigestHex"),
      observedAtUnix: parseNonNegativeBigInt(req.body.observedAtUnix, "observedAtUnix"),
    });

    ok(
      res,
      await buildResponse({
        action: "CLAIM_ENGAGEMENT_REWARD",
        payerWallet: userWallet,
        requiredSigners: [userWallet],
        backendSigners: [reward.oracleSigner],
        instruction: Promise.resolve(reward.instruction),
        derived: {
          ...deriveCommonPdas({ userWallet }),
          rewardReceiptPda: reward.rewardReceipt.toBase58(),
        },
      })
    );
  }
);

export const submitS1Transaction = withController("SUBMIT_S1_TRANSACTION_FAILED", async (req, res) => {
  const wallet = requireSessionWallet(req);
  const signedTransactionBase64 = parseNonEmptyString(
    req.body.signedTransactionBase64,
    "signedTransactionBase64"
  );
  assertS1TransactionSignedByWallet(signedTransactionBase64, wallet);

  const signature = await getAnchorService().sendAndConfirmVersionedTransaction({
    serializedTxBase64: signedTransactionBase64,
    recentBlockhash: parseNonEmptyString(req.body.recentBlockhash, "recentBlockhash"),
    lastValidBlockHeight: parseNonNegativeBigInt(
      req.body.lastValidBlockHeight,
      "lastValidBlockHeight"
    ),
  });

  ok(res, { signature });
});

export const getS1TransactionStatus = withController(
  "GET_S1_TRANSACTION_STATUS_FAILED",
  async (req, res) => {
    const signature = parseNonEmptyString(req.params.signature, "signature");

    ok(res, {
      signature,
      status: await getAnchorService().getSignatureState(signature),
    });
  }
);
