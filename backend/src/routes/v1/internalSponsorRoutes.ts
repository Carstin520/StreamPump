/**
 * CN: Sponsor KYB 内部运营审核路由。
 * EN: Internal operator routes for Sponsor KYB review.
 */
import { NextFunction, Request, Response, Router } from "express";

import {
  HttpError,
  fail,
  ok,
  parseNonEmptyString,
  withController,
} from "../../controllers/http";
import { optionalSessionAuth } from "../../middleware/walletAuth";
import {
  listPendingSponsorProfiles,
  reviewSponsorProfile,
} from "../../services/sponsorProfile";
import { getAnchorService } from "../../services/AnchorService";
import { config } from "../../../config/default";

const router = Router();

const requireInternalOperatorAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const configuredKey = config.auth.internalOperatorApiKey?.trim();
  const providedKey = String(req.header("x-internal-operator-key") ?? "").trim();

  if (configuredKey && providedKey && configuredKey === providedKey) {
    next();
    return;
  }

  await optionalSessionAuth(req, res, () => {
    const wallet = req.auth?.wallet;
    const oracleWallet = getAnchorService().getOracleAuthorityPublicKey().toBase58();

    if (wallet === oracleWallet) {
      next();
      return;
    }

    fail(res, 403, "OPERATOR_AUTH_REQUIRED", "operator authorization is required");
  });
};

router.use(requireInternalOperatorAuth);

router.get(
  "/pending",
  withController("LIST_PENDING_SPONSORS_FAILED", async (_req, res) => {
    ok(res, {
      sponsors: await listPendingSponsorProfiles(),
    });
  })
);

router.post(
  "/:id/verify",
  withController("VERIFY_SPONSOR_FAILED", async (req, res) => {
    const decision = parseNonEmptyString(req.body.decision, "decision").toUpperCase();
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      throw new HttpError(400, "INVALID_INPUT", "decision must be APPROVED or REJECTED");
    }

    const sponsor = await reviewSponsorProfile({
      id: parseNonEmptyString(req.params.id, "id"),
      decision,
      rejectReason: req.body.rejectReason ? String(req.body.rejectReason).trim() : null,
    });

    ok(res, sponsor);
  })
);

export default router;
