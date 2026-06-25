import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";

import { provisionEphemeralSession } from "@/lib/api/auth";
import { storeAuthSession } from "@/lib/auth-session";
import { useI18n } from "@/lib/i18n";
import { EXPLORE_PATH, TRENDING_PATH } from "@/lib/routes";

/**
 * Scan-landing for demo day. This is the QR-code target: a standalone,
 * mobile-first welcome (no app sidebar) that explains the loop and drops the
 * visitor into the experience.
 *
 * The "start" CTA provisions a per-user ephemeral managed-wallet session from
 * the backend pool (provisionEphemeralSession → POST /auth/ephemeral-session),
 * applies an admission jitter (NEXT_PUBLIC_DEMO_ADMISSION_JITTER_MS) to avoid a
 * thundering herd at scale, stores the session, then routes into the experience.
 * Until the pool endpoint ships, provisionEphemeralSession falls back to the
 * existing shared platform-wallet path so this still works locally.
 */

const STEP_KEYS = [
  { n: "1", labelKey: "onboarding.earnLabel", descKey: "onboarding.earnDesc", accent: "#de402a" },
  { n: "2", labelKey: "onboarding.backLabel", descKey: "onboarding.backDesc", accent: "#65ecaf" },
  { n: "3", labelKey: "onboarding.graduateLabel", descKey: "onboarding.graduateDesc", accent: "#67b8ff" },
] as const;

export default function TryPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startExperience = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      // Admission jitter — at scale this spreads the first on-chain action so 100
      // users don't hit getLatestBlockhash in the same second. 0 locally.
      const jitterMs = Number(process.env.NEXT_PUBLIC_DEMO_ADMISSION_JITTER_MS ?? "0");
      if (jitterMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * jitterMs));
      }
      const subject = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@streampump.local`;
      const session = await provisionEphemeralSession(subject);
      storeAuthSession(session);
      await router.push(EXPLORE_PATH);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>{t("try.headline")} · StreamPump</title>
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
      </Head>

      <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#090d14_0%,#0a1018_100%)] text-[#f5f7fb]">
        {/* ambient glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(222,64,42,0.18),transparent_60%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-10 pt-[max(28px,env(safe-area-inset-top))]">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[linear-gradient(150deg,#de402a,#f0795f)] text-base font-extrabold shadow-[0_8px_22px_rgba(222,64,42,0.34)]">
              S
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.01em]">StreamPump</span>
            <span className="ml-auto rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[length:var(--fs-nano)] font-medium text-[#9aabc4]">
              {t("try.eyebrow")}
            </span>
          </div>

          {/* Hero */}
          <div className="mt-9">
            <h1 className="text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em]">{t("try.headline")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#c8d2e3]">{t("try.sub")}</p>
          </div>

          {/* Steps */}
          <div className="mt-8">
            <p className="mb-3 text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.14em] text-[#7486a1]">
              {t("try.stepsTitle")}
            </p>
            <div className="space-y-3">
              {STEP_KEYS.map((step) => (
                <div
                  className="flex items-start gap-3.5 rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-4"
                  key={step.n}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold"
                    style={{
                      color: step.accent,
                      border: `1.5px solid color-mix(in srgb, ${step.accent} 45%, transparent)`,
                      background: `color-mix(in srgb, ${step.accent} 12%, transparent)`,
                    }}
                  >
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-tight">{t(step.labelKey)}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#93a2bb]">{t(step.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shield note */}
          <div className="mt-5 rounded-[14px] border border-[#67b8ff]/25 bg-[#67b8ff]/[0.07] px-4 py-3 text-[13px] leading-relaxed text-[#cfe2f5]">
            {t("onboarding.notInvestment")}
          </div>

          {/* Gift */}
          <p className="mt-4 text-center text-[13px] font-medium text-[#f0a08f]">{t("try.gift")}</p>

          {/* CTAs */}
          <div className="mt-5 space-y-3">
            <button
              className="w-full rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] py-3.5 text-[15px] font-bold text-white shadow-[0_16px_34px_rgba(222,64,42,0.34)] transition hover:brightness-110 disabled:opacity-60"
              disabled={starting}
              onClick={() => void startExperience()}
              type="button"
            >
              {starting ? t("try.connecting") : t("try.start")}
            </button>
            <button
              className="w-full rounded-full border border-white/[0.12] bg-white/[0.03] py-3 text-[14px] font-semibold text-[#c8d2e3] transition hover:border-white/[0.2] hover:text-white"
              onClick={() => void router.push(TRENDING_PATH)}
              type="button"
            >
              {t("try.browse")}
            </button>
            {error ? (
              <p className="text-center text-[12px] leading-relaxed text-[#f3a08f]">{t("try.connectError")}</p>
            ) : null}
          </div>

          {/* Readiness label */}
          <p className="mt-auto pt-8 text-center text-[length:var(--fs-nano)] text-[#5a6d87]">{t("try.readiness")}</p>
        </div>
      </main>
    </>
  );
}
