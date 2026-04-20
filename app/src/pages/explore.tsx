import Head from "next/head";
import type { GetStaticProps } from "next";

import { DiscoverSurface } from "@/components/user/DiscoverSurface";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";

export default function ExplorePage({
  initialError,
  initialPosts,
  mediaOrigins,
}: PublicFeedPageProps) {
  return (
    <>
      <Head>
        <title>StreamPump | Explore</title>
        <link href="https://stream.mux.com" rel="preconnect" />
        {mediaOrigins.map((origin) => (
          <link crossOrigin="" href={origin} key={origin} rel="preconnect" />
        ))}
      </Head>
      <DiscoverSurface initialError={initialError} initialPosts={initialPosts} />
    </>
  );
}

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
