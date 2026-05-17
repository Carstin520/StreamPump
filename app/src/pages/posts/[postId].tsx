import Head from "next/head";
import type {
  GetStaticPaths,
  GetStaticProps,
} from "next";
import { useRouter } from "next/router";
import { useCallback } from "react";

import { PostDetailExperience } from "@/components/post/PostDetailExperience";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
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
}: PublicPostPageProps) {
  const router = useRouter();
  const { t } = useI18n();

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
          items={[post]}
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
  <main className="relative min-h-screen bg-[#090d14] px-4 py-5 text-white">
    <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[980px] flex-col justify-center gap-3">
      <ProductReadinessBanner
        description="Post detail is wired to the public feed post API. If that API or backend media projection is unavailable, this page should fail transparently instead of silently presenting seeded content as a production post."
        status="SEEDED_DEMO"
        title="Post detail depends on public feed API data"
      />
      <section className="rounded-[18px] border border-[#f3b33e]/25 bg-[#1f1708]/60 px-5 py-4 text-[#f8d48a]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Post data source</p>
            <p className="mt-1 text-base font-semibold text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#c8d4e6]">{detail}</p>
            <p className="mt-2 text-xs leading-5 text-[#9aabc4]">
              Production readiness still needs deployed feed/media smoke checks and account-specific engagement records.
            </p>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[10px] font-semibold">
            SEEDED_DEMO
          </span>
        </div>
      </section>
    </div>
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
