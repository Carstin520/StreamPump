import type { NextRouter } from "next/router";

import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth-session";
import { WORKSPACE_PATH, buildLoginHref, normalizeInternalHref } from "@/lib/routes";

export const getAuthSession = () => getStoredAuthSession();

export const getAccessToken = () => getStoredAuthSession()?.accessToken ?? null;

export const clearAuthSession = () => clearStoredAuthSession();

export const isAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_INVALID") ||
    message.includes("401")
  );
};

export const resolveNextPath = (
  router: Pick<NextRouter, "asPath" | "pathname">,
  fallback = WORKSPACE_PATH,
) =>
  normalizeInternalHref(router.asPath) ??
  normalizeInternalHref(router.pathname) ??
  fallback;

export const buildLoginHrefFromRouter = (
  router: Pick<NextRouter, "asPath" | "pathname">,
  fallback = WORKSPACE_PATH,
) => buildLoginHref({ nextPath: resolveNextPath(router, fallback) });

export const clearAuthAndBuildLoginHref = (nextPath?: string | null) => {
  clearStoredAuthSession();
  return buildLoginHref({ nextPath });
};

export const loadWithPublicFallback = async <T>({
  loadPublic,
  loadWithToken,
  token,
}: {
  loadPublic: () => Promise<T>;
  loadWithToken: (token: string) => Promise<T>;
  token?: string | null;
}) => {
  if (!token) {
    return loadPublic();
  }

  try {
    return await loadWithToken(token);
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    clearStoredAuthSession();
    return loadPublic();
  }
};
