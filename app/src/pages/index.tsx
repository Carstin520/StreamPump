import Head from "next/head";

import { DiscoverSurface } from "@/components/user/DiscoverSurface";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>StreamPump | User Surface</title>
      </Head>
      <DiscoverSurface />
    </>
  );
}
