import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import {
  ConsoleAuthRequired,
  ConsoleError,
  ConsoleLoading,
  OverviewAside,
} from "@/components/workspace/OverviewConsole";
import { OverviewConsoleV2 } from "@/components/workspace/OverviewConsoleV2";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceOverviewResponse, getWorkspaceOverview } from "@/lib/api/workspace";
import { getStoredAuthSession } from "@/lib/auth-session";
import { useI18n } from "@/lib/i18n";
import { WorkspacePersona, workspacePersonas } from "@/lib/mocks/workspace";
import { WORKSPACE_PATH, buildLoginHref } from "@/lib/routes";
import { clearAuthAndBuildLoginHref, isAuthError } from "@/lib/session-flow";
import {
  WORKSPACE_DEMO_STAGE,
  buildPersonaFromWorkspace,
  getErrorMessage,
  isLocalPreviewToken,
} from "@/lib/workspace-overview";

type WorkspaceState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | { status: "error"; message: string; loginHref?: string }
  | { status: "preview"; message: string }
  | { status: "ready"; data: WorkspaceOverviewResponse };

const OVERVIEW_V2_PATH = "/workspace/overview-v2";

export default function WorkspaceOverviewV2Page() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const isDemoMode = router.isReady && router.query.demo === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;

    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({ status: "unauthenticated", loginHref: buildLoginHref({ nextPath: OVERVIEW_V2_PATH }) });
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
            message: t("workspace.previewSessionActive"),
          });
          return;
        }
        if (isAuthError(error)) {
          setState({
            status: "error",
          message: "Session expired. Please sign in again.",
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_PATH),
          });
          return;
        }
        setState({
          status: "preview",
          message: `${getErrorMessage(error, "Workspace API unavailable")}. ${t("workspace.previewShowingDesk")}`,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, router.isReady, t]);

  const persona = useMemo<WorkspacePersona>(() => {
    if (isDemoMode) return workspacePersonas[WORKSPACE_DEMO_STAGE];
    if (state.status === "ready") return buildPersonaFromWorkspace(state.data);
    return workspacePersonas[WORKSPACE_DEMO_STAGE];
  }, [isDemoMode, state]);

  return (
    <>
      <Head>
        <title>{t("page.workspace.creatorDeskV2")}</title>
      </Head>
      <WorkspaceShell aside={<OverviewAside persona={persona} />} stage={persona.stage} wallet={persona.wallet}>
        {!isDemoMode && state.status === "loading" ? <ConsoleLoading /> : null}
        {!isDemoMode && state.status === "unauthenticated" ? (
          <ConsoleAuthRequired loginHref={state.loginHref} />
        ) : null}
        {!isDemoMode && state.status === "error" ? (
          <ConsoleError loginHref={state.loginHref} message={state.message} />
        ) : null}
        {!isDemoMode && state.status === "preview" ? (
          <WorkspacePreviewNotice message={state.message} />
        ) : null}

        {(isDemoMode || state.status === "ready" || state.status === "preview") && (
          <OverviewConsoleV2 persona={persona} />
        )}
      </WorkspaceShell>
    </>
  );
}

const WorkspacePreviewNotice = ({ message }: { message: string }) => {
  const { t } = useI18n();

  return (
  <section className="rounded-2xl border border-[#f0b35f]/20 bg-[#1c1510]/72 px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0b35f]">
          {t("workspace.previewDesk")}
        </p>
        <p className="mt-1 text-sm text-[#c6d1e2]">{message}</p>
      </div>
      <span className="rounded-full border border-[#f0b35f]/20 bg-[#f0b35f]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffd39b]">
        {t("workspace.previewData")}
      </span>
    </div>
  </section>
  );
};
