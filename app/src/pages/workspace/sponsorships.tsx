import Head from "next/head";

import { SponsorshipDesk } from "@/components/workspace/SponsorshipDesk";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { workspacePersonas } from "@/lib/mocks/workspace";

export default function SponsorshipsPage() {
  const persona = workspacePersonas.S2_ACTIVE;

  return (
    <>
      <Head>
        <title>StreamPump | Sponsorship Desk</title>
      </Head>
      <WorkspaceShell stage={persona.stage} wallet={persona.wallet}>
        <SponsorshipDesk />
      </WorkspaceShell>
    </>
  );
}
