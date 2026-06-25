import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import {
  ConsoleAuthRequired,
  ConsoleLoading,
  RECENT_PRIORITY,
  RecentContentRow,
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
  WORKSPACE_CONTENT_NEW_PATH,
  WORKSPACE_LIBRARY_PATH,
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

type LibraryState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | { status: "preview"; message: string; tone: PreviewTone; loginHref?: string }
  | { status: "ready"; data: WorkspaceOverviewResponse };

export default function WorkspaceLibraryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<LibraryState>({ status: "loading" });
  const isDemoMode = router.isReady && router.query.demo === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;

    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({ status: "unauthenticated", loginHref: buildLoginHref({ nextPath: WORKSPACE_LIBRARY_PATH }) });
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
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_LIBRARY_PATH),
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
        <title>{t("ws.library.pageTitle")}</title>
      </Head>
      <WorkspaceShell stage={persona.stage} wallet={persona.wallet}>
        <ProductReadinessBanner
          description={t("ws.readinessDesc")}
          status="SEEDED_DEMO"
          title={t("ws.readinessTitle")}
        />

        {!isDemoMode && state.status === "loading" ? <ConsoleLoading /> : null}
        {!isDemoMode && state.status === "unauthenticated" ? (
          <ConsoleAuthRequired loginHref={state.loginHref} />
        ) : null}
        {!isDemoMode && state.status === "preview" ? (
          <LibraryPreviewNotice loginHref={state.loginHref} message={state.message} tone={state.tone} />
        ) : null}

        {(isDemoMode || state.status === "ready" || state.status === "preview") && (
          <LibraryConsole persona={persona} />
        )}
      </WorkspaceShell>
    </>
  );
}

const LibraryConsole = ({ persona }: { persona: WorkspacePersona }) => {
  const { t } = useI18n();
  const items = [...persona.contentItems].sort(
    (a, b) => RECENT_PRIORITY[a.status] - RECENT_PRIORITY[b.status],
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-baseline gap-2 text-2xl font-extrabold tracking-[-0.02em] text-white">
          {t("ws.library.title")}
          <span className="text-[length:var(--fs-caption)] font-semibold text-[#7486a1]">
            {t("ws.library.count", { n: String(items.length) })}
          </span>
        </h1>
        <Link
          className="shrink-0 rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-2 text-[length:var(--fs-caption)] font-bold text-white shadow-[0_10px_24px_rgba(222,64,42,0.28)] transition hover:brightness-110"
          href={WORKSPACE_CONTENT_NEW_PATH}
        >
          {t("ws.postContent")}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-4 py-10 text-center text-[length:var(--fs-overline)] text-[#7e90aa]">
          {t("ws.noContent")} ·{" "}
          <Link className="text-[#cbd6e7] underline-offset-4 hover:underline" href={WORKSPACE_CONTENT_NEW_PATH}>
            {t("ws.uploadFirst")}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <RecentContentRow item={item} key={item.id} />
          ))}
        </div>
      )}
    </div>
  );
};

const LibraryPreviewNotice = ({
  loginHref,
  message,
  tone,
}: {
  loginHref?: string;
  message: string;
  tone: PreviewTone;
}) => {
  const { t } = useI18n();
  const toneClass =
    tone === "warn" ? "border-[#de402a]/22 bg-[#1f120e]/70" : "border-[#67b8ff]/20 bg-[#0e1726]/70";
  const accentClass = tone === "warn" ? "text-[#ff8a78]" : "text-[#8ad0ff]";
  const dotClass = tone === "warn" ? "bg-[#de402a]" : "bg-[#67b8ff]";

  return (
    <section className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          <p className={`text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] ${accentClass}`}>
            {tone === "warn" ? t("ws.preview.sessionTag") : t("ws.preview.previewTag")}
          </p>
          <p className="truncate text-[length:var(--fs-micro)] text-[#9aabc4]">{message}</p>
        </div>
        {loginHref ? (
          <a
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.12] hover:text-white"
            href={loginHref}
          >
            {t("ws.console.signInAgain")}
          </a>
        ) : null}
      </div>
    </section>
  );
};
