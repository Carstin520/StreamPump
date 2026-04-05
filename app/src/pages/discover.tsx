import Head from "next/head";

import { DiscoverSurface } from "@/components/user/DiscoverSurface";

export default function DiscoverPage() {
  return (
    <>
      <Head>
        <title>StreamPump | Discover</title>
      </Head>
      <DiscoverSurface />
    </>
  );
}
