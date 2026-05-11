import Head from "next/head";
import type { GetStaticProps } from "next";

import { TrendingSurface } from "@/components/user/DiscoverSurface";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";
import { useI18n } from "@/lib/i18n";

export default function TrendingPage({
  initialError,
  initialPosts,
  mediaOrigins,
}: PublicFeedPageProps) {
  const { t } = useI18n();

  return (
    <>
      <Head>
        <title>{t("page.trending.title")}</title>
        <link href="https://stream.mux.com" rel="preconnect" />
        {mediaOrigins.map((origin) => (
          <link crossOrigin="" href={origin} key={origin} rel="preconnect" />
        ))}
      </Head>
      <TrendingSurface initialError={initialError} initialPosts={initialPosts} />
    </>
  );
}

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
