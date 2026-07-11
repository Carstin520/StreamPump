import { expect } from "chai";
import { ContentManifestStatus, ProposalStatus } from "@prisma/client";

import { config, getEnabledForbiddenPilotFeatures } from "../config/default";
import { assertManifestAssetMutationAllowed } from "../src/controllers/contentManifestController";
import { HttpError } from "../src/controllers/http";
import {
  assertPilotTrackBudgetsAllowed,
  assertStoredIntentPilotTracksAllowed,
} from "../src/controllers/proposalIntentController";
import { manifestStatusAfterEligibilitySync } from "../src/services/contentPublicationEligibility";
import { proposalPublicationEligibilityWhere } from "../src/services/contentPublicationEligibility";

describe("Pilot safety gates", () => {
  it("reports every production-forbidden Pilot feature that is enabled", () => {
    const original = {
      ephemeral: config.managedWallet.ephemeralSessionsEnabled,
      engagement: config.pilot.engagementRewardsEnabled,
      track2: config.oracle.track2AutoSettlementEnabled,
    };

    try {
      config.managedWallet.ephemeralSessionsEnabled = true;
      config.pilot.engagementRewardsEnabled = true;
      config.oracle.track2AutoSettlementEnabled = true;

      expect(getEnabledForbiddenPilotFeatures(config)).to.include.members([
        "EPHEMERAL_SESSIONS_ENABLED",
        "ENGAGEMENT_REWARDS_ENABLED",
        "ORACLE_TRACK2_AUTO_SETTLEMENT_ENABLED",
      ]);
    } finally {
      config.managedWallet.ephemeralSessionsEnabled = original.ephemeral;
      config.pilot.engagementRewardsEnabled = original.engagement;
      config.oracle.track2AutoSettlementEnabled = original.track2;
    }
  });

  it("allows asset mutation only before a manifest is finalized", () => {
    expect(() => assertManifestAssetMutationAllowed(ContentManifestStatus.DRAFT)).not.to.throw();
    expect(() => assertManifestAssetMutationAllowed(ContentManifestStatus.UPLOADING)).not.to.throw();

    for (const status of [
      ContentManifestStatus.READY,
      ContentManifestStatus.LOCKED,
      ContentManifestStatus.ANCHORED,
      ContentManifestStatus.PUBLISHED,
      ContentManifestStatus.ARCHIVED,
    ]) {
      expect(() => assertManifestAssetMutationAllowed(status)).to.throw(HttpError).with.property(
        "code",
        "MANIFEST_IMMUTABLE"
      );
    }
  });

  it("demotes an ineligible published manifest without erasing its anchor state", () => {
    expect(
      manifestStatusAfterEligibilitySync({
        currentStatus: ContentManifestStatus.PUBLISHED,
        publicFeedEligible: false,
        currentAnchorPda: "anchor-pda",
      })
    ).to.equal(ContentManifestStatus.ANCHORED);

    expect(
      manifestStatusAfterEligibilitySync({
        currentStatus: ContentManifestStatus.PUBLISHED,
        publicFeedEligible: false,
        currentAnchorPda: null,
      })
    ).to.equal(ContentManifestStatus.READY);
  });

  it("rejects Track 2 and Track 3 terms while those Pilot tracks are closed", () => {
    const closedTracks = {
      track2Enabled: false,
      track3Enabled: false,
      track2TargetValue: 0n,
      track2MinAchievementBps: 0,
      track2UsdcDeposited: 0n,
      maxEndorsementSpump: 0n,
      track3UsdcDeposited: 0n,
      track3DelayDays: 0,
    };

    expect(() => assertPilotTrackBudgetsAllowed(closedTracks)).not.to.throw();
    expect(() =>
      assertPilotTrackBudgetsAllowed({ ...closedTracks, track2UsdcDeposited: 1n })
    ).to.throw(HttpError).with.property("code", "TRACK2_CLOSED_FOR_PILOT");
    expect(() =>
      assertPilotTrackBudgetsAllowed({ ...closedTracks, track3DelayDays: 1 })
    ).to.throw(HttpError).with.property("code", "TRACK3_CLOSED_FOR_PILOT");

    expect(() =>
      assertStoredIntentPilotTracksAllowed({
        track2TargetValue: 0n,
        track2MinAchievementBps: 0,
        track2UsdcDeposited: 1n,
        maxEndorsementSpump: 0n,
        track3UsdcDeposited: 0n,
        track3DelayDays: 0,
      })
    ).to.throw(HttpError).with.property("code", "TRACK2_CLOSED_FOR_PILOT");
  });

  it("preserves publication verification on settled or resolved proposal history", () => {
    expect(proposalPublicationEligibilityWhere("manifest-1", false)).to.deep.equal({
      manifestId: "manifest-1",
      status: {
        in: [ProposalStatus.OPEN, ProposalStatus.FUNDED],
      },
      track1Claimed: false,
    });

    expect(proposalPublicationEligibilityWhere("manifest-1", true)).to.deep.equal({
      manifestId: "manifest-1",
      contentPublishedVerifiedAt: null,
    });
  });
});
