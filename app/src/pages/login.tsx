import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { LoginPreviewMode } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { loginPreviewDefaultMode } from "@/lib/public-data";
import { WORKSPACE_PATH, buildLoginHref, normalizeInternalHref } from "@/lib/routes";

const DynamicAuthOptionsPanel = dynamic(
  () => import("@/components/auth/AuthOptionsPanel").then((mod) => mod.AuthOptionsPanel),
  { ssr: false },
);

const getPreviewMode = (value: string | string[] | undefined): LoginPreviewMode =>
  value === "switch" ? "switch" : "welcome";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [previewMode, setPreviewMode] = useState<LoginPreviewMode>(loginPreviewDefaultMode);
  const nextHref = normalizeInternalHref(
    typeof router.query.next === "string" ? router.query.next : null,
  ) ?? WORKSPACE_PATH;

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    setPreviewMode(getPreviewMode(router.query.preview));
  }, [router.isReady, router.query.preview]);

  const handleModeChange = (mode: LoginPreviewMode) => {
    setPreviewMode(mode);
    void router.replace(buildLoginHref({
      nextPath: nextHref,
      preview: mode === "switch" ? "switch" : null,
    }), undefined, {
      shallow: true,
      scroll: false,
    });
  };

  return (
    <>
      <Head>
        <title>{t("page.login.title")}</title>
      </Head>
      <main className="relative min-h-screen bg-[#090d14] text-white">
        <AnimatedFeedBackdrop className="opacity-[0.85]" />
        <div className="pointer-events-none fixed inset-[8%] z-0 rounded-[54px] border border-white/[0.03] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_36%)] backdrop-blur-[2px]" />

        <div className="relative z-[1] flex min-h-screen flex-col px-5 py-5 lg:px-8">
          <div className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/explore">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold shadow-[0_12px_30px_rgba(222,64,42,0.32)]">
                SP
              </span>
              <span className="text-lg font-semibold tracking-[-0.04em] text-white">StreamPump</span>
            </Link>

            <div className="hidden rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#8ea0ba] md:block">
              {t("auth.previewSync")} <code className="text-white/80">?preview=</code>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[1040px]">
              <div className="mx-auto mb-6 max-w-[760px]">
                <ProductReadinessBanner
                  description={t("auth.readinessDescription")}
                  status="MOCK_PREVIEW"
                  title={t("auth.readinessTitle")}
                />
              </div>

              <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.8fr)]">
                <div className="hidden px-6 lg:block">
                  <p className="text-xs uppercase tracking-[0.28em] text-[#7f90ab]">{t("auth.accessEyebrow")}</p>
                  <h1 className="mt-5 max-w-[520px] text-[56px] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
                    {t("auth.accessTitle")}
                  </h1>
                  <p className="mt-6 max-w-[440px] text-base leading-8 text-[#95a6bf]">
                    {t("auth.accessBody")}
                  </p>
                </div>

                <DynamicAuthOptionsPanel mode={previewMode} nextHref={nextHref} onModeChange={handleModeChange} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

(LoginPage as typeof LoginPage & { requiresWalletProviders?: boolean }).requiresWalletProviders = true;
