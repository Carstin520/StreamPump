export const EXPLORE_PATH = "/explore";
export const ACTIVITY_PATH = "/activity";
export const TRENDING_PATH = "/trending";
export const PORTFOLIO_PATH = "/portfolio";
export const PROFILE_PATH = "/me";
export const LOGIN_PATH = "/login";
export const WORKSPACE_PATH = "/workspace";
export const WORKSPACE_CONTENT_NEW_PATH = "/workspace/content/new";
export const WORKSPACE_LIBRARY_PATH = "/workspace/library";
export const WORKSPACE_SPONSORSHIPS_PATH = "/workspace/sponsorships";
export const WORKSPACE_SPONSOR_ONBOARDING_PATH = "/workspace/sponsor-onboarding";
export const WORKSPACE_CAMPAIGNS_PATH = "/workspace/campaigns";
export const WORKSPACE_ANALYTICS_PATH = "/workspace/analytics";
export const WORKSPACE_EARNINGS_PATH = "/workspace/earnings";
export const WORKSPACE_SETTINGS_PATH = "/workspace/settings";
export const WORKSPACE_BUYOUT_PATH = "/workspace/buyout";
export const ONBOARDING_PATH = "/onboarding";
export const TRY_PATH = "/try";
export const REWARDS_PATH = "/rewards";
export const DEMO_PATH = "/demo";
export const PITCH_PATH = "/pitch";
export const DEMO_S1_MARKET_PATH = "/market/mika-zhou";
export const DEMO_S1_CREATOR_PATH = "/creators/mika-zhou";
export const DEMO_S1_BUYOUT_PATH = "/buyout/luna-cai";
export const DEMO_S2_WORKSPACE_PATH = "/workspace?demo=1";
export const DEMO_S2_ENDORSE_PATH = "/campaigns/prop-neo-park-2026q2/endorse";
export const DEMO_S2_SETTLEMENT_PATH = "/campaigns/prop-neo-park-2026q2/settlement";

export type RouteItem = {
  href: string;
  labelKey: string;
  label?: string;
  exact?: boolean;
  prefixes?: string[];
  hashes?: string[];
};

type ParsedInternalHref = {
  hash: string;
  path: string;
  search: string;
};

const normalizePathname = (value: string) => {
  if (!value || value === "/") {
    return "/";
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const parseInternalHref = (value: string): ParsedInternalHref => {
  const resolved = new URL(value.startsWith("/") ? value : `/${value}`, "http://local");

  return {
    hash: resolved.hash,
    path: normalizePathname(resolved.pathname),
    search: resolved.search,
  };
};

const prefixMatches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export const normalizeInternalHref = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const resolved = new URL(trimmed);
    return `${normalizePathname(resolved.pathname)}${resolved.search}${resolved.hash}`;
  }

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const resolved = parseInternalHref(trimmed);
  return `${resolved.path}${resolved.search}${resolved.hash}`;
};

export const buildLoginHref = ({
  nextPath,
  preview,
}: {
  nextPath?: string | null;
  preview?: "switch" | null;
} = {}) => {
  const params = new URLSearchParams();
  const normalizedNextPath = normalizeInternalHref(nextPath);

  if (preview === "switch") {
    params.set("preview", "switch");
  }

  if (normalizedNextPath && normalizedNextPath !== WORKSPACE_PATH) {
    params.set("next", normalizedNextPath);
  }

  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
};

export const buildPostHref = (postId: string) => `/posts/${postId}`;

export const isRouteActive = (currentHref: string, item: RouteItem) => {
  const current = parseInternalHref(currentHref);
  const target = parseInternalHref(item.href);

  if (item.hashes?.length && current.path === target.path && item.hashes.includes(current.hash)) {
    return true;
  }

  if (item.exact) {
    return current.path === target.path;
  }

  const prefixes = item.prefixes?.length ? item.prefixes : [target.path];
  return prefixes.some((prefix) => prefixMatches(current.path, normalizePathname(prefix)));
};

// Labels are i18n-driven (labelKey). Demo is an internal/presentation surface
// and is intentionally NOT in the consumer primary nav (still at /demo).
export const primaryNavItems: RouteItem[] = [
  { href: EXPLORE_PATH, labelKey: "nav.explore", prefixes: [EXPLORE_PATH, "/posts"] },
  { href: ACTIVITY_PATH, labelKey: "nav.activity", prefixes: [ACTIVITY_PATH] },
  { href: TRENDING_PATH, labelKey: "nav.trending", prefixes: [TRENDING_PATH] },
  { href: PORTFOLIO_PATH, labelKey: "nav.portfolio", prefixes: [PORTFOLIO_PATH] },
  { href: REWARDS_PATH, labelKey: "nav.rewards", prefixes: [REWARDS_PATH] },
  { href: WORKSPACE_PATH, labelKey: "nav.workspace", prefixes: [WORKSPACE_PATH] },
];

export const workspacePageTabs: RouteItem[] = [
  { href: WORKSPACE_PATH, labelKey: "nav.overview", exact: true },
  {
    href: WORKSPACE_SPONSORSHIPS_PATH,
    labelKey: "nav.needsAction",
    prefixes: ["/workspace/sponsorships", "/workspace/intents"],
  },
  {
    href: WORKSPACE_CONTENT_NEW_PATH,
    labelKey: "nav.createContent",
    prefixes: ["/workspace/content"],
  },
];

export type WorkspaceNavItem = RouteItem & {
  iconName: string;
  disabled?: boolean;
};

// Labels are i18n-driven (labelKey). Primary nav is narrowed to the Pilot
// corridor: overview, content creation, the dual-sign sponsorship desk, and
// sponsor KYB. Non-Pilot surfaces (library, S1 buyout, analytics, earnings,
// campaigns, settings) are `disabled` and grouped under a muted "soon" section
// so they read as not-in-Pilot rather than live product entries.
export const workspaceSidebarNav: WorkspaceNavItem[] = [
  { href: WORKSPACE_PATH, labelKey: "nav.overview", iconName: "overview", exact: true },
  { href: WORKSPACE_CONTENT_NEW_PATH, labelKey: "nav.create", iconName: "create", prefixes: ["/workspace/content"] },
  { href: WORKSPACE_SPONSORSHIPS_PATH, labelKey: "nav.sponsorships", iconName: "sponsor", prefixes: ["/workspace/sponsorships", "/workspace/intents"] },
  { href: WORKSPACE_SPONSOR_ONBOARDING_PATH, labelKey: "nav.sponsorKyb", iconName: "sponsor", prefixes: [WORKSPACE_SPONSOR_ONBOARDING_PATH] },
  { href: WORKSPACE_LIBRARY_PATH, labelKey: "nav.library", iconName: "library", prefixes: [WORKSPACE_LIBRARY_PATH], disabled: true },
  { href: WORKSPACE_BUYOUT_PATH, labelKey: "nav.buyout", iconName: "campaign", prefixes: ["/workspace/buyout"], disabled: true },
  { href: WORKSPACE_CAMPAIGNS_PATH, labelKey: "nav.campaign", iconName: "campaign", disabled: true },
  { href: WORKSPACE_ANALYTICS_PATH, labelKey: "nav.analytics", iconName: "analytics", prefixes: [WORKSPACE_ANALYTICS_PATH], disabled: true },
  { href: WORKSPACE_EARNINGS_PATH, labelKey: "nav.earnings", iconName: "earnings", prefixes: [WORKSPACE_EARNINGS_PATH], disabled: true },
  { href: WORKSPACE_SETTINGS_PATH, labelKey: "nav.settings", iconName: "settings", disabled: true },
];
