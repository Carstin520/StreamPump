import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { StagePill } from "@/components/shared/StagePill";
import {
  ConsoleAuthRequired,
  ConsoleError,
  ConsoleLoading,
  OverviewConsole,
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
import { WORKSPACE_PATH, buildLoginHref } from "@/lib/routes";
import { clearAuthAndBuildLoginHref, isAuthError } from "@/lib/session-flow";
import {
  WORKSPACE_DEMO_STAGE,
  WORKSPACE_STAGE_ORDER,
  buildPersonaFromWorkspace,
  getErrorMessage,
  isLocalPreviewToken,
} from "@/lib/workspace-overview";

type PreviewTone = "info" | "warn";

type WorkspaceState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | {
      status: "preview";
      message: string;
      tone: PreviewTone;
      loginHref?: string;
    }
  | { status: "ready"; data: WorkspaceOverviewResponse };

export default function WorkspacePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [activeStage, setActiveStage] = useState<CreatorSeasonState>(WORKSPACE_DEMO_STAGE);
  const isDemoMode = router.isReady && router.query.demo === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;

    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({ status: "unauthenticated", loginHref: buildLoginHref({ nextPath: WORKSPACE_PATH }) });
      return;
    }

    getWorkspaceOverview(session.accessToken)
      .then((data) => {
        if (isMounted) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        if (isLocalPreviewToken(session.accessToken)) {
          setState({
            status: "preview",
            tone: "info",
            message: t("ws.preview.offline"),
          });
          return;
        }
        if (isAuthError(error)) {
          setState({
            status: "preview",
            tone: "warn",
            message: t("ws.preview.expired"),
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_PATH),
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

  // Mock persona is ONLY produced in explicit ?demo=1 mode. Live sessions render
  // the projection-backed persona; failed/absent sessions never fall back to
  // mock persona data (fail-closed).
  const persona = useMemo<WorkspacePersona | null>(() => {
    if (isDemoMode) return workspacePersonas[activeStage];
    if (state.status === "ready") return buildPersonaFromWorkspace(state.data);
    return null;
  }, [isDemoMode, activeStage, state]);

  return (
    <>
      <Head>
        <title>{t("ws.pageTitle")}</title>
      </Head>
      <WorkspaceShell stage={persona?.stage ?? WORKSPACE_DEMO_STAGE} wallet={persona?.wallet}>
        <ProductReadinessBanner
          description={isDemoMode ? t("ws.readinessDescDemo") : t("ws.readinessDesc")}
          status={isDemoMode ? "MOCK_PREVIEW" : "SEEDED_DEMO"}
          title={isDemoMode ? t("ws.readinessTitleDemo") : t("ws.readinessTitle")}
        />

        {isDemoMode ? <StageSwitcher activeStage={activeStage} onChange={setActiveStage} /> : null}

        {!isDemoMode && state.status === "loading" ? <ConsoleLoading /> : null}
        {!isDemoMode && state.status === "unauthenticated" ? (
          <ConsoleAuthRequired loginHref={state.loginHref} />
        ) : null}
        {!isDemoMode && state.status === "preview" ? (
          <ConsoleError loginHref={state.loginHref} message={state.message} />
        ) : null}

        {persona ? <OverviewConsole persona={persona} /> : null}
      </WorkspaceShell>
    </>
  );
}

const StageSwitcher = ({
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
          activeStage === stage
            ? "bg-white/[0.06] text-white"
            : "text-[#7e90aa] hover:bg-white/[0.04] hover:text-white"
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
