import Head from "next/head";
import type { GetStaticProps } from "next";

import { PageShell } from "@/components/layout/PageShell";
import { MeSurface } from "@/components/me/MeSurface";
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
        {loading ? (
          <div className="py-10 text-sm text-[#8ea0ba]">{t("common.loading")}</div>
        ) : null}
        {!loading && error ? (
          <div className="py-10 text-sm text-[#8ea0ba]">{error}</div>
        ) : null}
        {!loading && !error ? (
          <MeSurface
            currentUser={currentUser}
            posts={posts}
            savedPosts={currentUserSavedPosts}
          />
        ) : null}
      </PageShell>
    </>
  );
}

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
