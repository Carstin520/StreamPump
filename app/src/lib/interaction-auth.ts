import type { NextRouter } from "next/router";

import { getStoredAuthSession } from "@/lib/auth-session";
import { buildLoginHrefFromRouter } from "@/lib/session-flow";

export const requireInteractiveSession = (
  router: Pick<NextRouter, "asPath" | "pathname" | "push">
) => {
  const session = getStoredAuthSession();
  if (session) {
    return true;
  }

  void router.push(buildLoginHrefFromRouter(router));
  return false;
};
