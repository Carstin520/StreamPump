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
import { useI18n } from "@/lib/i18n";
import { isDemoCreatorRoute, resolveFallbackCreator } from "@/lib/s1-market-view";
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
  rawCreatorId: string
) => {
  const lookupKey = normalizeCreatorLookupKey(rawCreatorId);

  return creators.find((creator) => {
    const candidates = [
      creator.id,
      creator.name,
      creator.handle,
      creator.handle.replace(/^@/, ""),
    ];

    return candidates.some(
      (candidate) => normalizeCreatorLookupKey(candidate) === lookupKey
    );
  });
};

function CreatorProfileReadinessNotice({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <section className="rounded-[14px] border tone-state-warning px-4 py-3">
      <p className="text-sm font-semibold text-white">Creator profile unavailable</p>
      <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{error}</p>
    </section>
  );
}

export default function CreatorDetailPage({
  initialError,
  initialPosts,
}: PublicFeedPageProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { creators, error, loading, postsByCreator } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });
  const creatorId = String(router.query.creatorId ?? "");
  // Demo-slug fallback: known seeded slugs (mika-zhou, luna-cai, …) resolve to
  // their fixture record so the demo creator -> market/buyout entry works.
  // Genuine unknown creators still fall through to the honest "not found" state.
  const demoLookupKey = normalizeCreatorLookupKey(creatorId);
  const creator =
    resolveCreator(creators, creatorId) ??
    (isDemoCreatorRoute(demoLookupKey) ? resolveFallbackCreator(demoLookupKey) : undefined);
  const creatorPosts = creator
    ? postsByCreator.get(creator.id) ?? []
    : [];

  if (router.isFallback || loading) {
    return (
      <>
        <Head>
          <title>{`StreamPump | ${t("page.creator.fallback")}`}</title>
        </Head>
        <PageShell>
          <div className="py-10 text-sm text-[#8ea0ba]">{t("feed.loadingCreator")}</div>
        </PageShell>
      </>
    );
  }

  if (!creator) {
    return (
      <>
        <Head>
          <title>{`StreamPump | ${t("page.creator.fallback")}`}</title>
        </Head>
        <PageShell>
          <div className="py-10 text-sm text-[#8ea0ba]">{t("feed.creatorNotFound")}</div>
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
        <div className="space-y-4">
          <CreatorProfileReadinessNotice error={error ?? initialError} />
          <div>
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-xs text-[#9aabc4] transition hover:border-white/[0.12] hover:text-white"
              href="/trending"
            >
              <span aria-hidden>←</span>
              {t("feed.trendingCreators")}
            </Link>
          </div>
          <CreatorStageView creator={creator} posts={creatorPosts} />
        </div>
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
