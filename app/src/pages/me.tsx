import Head from "next/head";
import Link from "next/link";
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
import { PROFILE_PATH, buildLoginHref } from "@/lib/routes";
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

type Translate = (key: string, params?: Record<string, string>) => string;

// Build a REAL, session-backed profile from the account record only. There is no
// mock/fixture fallback: fields we cannot know for a real user (social counts,
// avatar photo, banner) are left neutral so nothing fake is rendered.
const buildSessionUser = (account: AccountMeRecord, t: Translate): CurrentUserRecord => {
  const displayName =
    account.profile?.displayName ||
    account.identity?.displayName ||
    shortenWallet(account.wallet);
  const handle = account.profile?.handle ? account.profile.handle : shortenWallet(account.wallet);
  const roleLabel = account.profile?.role
    ? t(`me.role.${account.profile.role.toLowerCase()}`)
    : null;

  return {
    id: account.profile?.handle ?? account.wallet,
    name: displayName,
    handle,
    location: "",
    bio: roleLabel ? t("me.sessionBio", { role: roleLabel }) : "",
    followingCount: 0,
    followersCount: 0,
    totalLikesAndSavesCount: 0,
    sessionMode:
      account.storageStatus === "LIVE" ? t("me.sessionLive") : t("me.sessionMigration"),
    primaryWallet: account.wallet,
    avatarSrc: "",
    bannerSrc: "",
  };
};

export default function MePage({
  initialError,
  initialPosts,
}: PublicFeedPageProps) {
  const { t } = useI18n();
  const {
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
    () => (account ? buildSessionUser(account, t) : null),
    [account, t],
  );

  const isSignedOut = accountState.kind === "signed-out";
  const isChecking = accountState.kind === "checking";

  return (
    <>
      <Head>
        <title>{t("page.me.title")}</title>
      </Head>
      <PageShell hideTopbar>
        <div className="mx-auto max-w-[1280px] space-y-4 px-1 py-3">
          <MeReadinessNotice accountState={accountState} error={!loading ? error : null} />
          {isChecking ? (
            <div className="py-10 text-sm text-[#8ea0ba]">{t("common.loading")}</div>
          ) : isSignedOut ? (
            <MeSignedOut />
          ) : sessionBackedUser ? (
            loading ? (
              <div className="py-10 text-sm text-[#8ea0ba]">{t("common.loading")}</div>
            ) : (
              <MeSurface
                currentUser={sessionBackedUser}
                influence={influence}
                posts={posts}
                savedPosts={currentUserSavedPosts}
              />
            )
          ) : (
            <MeAccountUnavailable />
          )}
        </div>
      </PageShell>
    </>
  );
}

const MeSignedOut = () => {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-[520px] rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-2xl text-[#8ea0ba]">
        ↳
      </div>
      <h1 className="mt-4 text-lg font-semibold text-white">{t("me.signedOutTitle")}</h1>
      <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-[#8ea0ba]">{t("me.signedOutBody")}</p>
      <Link
        className="mt-5 inline-flex rounded-full bg-[#de402a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ea523e]"
        href={buildLoginHref({ nextPath: PROFILE_PATH })}
      >
        {t("me.signInCta")}
      </Link>
    </section>
  );
};

const MeAccountUnavailable = () => {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-[520px] rounded-[20px] border tone-state-warning px-6 py-12 text-center">
      <h1 className="text-lg font-semibold text-white">{t("me.accountUnavailableTitle")}</h1>
      <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-[#9aabc4]">{t("me.accountUnavailableBody")}</p>
    </section>
  );
};

const MeReadinessNotice = ({
  accountState,
  error,
}: {
  accountState: AccountState;
  error: string | null;
}) => {
  const { t } = useI18n();
  const messages: string[] = [];

  if (accountState.kind === "error") {
    messages.push(t("me.accountApiError", { message: accountState.message }));
  }

  if (error) {
    messages.push(t("me.feedUnavailable", { error }));
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[14px] border tone-state-warning px-4 py-3">
      <p className="text-sm font-semibold text-white">{t("me.partialTitle")}</p>
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
