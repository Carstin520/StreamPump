import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { AnalyticsConsole } from "@/components/workspace/AnalyticsConsole";
import {
  ConsoleAuthRequired,
  ConsoleLoading,
} from "@/components/workspace/OverviewConsole";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
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
import {
  WORKSPACE_ANALYTICS_PATH,
  buildLoginHref,
} from "@/lib/routes";
import { clearAuthAndBuildLoginHref, isAuthError } from "@/lib/session-flow";
import {
  WORKSPACE_DEMO_STAGE,
  buildPersonaFromWorkspace,
  getErrorMessage,
  isLocalPreviewToken,
} from "@/lib/workspace-overview";

type PreviewTone = "info" | "warn";

type DataState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | { status: "preview"; message: string; tone: PreviewTone; loginHref?: string }
  | { status: "ready"; data: WorkspaceOverviewResponse };

export default function WorkspaceAnalyticsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<DataState>({ status: "loading" });
  const isDemoMode = router.isReady && router.query.demo === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;

    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({ status: "unauthenticated", loginHref: buildLoginHref({ nextPath: WORKSPACE_ANALYTICS_PATH }) });
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
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_ANALYTICS_PATH),
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

  const persona = useMemo<WorkspacePersona>(() => {
    if (isDemoMode) return workspacePersonas[WORKSPACE_DEMO_STAGE];
    if (state.status === "ready") return buildPersonaFromWorkspace(state.data);
    return workspacePersonas[WORKSPACE_DEMO_STAGE];
  }, [isDemoMode, state]);

  return (
    <>
      <Head>
        <title>{t("ws.data.pageTitle")}</title>
      </Head>
      <WorkspaceShell stage={persona.stage} wallet={persona.wallet}>
        <ProductReadinessBanner
          description={t("ws.data.readinessDesc")}
          status="MOCK_PREVIEW"
          title={t("ws.data.readinessTitle")}
        />

        {!isDemoMode && state.status === "loading" ? <ConsoleLoading /> : null}
        {!isDemoMode && state.status === "unauthenticated" ? (
          <ConsoleAuthRequired loginHref={state.loginHref} />
        ) : null}

        {(isDemoMode || state.status === "ready" || state.status === "preview") && (
          <AnalyticsConsole persona={persona} />
        )}
      </WorkspaceShell>
    </>
  );
}
