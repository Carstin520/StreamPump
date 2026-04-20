import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import { PageShell } from "@/components/layout/PageShell";
import { CreatorStageView } from "@/components/user/CreatorStageView";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";

export default function CreatorDetailPage() {
  const router = useRouter();
  const { creatorMap, postsByCreator } = usePublicFeedViewModel();
  const creatorId = String(router.query.creatorId ?? "");
  const creator = creatorMap.get(creatorId);
  const creatorPosts = creator ? postsByCreator.get(creator.id) ?? [] : [];

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
        <div className="mb-1">
          <Link className="inline-flex rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-[#d9e3f2]" href="/trending">
            返回 Trending Creators
          </Link>
        </div>
        <CreatorStageView creator={creator} posts={creatorPosts} />
      </PageShell>
    </>
  );
}
