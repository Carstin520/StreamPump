import Head from "next/head";

import { ActivitySurface } from "@/components/user/ActivitySurface";

export default function ActivityPage() {
  return (
    <>
      <Head>
        <title>StreamPump | 动态</title>
      </Head>
      <ActivitySurface />
    </>
  );
}
