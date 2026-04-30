import {
  HttpError,
  ok,
  parseNonEmptyString,
  withController,
} from "./http";
import { getPublicCampaignProof } from "../services/marketProjectionService";

export const getPublicCampaign = withController("GET_PUBLIC_CAMPAIGN_FAILED", async (req, res) => {
  const id = parseNonEmptyString(req.params.id, "id");
  const campaign = await getPublicCampaignProof(id);

  if (!campaign) {
    throw new HttpError(404, "CAMPAIGN_NOT_FOUND", "campaign proof not found");
  }

  ok(res, campaign);
});
