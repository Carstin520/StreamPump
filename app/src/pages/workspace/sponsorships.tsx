import Head from "next/head";

import { SponsorshipDesk } from "@/components/workspace/SponsorshipDesk";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useI18n } from "@/lib/i18n";
import { workspacePersonas } from "@/lib/mocks/workspace";

export default function SponsorshipsPage() {
  const { t } = useI18n();
  const persona = workspacePersonas.S2_ACTIVE;

  return (
    <>
      <Head>
        <title>{t("page.workspace.sponsorshipDesk")}</title>
      </Head>
      <WorkspaceShell stage={persona.stage} wallet={persona.wallet}>
        <SponsorshipDesk />
      </WorkspaceShell>
    </>
  );
}
