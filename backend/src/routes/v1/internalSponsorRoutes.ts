/**
 * CN: Sponsor KYB 内部运营审核路由。
 * EN: Internal operator routes for Sponsor KYB review.
 */
import { Router } from "express";

import {
  HttpError,
  ok,
  parseNonEmptyString,
  withController,
} from "../../controllers/http";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";
import {
  listPendingSponsorProfiles,
  reviewSponsorProfile,
} from "../../services/sponsorProfile";
import { r2Service } from "../../services/R2Service";

const router = Router();

router.use(requireInternalOperatorAuth);

router.get(
  "/pending",
  withController("LIST_PENDING_SPONSORS_FAILED", async (_req, res) => {
    const sponsors = await Promise.all(
      (await listPendingSponsorProfiles()).map(async (profile) => {
        return {
          id: profile.id,
          wallet: profile.wallet,
          companyName: profile.companyName,
          sponsorType: profile.sponsorType,
          registrationNumber: profile.registrationNumber,
          legalRepresentative: profile.legalRepresentative,
          contactPhone: profile.contactPhone,
          contactEmail: profile.contactEmail,
          status: profile.status,
          rejectReason: profile.rejectReason,
          approvedAt: profile.approvedAt,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          businessLicenseUrl: await r2Service.generateDownloadUrl(profile.businessLicenseKey),
          powerOfAttorneyUrl: profile.powerOfAttorneyKey
            ? await r2Service.generateDownloadUrl(profile.powerOfAttorneyKey)
            : null,
        };
      })
    );

    ok(res, {
      sponsors,
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
      reviewerWallet: parseNonEmptyString(req.operatorIdentity, "operatorIdentity"),
      note: req.body.note ? String(req.body.note).trim() : null,
    });

    ok(res, sponsor);
  })
);

export default router;
