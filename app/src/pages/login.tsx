import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { LanguageSwitch } from "@/components/shared/LanguageSwitch";
import { LoginPreviewMode } from "@/lib/api/types";
import { previewProviderExchangeEnabled, publicDemoEnabled } from "@/lib/feature-flags";
import { useI18n } from "@/lib/i18n";
import { loginPreviewDefaultMode } from "@/lib/public-data";
import { WORKSPACE_PATH, buildLoginHref, normalizeInternalHref } from "@/lib/routes";

const DynamicAuthOptionsPanel = dynamic(
  () => import("@/components/auth/AuthOptionsPanel").then((mod) => mod.AuthOptionsPanel),
  { ssr: false },
);

const WaterRippleBackdrop = dynamic(
  () => import("@/components/shared/WaterRippleBackdrop").then((mod) => mod.WaterRippleBackdrop),
  { ssr: false },
);

const HERO_WORD_KEYS = [
  "auth.heroWord.creator",
  "auth.heroWord.fan",
  "auth.heroWord.sponsor",
] as const;

const HERO_ROTATE_MS = 2800;

const getPreviewMode = (value: string | string[] | undefined): LoginPreviewMode =>
  value === "switch" ? "switch" : "welcome";

const RotatingHeroWord = ({ words }: { words: string[] }) => {
  const [[current, previous], setRotation] = useState<[number, number | null]>([0, null]);

  useEffect(() => {
    if (typeof window === "undefined" || words.length <= 1) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      return;
    }

    const interval = window.setInterval(() => {
      setRotation(([index]) => [(index + 1) % words.length, index]);
    }, HERO_ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [words.length]);

  return (
    <span className="hero-word-slot" aria-hidden="true">
      {words.map((word, index) => {
        const stateClass =
          index === current
            ? "hero-word-current"
            : index === previous
              ? "hero-word-exit"
              : "";
        return (
          <span className={`hero-word ${stateClass}`.trim()} key={word}>
            <span className="hero-word-text">{word}</span>
          </span>
        );
      })}
    </span>
  );
};

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const demoAuthEnabled = publicDemoEnabled() && previewProviderExchangeEnabled();
  const [previewMode, setPreviewMode] = useState<LoginPreviewMode>(loginPreviewDefaultMode);
  const nextHref = normalizeInternalHref(
    typeof router.query.next === "string" ? router.query.next : null,
  ) ?? WORKSPACE_PATH;

  const heroWords = useMemo(() => HERO_WORD_KEYS.map((key) => t(key)), [t]);
  const heroLead = t("auth.heroTitleLead");
  const heroTail = t("auth.heroTitleTail");

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
      <main className="relative min-h-screen overflow-hidden bg-[#090d14] text-white">
        <WaterRippleBackdrop />

        <div className="relative z-[1] flex min-h-screen flex-col px-5 py-5 lg:px-8">
          <div className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/explore">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold shadow-[0_12px_30px_rgba(222,64,42,0.32)]">
                SP
              </span>
              <span className="text-lg font-semibold tracking-[-0.04em] text-white">StreamPump</span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <p className="login-enter login-enter-1 text-[length:var(--fs-overline)] font-medium uppercase tracking-[0.28em] text-[color:var(--text-faint)]">
              {t("auth.accessEyebrow")}
            </p>

            <h1 className="login-enter login-enter-2 type-display mt-4 max-w-[720px] font-semibold text-[color:var(--text-main)]">
              <span className="sr-only">{`${heroLead}${heroWords[0] ?? ""}${heroTail}`}</span>
              <span aria-hidden="true">
                <span>{heroLead}</span>
                <RotatingHeroWord words={heroWords} />
                <span>{heroTail}</span>
              </span>
            </h1>

            <div className="login-enter login-enter-3 mt-9 w-full max-w-[420px]">
              <DynamicAuthOptionsPanel mode={previewMode} nextHref={nextHref} onModeChange={handleModeChange} />
            </div>
          </div>

          <div className="flex items-center justify-center pb-1">
            <LanguageSwitch compact />
          </div>
        </div>
      </main>
    </>
  );
}

(LoginPage as typeof LoginPage & { requiresWalletProviders?: boolean }).requiresWalletProviders = true;
