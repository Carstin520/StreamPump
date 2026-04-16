import dynamic from "next/dynamic";
import Head from "next/head";

import { posts } from "@/lib/mocks/discover";

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
      <DynamicPostDetailExperience closeHref="/explore" closeLabel="Back to explore" items={posts} syncRoute />
    </>
  );
}
