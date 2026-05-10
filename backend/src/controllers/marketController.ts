import {
  HttpError,
  ok,
  parseNonEmptyString,
  parsePositiveInt,
  requireSessionWallet,
  withController,
} from "./http";
import {
  getCreatorMarketProjection,
  getMarketOverviewProjection,
  getPortfolioProjection,
  listTrendingCreatorProjections,
} from "../services/marketProjectionService";
import {
  buildMockS1MarketProfile,
  buildMockS1Portfolio,
  isDemoS1CreatorWallet,
  isS1MockWallet,
} from "../services/s1MockContract";

const DEFAULT_TRENDING_LIMIT = 24;

const parseOptionalLimit = (value: unknown): number => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return DEFAULT_TRENDING_LIMIT;
  }

  return parsePositiveInt(value, "limit");
};

export const getMarketOverview = withController("GET_MARKET_OVERVIEW_FAILED", async (_req, res) => {
  ok(res, await getMarketOverviewProjection());
});

export const listTrendingCreators = withController(
  "LIST_TRENDING_CREATORS_FAILED",
  async (req, res) => {
    const limit = parseOptionalLimit(req.query.limit);

    ok(res, await listTrendingCreatorProjections(limit));
  }
);

export const getMarketCreatorProfile = withController(
  "GET_MARKET_CREATOR_FAILED",
  async (req, res) => {
    const creatorWallet = parseNonEmptyString(req.params.creatorWallet, "creatorWallet");
    const profile = await getCreatorMarketProjection(creatorWallet);

    if (!profile) {
      if (isDemoS1CreatorWallet(creatorWallet)) {
        ok(res, buildMockS1MarketProfile());
        return;
      }

      throw new HttpError(404, "CREATOR_MARKET_NOT_FOUND", "creator market projection not found");
    }

    ok(res, profile);
  }
);

export const getMarketPortfolio = withController("GET_MARKET_PORTFOLIO_FAILED", async (req, res) => {
  const userWallet = requireSessionWallet(req);

  if (isS1MockWallet(userWallet)) {
    ok(res, buildMockS1Portfolio(userWallet));
    return;
  }

  ok(res, await getPortfolioProjection(userWallet));
});
