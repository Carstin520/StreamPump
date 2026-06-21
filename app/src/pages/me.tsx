import Head from "next/head";
import type { GetStaticProps } from "next";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { MeSurface } from "@/components/me/MeSurface";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";
import { getAccountMe } from "@/lib/api/account";
import { getAccountInfluence } from "@/lib/api/influence";
import { AccountMeRecord, CurrentUserRecord, InfluenceRecord } from "@/lib/api/types";
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
  const [influence, setInfluence] = useState<InfluenceRecord | null>(null);

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

    void getAccountInfluence(session.accessToken)
      .then((data) => {
        if (!cancelled) setInfluence(data);
      })
      .catch(() => {});

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
          <MeReadinessNotice accountState={accountState} error={!loading ? error : null} />
          {loading ? (
            <div className="py-10 text-sm text-[#8ea0ba]">{t("common.loading")}</div>
          ) : (
            <MeSurface
              currentUser={sessionBackedUser}
              influence={influence}
              posts={posts}
              savedPosts={currentUserSavedPosts}
            />
          )}
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
  const messages: string[] = [];

  if (accountState.kind === "error") {
    messages.push(`Account API error: ${accountState.message}`);
  }

  if (error) {
    messages.push(`Public feed unavailable: ${error}`);
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[14px] border border-[#f3b33e]/25 bg-[#1f1708]/55 px-4 py-3 text-[#f8d48a]">
      <p className="text-sm font-semibold text-white">Profile data partially unavailable</p>
      {messages.map((msg) => (
        <p className="mt-1 text-xs leading-5 text-[#9aabc4]" key={msg}>
          {msg}
        </p>
      ))}
    </section>
  );
};

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
