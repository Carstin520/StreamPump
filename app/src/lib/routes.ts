export const EXPLORE_PATH = "/explore";
export const ACTIVITY_PATH = "/activity";
export const TRENDING_PATH = "/trending";
export const PORTFOLIO_PATH = "/portfolio";
export const PROFILE_PATH = "/me";
export const LOGIN_PATH = "/login";
export const WORKSPACE_PATH = "/workspace";
export const WORKSPACE_CONTENT_NEW_PATH = "/workspace/content/new";

export type RouteItem = {
  href: string;
  label: string;
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

export const primaryNavItems: RouteItem[] = [
  { href: EXPLORE_PATH, label: "发现", prefixes: [EXPLORE_PATH, "/posts"] },
  { href: ACTIVITY_PATH, label: "动态", prefixes: [ACTIVITY_PATH] },
  { href: TRENDING_PATH, label: "Trending", prefixes: [TRENDING_PATH] },
  { href: PORTFOLIO_PATH, label: "投资组合", prefixes: [PORTFOLIO_PATH] },
];

export const workspacePageTabs: RouteItem[] = [
  { href: WORKSPACE_PATH, label: "Overview", exact: true },
  {
    href: `${WORKSPACE_PATH}#intents`,
    label: "Needs Action",
    hashes: ["#intents"],
    prefixes: ["/workspace/intents"],
  },
  {
    href: WORKSPACE_CONTENT_NEW_PATH,
    label: "Create Content",
    prefixes: ["/workspace/content"],
  },
];
