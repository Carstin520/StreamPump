import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { StagePill } from "@/components/shared/StagePill";
import { OpportunityInbox } from "@/components/workspace/OpportunityInbox";
import {
  ConsoleAuthRequired,
  ConsoleError,
  ConsoleLoading,
} from "@/components/workspace/OverviewConsole";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { CreatorSeasonState } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import {
  WorkspaceOverviewResponse,
  getWorkspaceOverview,
} from "@/lib/api/workspace";
import { getStoredAuthSession } from "@/lib/auth-session";
import {
  WorkspacePersona,
  workspacePersonas,
} from "@/lib/mocks/workspace";
import { WORKSPACE_SPONSORSHIPS_PATH, buildLoginHref } from "@/lib/routes";
import { clearAuthAndBuildLoginHref, isAuthError } from "@/lib/session-flow";
import {
  WORKSPACE_STAGE_ORDER,
  buildPersonaFromWorkspace,
  getErrorMessage,
  isLocalPreviewToken,
} from "@/lib/workspace-overview";

type PreviewTone = "info" | "warn";

type InboxState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | { status: "preview"; message: string; tone: PreviewTone; loginHref?: string }
  | { status: "ready"; data: WorkspaceOverviewResponse };

// Demo defaults to the buyout stage so the graduation-sponsorship explainer is visible.
const SPONSORSHIPS_DEMO_STAGE: CreatorSeasonState = "S1_BUYOUT";

export default function SponsorshipsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<InboxState>({ status: "loading" });
  const [demoStage, setDemoStage] = useState<CreatorSeasonState>(SPONSORSHIPS_DEMO_STAGE);
  const isDemoMode = router.isReady && router.query.demo === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;

    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({ status: "unauthenticated", loginHref: buildLoginHref({ nextPath: WORKSPACE_SPONSORSHIPS_PATH }) });
      return;
    }

    getWorkspaceOverview(session.accessToken)
      .then((data) => {
        if (isMounted) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        if (isLocalPreviewToken(session.accessToken)) {
          setState({ status: "preview", tone: "info", message: t("ws.preview.offline") });
          return;
        }
        if (isAuthError(error)) {
          setState({
            status: "preview",
            tone: "warn",
            message: t("ws.preview.expired"),
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_SPONSORSHIPS_PATH),
          });
          return;
        }
        setState({
          status: "preview",
          tone: "info",
          message: t("ws.preview.apiError", { error: getErrorMessage(error, t("ws.preview.apiUnavailable")) }),
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, router.isReady, t]);

  // Mock persona is ONLY produced in explicit ?demo=1 mode (fail-closed). Failed
  // or absent live sessions never fall back to the mock inbox.
  const persona = useMemo<WorkspacePersona | null>(() => {
    if (isDemoMode) return workspacePersonas[demoStage];
    if (state.status === "ready") return buildPersonaFromWorkspace(state.data);
    return null;
  }, [isDemoMode, demoStage, state]);

  return (
    <>
      <Head>
        <title>{t("ws.opps.pageTitle")}</title>
      </Head>
      <WorkspaceShell stage={persona?.stage ?? SPONSORSHIPS_DEMO_STAGE} wallet={persona?.wallet}>
        <ProductReadinessBanner
          description={isDemoMode ? t("ws.opps.readinessDescDemo") : t("ws.opps.readinessDesc")}
          status={isDemoMode ? "MOCK_PREVIEW" : "SEEDED_DEMO"}
          title={isDemoMode ? t("ws.opps.readinessTitleDemo") : t("ws.opps.readinessTitle")}
        />

        {isDemoMode ? <DemoStageSwitcher activeStage={demoStage} onChange={setDemoStage} /> : null}

        {!isDemoMode && state.status === "loading" ? <ConsoleLoading /> : null}
        {!isDemoMode && state.status === "unauthenticated" ? (
          <ConsoleAuthRequired loginHref={state.loginHref} />
        ) : null}
        {!isDemoMode && state.status === "preview" ? (
          <ConsoleError loginHref={state.loginHref} message={state.message} />
        ) : null}

        {persona ? <OpportunityInbox persona={persona} /> : null}
      </WorkspaceShell>
    </>
  );
}

const DemoStageSwitcher = ({
  activeStage,
  onChange,
}: {
  activeStage: CreatorSeasonState;
  onChange: (stage: CreatorSeasonState) => void;
}) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
      <span className="px-2 text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
        {t("ws.demoStage")}
      </span>
      {WORKSPACE_STAGE_ORDER.map((stage) => (
        <button
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[length:var(--fs-micro)] transition ${
            activeStage === stage ? "bg-white/[0.06] text-white" : "text-[#7e90aa] hover:bg-white/[0.04] hover:text-white"
          }`}
          key={stage}
          onClick={() => onChange(stage)}
          type="button"
        >
          <StagePill compact stage={stage} />
        </button>
      ))}
    </div>
  );
};
