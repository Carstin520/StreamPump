import Head from "next/head";
import type { GetStaticProps } from "next";

import { ActivitySurface } from "@/components/user/ActivitySurface";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";

export default function ActivityPage({
  initialError,
  initialPosts,
  mediaOrigins,
}: PublicFeedPageProps) {
  return (
    <>
      <Head>
        <title>StreamPump | 动态</title>
        <link href="https://stream.mux.com" rel="preconnect" />
        {mediaOrigins.map((origin) => (
          <link crossOrigin="" href={origin} key={origin} rel="preconnect" />
        ))}
      </Head>
      <ActivitySurface initialError={initialError} initialPosts={initialPosts} />
    </>
  );
}

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
