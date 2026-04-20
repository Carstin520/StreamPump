import dynamic from "next/dynamic";
import Head from "next/head";

import { PageShell } from "@/components/layout/PageShell";

const DynamicCreationCenter = dynamic(
  () => import("@/components/workspace/CreationCenter").then((mod) => mod.CreationCenter),
  { ssr: false },
);

export default function WorkspacePage() {
  return (
    <>
      <Head>
        <title>StreamPump | 创作中心</title>
      </Head>
      <PageShell
        eyebrow="StreamPump"
        subtitle="管理你的内容创作、赞助合作和链上发布流程"
        title="创作中心"
      >
        <DynamicCreationCenter />
      </PageShell>
    </>
  );
}
