import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { StagePill } from "@/components/shared/StagePill";
import {
  ConsoleAuthRequired,
  ConsoleLoading,
  OverviewAside,
  OverviewConsole,
} from "@/components/workspace/OverviewConsole";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { CreatorSeasonState } from "@/lib/api/types";
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
            message: "Preview session · showing demo data while the workspace API is offline.",
          });
          return;
        }
        if (isAuthError(error)) {
          setState({
            status: "preview",
            tone: "warn",
            message: "Session expired — sign in again to load your live console.",
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_PATH),
          });
          return;
        }
        setState({
          status: "preview",
          tone: "info",
          message: `${getErrorMessage(error, "Workspace API unavailable")} · showing demo data.`,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, router.isReady]);

  const persona = useMemo<WorkspacePersona>(() => {
    if (isDemoMode) return workspacePersonas[activeStage];
    if (state.status === "ready") return buildPersonaFromWorkspace(state.data);
    if (state.status === "preview") return workspacePersonas[WORKSPACE_DEMO_STAGE];
    return workspacePersonas[WORKSPACE_DEMO_STAGE];
  }, [isDemoMode, activeStage, state]);

  return (
    <>
      <Head>
        <title>StreamPump | Operating Console</title>
      </Head>
      <WorkspaceShell aside={<OverviewAside persona={persona} />} stage={persona.stage} wallet={persona.wallet}>
        <ProductReadinessBanner
          description="This console loads live workspace manifests, proposal intents, and campaign summaries when an authenticated session is available. Demo mode and preview sessions still use seeded persona data; claimable balances and production operator states are not part of this overview API yet."
          status="SEEDED_DEMO"
          title="Workspace overview mixes live workflow reads with labeled preview fallback"
        />

        {isDemoMode ? <StageSwitcher activeStage={activeStage} onChange={setActiveStage} /> : null}

        {!isDemoMode && state.status === "loading" ? <ConsoleLoading /> : null}
        {!isDemoMode && state.status === "unauthenticated" ? (
          <ConsoleAuthRequired loginHref={state.loginHref} />
        ) : null}
        {!isDemoMode && state.status === "preview" ? (
          <WorkspacePreviewNotice
            loginHref={state.loginHref}
            message={state.message}
            tone={state.tone}
          />
        ) : null}

        {(isDemoMode || state.status === "ready" || state.status === "preview") && (
          <OverviewConsole persona={persona} />
        )}
      </WorkspaceShell>
    </>
  );
}

const WorkspacePreviewNotice = ({
  loginHref,
  message,
  tone,
}: {
  loginHref?: string;
  message: string;
  tone: PreviewTone;
}) => {
  const toneClass =
    tone === "warn"
      ? "border-[#de402a]/22 bg-[#1f120e]/70"
      : "border-[#67b8ff]/20 bg-[#0e1726]/70";
  const accentClass = tone === "warn" ? "text-[#ff8a78]" : "text-[#8ad0ff]";
  const dotClass = tone === "warn" ? "bg-[#de402a]" : "bg-[#67b8ff]";

  return (
    <section className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${accentClass}`}>
            {tone === "warn" ? "Session" : "Preview"}
          </p>
          <p className="truncate text-[11px] text-[#9aabc4]">{message}</p>
        </div>
        {loginHref ? (
          <a
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-[#cbd6e7] transition hover:border-white/[0.12] hover:text-white"
            href={loginHref}
          >
            Sign in again
          </a>
        ) : null}
      </div>
    </section>
  );
};

const StageSwitcher = ({
  activeStage,
  onChange,
}: {
  activeStage: CreatorSeasonState;
  onChange: (stage: CreatorSeasonState) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
    <span className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
      Demo stage
    </span>
    {WORKSPACE_STAGE_ORDER.map((stage) => (
      <button
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition ${
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
