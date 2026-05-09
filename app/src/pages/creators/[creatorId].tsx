import Head from "next/head";
import Link from "next/link";
import type {
  GetStaticPaths,
  GetStaticProps,
} from "next";
import { useRouter } from "next/router";

import { PageShell } from "@/components/layout/PageShell";
import { CreatorStageView } from "@/components/user/CreatorStageView";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";
import { CreatorMarketRecord } from "@/lib/api/types";
import {
  creators as fallbackCreators,
  posts as fallbackPosts,
} from "@/lib/mocks/discover";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
};

const normalizeCreatorLookupKey = (value: string) =>
  safeDecodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, "-");

const resolveCreator = (
  creators: CreatorMarketRecord[],
  aliases: CreatorMarketRecord[],
  rawCreatorId: string
) => {
  const lookupKey = normalizeCreatorLookupKey(rawCreatorId);

  const findMatchingCreator = (
    candidates: CreatorMarketRecord[],
    key: string
  ) => candidates.find((creator) => {
    const candidates = [
      creator.id,
      creator.name,
      creator.handle,
      creator.handle.replace(/^@/, ""),
    ];

    return candidates.some(
      (candidate) => normalizeCreatorLookupKey(candidate) === key
    );
  });

  const directCreator = findMatchingCreator(creators, lookupKey);
  if (directCreator) {
    return directCreator;
  }

  const aliasCreator = findMatchingCreator(aliases, lookupKey);
  if (!aliasCreator) {
    return undefined;
  }

  return (
    findMatchingCreator(creators, normalizeCreatorLookupKey(aliasCreator.name)) ??
    findMatchingCreator(creators, normalizeCreatorLookupKey(aliasCreator.handle)) ??
    aliasCreator
  );
};

export default function CreatorDetailPage({
  initialError,
  initialPosts,
}: PublicFeedPageProps) {
  const router = useRouter();
  const { creators, loading, postsByCreator } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });
  const creatorId = String(router.query.creatorId ?? "");
  const creator = resolveCreator(creators, fallbackCreators, creatorId);
  const creatorPosts = creator
    ? postsByCreator.get(creator.id) ??
      fallbackPosts.filter((post) => post.creatorId === creator.id)
    : [];

  if (router.isFallback || loading) {
    return (
      <>
        <Head>
          <title>StreamPump | Creator</title>
        </Head>
        <PageShell>
          <div className="py-10 text-sm text-[#8ea0ba]">Loading creator profile…</div>
        </PageShell>
      </>
    );
  }

  if (!creator) {
    return (
      <>
        <Head>
          <title>StreamPump | Creator</title>
        </Head>
        <PageShell>
          <div className="py-10 text-sm text-[#8ea0ba]">Imported creator not found.</div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`StreamPump | ${creator.name}`}</title>
      </Head>
      <PageShell>
        <div className="mb-3">
          <Link
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-xs text-[#9aabc4] transition hover:border-white/[0.12] hover:text-white"
            href="/trending"
          >
            <span aria-hidden>←</span>
            Trending Creators
          </Link>
        </div>
        <CreatorStageView creator={creator} posts={creatorPosts} />
      </PageShell>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  fallback: "blocking",
  paths: [],
});

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async () => ({
  props: await loadPublicFeedPageProps(),
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
