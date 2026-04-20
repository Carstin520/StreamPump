import Head from "next/head";
import type {
  GetStaticPaths,
  GetStaticProps,
} from "next";
import { useRouter } from "next/router";

import { PostDetailExperience } from "@/components/post/PostDetailExperience";
import { EXPLORE_PATH } from "@/lib/routes";
import {
  loadPublicPostPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicPostPageProps,
} from "@/lib/public-feed-ssr";

export default function PostDetailPage({
  initialError,
  mediaOrigins,
  post,
}: PublicPostPageProps) {
  const router = useRouter();

  if (router.isFallback) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090d14] text-sm text-[#c8d4e6]">
        Loading imported post…
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>StreamPump | Post Detail</title>
        <link href="https://stream.mux.com" rel="preconnect" />
        {mediaOrigins.map((origin) => (
          <link crossOrigin="" href={origin} key={origin} rel="preconnect" />
        ))}
      </Head>
      {initialError ? (
        <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 text-center text-sm text-[#c8d4e6]">
          {initialError}
        </main>
      ) : null}
      {!initialError && !post ? (
        <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 text-center text-sm text-[#c8d4e6]">
          Imported post not found.
        </main>
      ) : null}
      {!initialError && post ? (
        <PostDetailExperience
          closeHref={EXPLORE_PATH}
          closeLabel="Back to explore"
          items={[post]}
          syncRoute
        />
      ) : null}
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  fallback: "blocking",
  paths: [],
});

export const getStaticProps: GetStaticProps<PublicPostPageProps> = async ({
  params,
}) => {
  const postId =
    typeof params?.postId === "string" ? params.postId.trim() : "";

  if (!postId) {
    return {
      notFound: true,
      revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
    };
  }

  const props = await loadPublicPostPageProps(postId);

  if (!props.post && !props.initialError) {
    return {
      notFound: true,
      revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
    };
  }

  return {
    props,
    revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
  };
};
