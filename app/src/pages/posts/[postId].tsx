import Head from "next/head";

import { PostDetailExperience } from "@/components/post/PostDetailExperience";
import { posts } from "@/lib/mock-data";

export default function PostDetailPage() {
  return (
    <>
      <Head>
        <title>StreamPump | Post Detail</title>
      </Head>
      <PostDetailExperience closeHref="/explore" closeLabel="Back to explore" items={posts} syncRoute />
    </>
  );
}
