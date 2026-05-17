import Head from "next/head";
import type { GetStaticProps } from "next";

import { PageShell } from "@/components/layout/PageShell";
import { MeSurface } from "@/components/me/MeSurface";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";
import { useI18n } from "@/lib/i18n";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";

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

  return (
    <>
      <Head>
        <title>{t("page.me.title")}</title>
      </Head>
      <PageShell hideTopbar>
        <div className="mx-auto max-w-[1280px] space-y-4 px-1 py-3">
          <ProductReadinessBanner
            description="The profile surface currently combines public feed records with local portfolio, rewards, watchlist, and activity fixtures. It is not yet backed by the current session portfolio API, reward ledger, or account-specific activity APIs."
            status="MOCK_PREVIEW"
            title="Profile is a local account preview"
          />
          <MeReadinessNotice error={!loading ? error : null} />
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
                currentUser={currentUser}
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

const MeReadinessNotice = ({ error }: { error: string | null }) => (
  <section className="rounded-[14px] border border-[#f3b33e]/25 bg-[#1f1708]/55 px-4 py-3 text-[#f8d48a]">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Profile data source</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {error ? "Local profile fallback active" : "Local account and portfolio preview"}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#9aabc4]">
          Holdings, reward balances, activity rows, saved content, and quick actions are fixture/derived records for product preview. No current-session wallet portfolio, reward claim API, or backend activity ledger is read here yet.
          {error ? " Public feed media is using local fallback records because the feed API is unavailable." : ""}
        </p>
      </div>
      <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[10px] font-semibold">
        MOCK_PREVIEW
      </span>
    </div>
  </section>
);

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
