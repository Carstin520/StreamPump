import Head from "next/head";
import type { GetStaticProps } from "next";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { MeSurface } from "@/components/me/MeSurface";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";
import { getAccountMe } from "@/lib/api/account";
import { AccountMeRecord, CurrentUserRecord } from "@/lib/api/types";
import { getStoredAuthSession } from "@/lib/auth-session";
import { useI18n } from "@/lib/i18n";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";

type AccountState =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "ready"; account: AccountMeRecord }
  | { kind: "error"; message: string };

const shortenWallet = (wallet: string) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

const buildSessionUser = (
  baseUser: CurrentUserRecord,
  account: AccountMeRecord | null
): CurrentUserRecord => {
  if (!account?.profile) {
    return baseUser;
  }

  const displayName = account.profile.displayName || account.identity?.displayName || baseUser.name;
  const handle = account.profile.handle ? `@${account.profile.handle}` : baseUser.handle;
  const roleLabel = account.profile.role.toLowerCase();

  return {
    ...baseUser,
    id: account.profile.handle ?? account.wallet,
    name: displayName,
    handle,
    bio: `Session-backed ${roleLabel} profile. Portfolio, rewards, watchlist, and activity below still use preview records until their account-specific APIs are live.`,
    sessionMode:
      account.storageStatus === "LIVE"
        ? "Email/wallet session + AccountProfile"
        : "Session active · profile migration required",
    primaryWallet: shortenWallet(account.wallet),
  };
};

export default function MePage({
  initialError,
  initialPosts,
}: PublicFeedPageProps) {
  const { t } = useI18n();
  const {
    currentUser,
    currentUserSavedPosts,
    error,
    loading,
    posts,
  } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });
  const [accountState, setAccountState] = useState<AccountState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    const session = getStoredAuthSession();
    if (!session?.accessToken) {
      setAccountState({ kind: "signed-out" });
      return;
    }

    void getAccountMe(session.accessToken)
      .then((account) => {
        if (!cancelled) {
          setAccountState({ kind: "ready", account });
        }
      })
      .catch((accountError) => {
        if (!cancelled) {
          setAccountState({
            kind: "error",
            message: accountError instanceof Error ? accountError.message : "Unable to load account profile",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const account = accountState.kind === "ready" ? accountState.account : null;
  const sessionBackedUser = useMemo(
    () => buildSessionUser(currentUser, account),
    [account, currentUser],
  );

  return (
    <>
      <Head>
        <title>{t("page.me.title")}</title>
      </Head>
      <PageShell hideTopbar>
        <div className="mx-auto max-w-[1280px] space-y-4 px-1 py-3">
          <ProductReadinessBanner
            description="The profile header now reads AccountProfile for the current auth session when available. Holdings, rewards, watchlist, saved content, and activity remain preview/derived records until their account-specific APIs are productized."
            status={account?.profile ? "SEEDED_DEMO" : "BACKEND_READY_UI_GAP"}
            title="Profile header is session-backed; portfolio/rewards remain preview"
          />
          <MeReadinessNotice accountState={accountState} error={!loading ? error : null} />
          {loading ? (
            <div className="py-10 text-sm text-[#8ea0ba]">{t("common.loading")}</div>
          ) : null}
          {!loading ? (
            <>
              {error ? (
                <div className="rounded-[16px] border border-[#f3b33e]/20 bg-[#1f1708]/45 px-4 py-3 text-sm text-[#c8d4e6]">
                  Public feed API unavailable for this render: {error}. Showing local profile fixtures below.
                </div>
              ) : null}
              <MeSurface
                currentUser={sessionBackedUser}
                posts={posts}
                savedPosts={currentUserSavedPosts}
              />
            </>
          ) : null}
        </div>
      </PageShell>
    </>
  );
}

const MeReadinessNotice = ({
  accountState,
  error,
}: {
  accountState: AccountState;
  error: string | null;
}) => {
  const hasLiveProfile = accountState.kind === "ready" && Boolean(accountState.account.profile);
  const title = hasLiveProfile
    ? "Current-session profile loaded"
    : accountState.kind === "signed-out"
      ? "Signed-out profile preview"
      : accountState.kind === "error"
        ? "Account API unavailable"
        : "Waiting for account profile";

  return (
  <section className="rounded-[14px] border border-[#f3b33e]/25 bg-[#1f1708]/55 px-4 py-3 text-[#f8d48a]">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Profile data source</p>
        <p className="mt-1 text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#9aabc4]">
          {hasLiveProfile
            ? "Name, handle, role, and wallet come from AccountProfile. Holdings, reward balances, activity rows, saved content, and quick actions are still fixture/derived records until account-specific portfolio, reward, and activity APIs are live."
            : "The page still shows local profile fixtures when no valid account profile is available. Complete login and onboarding to attach the header to the current session."}
          {accountState.kind === "error" ? ` Account API error: ${accountState.message}.` : ""}
          {error ? " Public feed media is using local fallback records because the feed API is unavailable." : ""}
        </p>
      </div>
      <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[10px] font-semibold">
        {hasLiveProfile ? "SEEDED_DEMO" : "MOCK_PREVIEW"}
      </span>
    </div>
  </section>
  );
};

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
