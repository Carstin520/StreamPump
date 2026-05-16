import Head from "next/head";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
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
        <div className="space-y-5">
          <ProductReadinessBanner
            description="This sponsorship desk is assembled from local workspace mock campaigns. It is useful for reviewing the S2 operations model, but it is not a live proposal, funding, oracle, or settlement console yet."
            status="MOCK_PREVIEW"
            title="Sponsorship desk is a mock operator preview"
          />
          <SponsorshipDesk />
        </div>
      </WorkspaceShell>
    </>
  );
}
