import Head from "next/head";

import { TrendingSurface } from "@/components/user/DiscoverSurface";

export default function TrendingPage() {
  return (
    <>
      <Head>
        <title>StreamPump | Trending</title>
      </Head>
      <TrendingSurface />
    </>
  );
}
