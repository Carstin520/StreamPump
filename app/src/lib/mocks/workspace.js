"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findManifest = exports.findCampaign = exports.findIntent = exports.campaigns = exports.intents = exports.manifests = void 0;
exports.manifests = [
    {
        id: "cmna6yckj0000qt4p9rehgen0",
        title: "F1 aesthetics gallery",
        status: "ANCHORED",
        contentType: "IMAGE_CAROUSEL",
        assetCount: 5,
        updatedAtLabel: "6 min ago",
    },
    {
        id: "cmna4hq390006qteqss16aj8b",
        title: "Game trailer moodboard",
        status: "READY",
        contentType: "IMAGE_CAROUSEL",
        assetCount: 5,
        updatedAtLabel: "28 min ago",
    },
    {
        id: "cmna2z7sx0002qtezlaunch1",
        title: "City after dark reel",
        status: "UPLOADING",
        contentType: "SHORT_VIDEO",
        assetCount: 3,
        updatedAtLabel: "just now",
    },
];
exports.intents = [
    {
        id: "intent-luna-radiantlab",
        creatorId: "luna-cai",
        creatorName: "弯心入坑",
        sponsorName: "Apex Motion",
        status: "CREATOR_PARTIALLY_SIGNED",
        actionOwner: "sponsor",
        track1BaseUsd: 1200,
        track2PoolUsd: 2400,
        track3PoolUsd: 3000,
        metric: "Saves",
        targetValue: "18,000",
        manifestTitle: "F1 aesthetics gallery",
        deadlineLabel: "Closes in 18h",
    },
    {
        id: "intent-neo-pulsefit",
        creatorId: "neo-park",
        creatorName: "深夜不下线",
        sponsorName: "Nova Screen",
        status: "SPONSOR_SIGNED",
        actionOwner: "system",
        track1BaseUsd: 1800,
        track2PoolUsd: 3600,
        track3PoolUsd: 5200,
        metric: "Clicks",
        targetValue: "9,500",
        manifestTitle: "Game trailer moodboard",
        deadlineLabel: "Closes in 9h",
    },
    {
        id: "intent-mika-grain",
        creatorId: "mika-zhou",
        creatorName: "胶片落进沙里",
        sponsorName: "Slate Journal",
        status: "BUNDLE_BUILT",
        actionOwner: "creator",
        track1BaseUsd: 900,
        track2PoolUsd: 1400,
        track3PoolUsd: 2100,
        metric: "Views",
        targetValue: "120,000",
        manifestTitle: "Dune afterglow note",
        deadlineLabel: "Closes in 26h",
    },
];
exports.campaigns = [
    {
        id: "proposal-radiantlab-luna",
        creatorName: "弯心入坑",
        sponsorName: "Apex Motion",
        status: "OPEN",
        contentHashShort: "a46c...1da7",
        contentAnchorShort: "5Y3s...Rx2N",
        track1BaseUsd: 1200,
        track2PoolUsd: 2400,
        track3PoolUsd: 3000,
        metric: "Saves",
        actualValue: "12,480 / 18,000",
        chainTxShort: "5e3E...oZ4m",
    },
    {
        id: "proposal-pulsefit-neo",
        creatorName: "深夜不下线",
        sponsorName: "Nova Screen",
        status: "FUNDED",
        contentHashShort: "d1cc...ab91",
        contentAnchorShort: "9vQ4...cK8j",
        track1BaseUsd: 1800,
        track2PoolUsd: 3600,
        track3PoolUsd: 5200,
        metric: "Clicks",
        actualValue: "Pending report",
        chainTxShort: "2RzM...Xn7Q",
    },
];
const manifestIndex = new Map(exports.manifests.map((manifest) => [manifest.id, manifest]));
const intentIndex = new Map(exports.intents.map((intent) => [intent.id, intent]));
const campaignIndex = new Map(exports.campaigns.map((campaign) => [campaign.id, campaign]));
const findIntent = (intentId) => intentIndex.get(intentId) ?? exports.intents[0];
exports.findIntent = findIntent;
const findCampaign = (campaignId) => campaignIndex.get(campaignId) ?? exports.campaigns[0];
exports.findCampaign = findCampaign;
const findManifest = (manifestId) => manifestIndex.get(manifestId) ?? exports.manifests[0];
exports.findManifest = findManifest;
