import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";

import { usePublicFeedPosts } from "@/hooks/usePublicFeedPosts";
import { EXPLORE_PATH } from "@/lib/routes";

const DynamicPostDetailExperience = dynamic(
  () => import("@/components/post/PostDetailExperience").then((mod) => mod.PostDetailExperience),
  { ssr: false },
);

export default function PostDetailPage() {
  const router = useRouter();
  const { error, loading, posts } = usePublicFeedPosts();
  const routePostId =
    typeof router.query.postId === "string" ? router.query.postId : null;

  return (
    <>
      <Head>
        <title>StreamPump | Post Detail</title>
      </Head>
      {loading ? (
        <main className="flex min-h-screen items-center justify-center bg-[#090d14] text-sm text-[#c8d4e6]">
          Loading imported post…
        </main>
      ) : null}
      {!loading && error ? (
        <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 text-center text-sm text-[#c8d4e6]">
          {error}
        </main>
      ) : null}
      {!loading && !error && routePostId && !posts.some((post) => post.id === routePostId) ? (
        <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 text-center text-sm text-[#c8d4e6]">
          Imported post not found.
        </main>
      ) : null}
      {!loading && !error && posts.length > 0 && (!routePostId || posts.some((post) => post.id === routePostId)) ? (
        <DynamicPostDetailExperience closeHref={EXPLORE_PATH} closeLabel="Back to explore" items={posts} syncRoute />
      ) : null}
    </>
  );
}
