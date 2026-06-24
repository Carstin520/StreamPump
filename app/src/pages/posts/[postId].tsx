import Head from "next/head";
import type {
  GetStaticPaths,
  GetStaticProps,
} from "next";
import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";

import { PostDetailExperience } from "@/components/post/PostDetailExperience";
import { useI18n } from "@/lib/i18n";
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
  relatedPosts,
}: PublicPostPageProps) {
  const router = useRouter();
  const { t } = useI18n();

  // Current post + siblings drive the related rail and prev/next paging.
  const items = useMemo(
    () => (post ? [post, ...relatedPosts] : []),
    [post, relatedPosts],
  );

  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(EXPLORE_PATH);
  }, [router]);

  if (router.isFallback) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090d14] text-sm text-[#c8d4e6]">
        {t("feed.loadingPost")}
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{t("page.postDetail.title")}</title>
        <link href="https://stream.mux.com" rel="preconnect" />
        {mediaOrigins.map((origin) => (
          <link crossOrigin="" href={origin} key={origin} rel="preconnect" />
        ))}
      </Head>
      {initialError ? (
        <PostDetailUnavailableState
          detail={initialError}
          title="Post detail source unavailable"
        />
      ) : null}
      {!initialError && !post ? (
        <PostDetailUnavailableState
          detail={t("feed.postNotFound")}
          title="Post detail record not found"
        />
      ) : null}
      {!initialError && post ? (
        <PostDetailExperience
          closeLabel={t("common.back")}
          currentPostId={post.id}
          items={items}
          onClose={handleClose}
          syncRoute
        />
      ) : null}
    </>
  );
}

const PostDetailUnavailableState = ({
  detail,
  title,
}: {
  detail: string;
  title: string;
}) => (
  <main className="relative flex min-h-screen items-center justify-center bg-[#090d14] px-4 py-5 text-white">
    <section className="w-full max-w-[520px] rounded-[18px] border tone-state-warning px-5 py-4">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#c8d4e6]">{detail}</p>
    </section>
  </main>
);

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
