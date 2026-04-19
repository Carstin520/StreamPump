import dynamic from "next/dynamic";
import Head from "next/head";

import { posts } from "@/lib/public-data";
import { EXPLORE_PATH } from "@/lib/routes";

const DynamicPostDetailExperience = dynamic(
  () => import("@/components/post/PostDetailExperience").then((mod) => mod.PostDetailExperience),
  { ssr: false },
);

export default function PostDetailPage() {
  return (
    <>
      <Head>
        <title>StreamPump | Post Detail</title>
      </Head>
      <DynamicPostDetailExperience closeHref={EXPLORE_PATH} closeLabel="Back to explore" items={posts} syncRoute />
    </>
  );
}
