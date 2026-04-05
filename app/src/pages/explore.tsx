import Head from "next/head";

import { DiscoverSurface } from "@/components/user/DiscoverSurface";

export default function ExplorePage() {
  return (
    <>
      <Head>
        <title>StreamPump | Explore</title>
      </Head>
      <DiscoverSurface />
    </>
  );
}
