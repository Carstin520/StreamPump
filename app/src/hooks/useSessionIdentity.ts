import { useEffect, useState } from "react";

import { getAccountMe } from "@/lib/api/account";
import { getStoredAuthSession } from "@/lib/auth-session";
import type { AccountRole } from "@/lib/api/types";

/**
 * Real, session-backed identity for global chrome (the consumer shell).
 *
 * P0 truth gate: this never returns a fixture. When there is no wallet-backed
 * session it reports `signed-out` so the UI can show an honest sign-in CTA; when
 * signed in it surfaces the wallet immediately and enriches with the account
 * profile once it resolves. An account API failure keeps the session-backed
 * identity rather than substituting mock data.
 */
export type SessionIdentity =
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      wallet: string;
      displayName: string | null;
      handle: string | null;
      role: AccountRole | null;
    };

export const useSessionIdentity = (): SessionIdentity => {
  const [identity, setIdentity] = useState<SessionIdentity>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const session = getStoredAuthSession();

    if (!session?.accessToken) {
      setIdentity({ status: "signed-out" });
      return;
    }

    // Seed from the wallet session immediately so the shell shows a real,
    // wallet-backed identity even before the account profile resolves.
    setIdentity({
      status: "signed-in",
      wallet: session.wallet,
      displayName: session.identity?.displayName ?? null,
      handle: null,
      role: null,
    });

    void getAccountMe(session.accessToken)
      .then((account) => {
        if (cancelled) return;
        setIdentity({
          status: "signed-in",
          wallet: account.wallet,
          displayName: account.profile?.displayName ?? account.identity?.displayName ?? null,
          handle: account.profile?.handle ?? null,
          role: account.profile?.role ?? null,
        });
      })
      .catch(() => {
        // Keep the session-backed identity; never fall back to a fixture user.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return identity;
};

export const shortenWalletLabel = (wallet: string) =>
  wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet;
