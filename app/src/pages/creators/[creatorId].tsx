import Head from "next/head";
import Link from "next/link";
import type {
  GetStaticPaths,
  GetStaticProps,
} from "next";
import { useRouter } from "next/router";

import { PageShell } from "@/components/layout/PageShell";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { CreatorStageView } from "@/components/user/CreatorStageView";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";
import { CreatorMarketRecord } from "@/lib/api/types";
import {
  creators as fallbackCreators,
  findCreatorStrict,
  posts as fallbackPosts,
} from "@/lib/mocks/discover";
import { useI18n } from "@/lib/i18n";
import {
  loadPublicFeedPageProps,
  PUBLIC_FEED_REVALIDATE_SECONDS,
  type PublicFeedPageProps,
} from "@/lib/public-feed-ssr";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";

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

function CreatorProfileReadinessNotice({
  apiError,
  hasSeededRoute,
  hasSeededMarketLink,
}: {
  apiError: string | null;
  hasSeededRoute: boolean;
  hasSeededMarketLink: boolean;
}) {
  const config = hasSeededRoute
    ? {
        label: "SEEDED_DEMO",
        title: "Seeded creator profile",
        body: hasSeededMarketLink
          ? "This route combines seeded creator/profile market records with public or fallback post media. The market and buyout links open prepared S1 demo routes; price history, top holders, likely sponsors, and lifecycle are UI projections until full creator market read models are connected."
          : "This route uses a seeded creator profile with public or fallback post media. Price history, top holders, likely sponsors, and lifecycle are UI projections, not a complete on-chain creator read model.",
        tone: "border-[#67b8ff]/20 bg-[#0d1b2a]/55 text-[#a8d8ff]",
      }
    : apiError
      ? {
          label: "SEEDED_DEMO",
          title: "Public feed fallback active",
          body: "The public feed API did not return a complete creator view, so this profile is showing available fallback media and derived market projections. Do not treat the profile metrics as production market truth.",
          tone: "border-[#f3b33e]/25 bg-[#1f1708]/55 text-[#f8d48a]",
        }
      : {
          label: "LIVE + SEEDED_DEMO",
          title: "API-derived creator profile",
          body: "Posts and media can come from the public feed API, while creator market fields are still derived or seeded UI projections. Promotion requires real creator profile read models, rating provenance, cap usage, and S1/S2 state projection.",
          tone: "border-[#67b8ff]/20 bg-[#0d1b2a]/55 text-[#a8d8ff]",
        };

  return (
    <section className={`rounded-[14px] border px-4 py-3 ${config.tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Creator data source</p>
          <p className="mt-1 text-sm font-semibold text-white">{config.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{config.body}</p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[10px] font-semibold">
          {config.label}
        </span>
      </div>
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
  const seededCreator = findCreatorStrict(creatorId);
  const creator = resolveCreator(creators, fallbackCreators, creatorId) ?? findCreatorStrict(creatorId);
  const liveCreatorWallet = creator ? resolveCreatorWalletForRoute(creator.id) : null;
  const creatorPosts = creator
    ? postsByCreator.get(creator.id) ??
      fallbackPosts.filter((post) => post.creatorId === creator.id)
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
          <ProductReadinessBanner
            description="Creator profiles can render public feed media while market fields still come from seeded or derived projection data. S1/S2 profile truth needs creator market read models, rating provenance, cap usage, and projection-backed lifecycle state."
            status="SEEDED_DEMO"
            title="Creator profile mixes feed data with market projections"
          />
          <CreatorProfileReadinessNotice
            apiError={error ?? initialError}
            hasSeededMarketLink={Boolean(liveCreatorWallet)}
            hasSeededRoute={Boolean(seededCreator)}
          />
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

export const getStaticProps: GetStaticProps<PublicFeedPageProps> = async (context) => {
  const creatorId = String(context.params?.creatorId ?? "");
  const demoCreator = findCreatorStrict(creatorId);

  if (demoCreator) {
    return {
      props: {
        initialError: null,
        initialPosts: fallbackPosts.filter((post) => post.creatorId === demoCreator.id),
        mediaOrigins: [],
      },
      revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
    };
  }

  return {
    props: await loadPublicFeedPageProps(),
    revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
  };
};
