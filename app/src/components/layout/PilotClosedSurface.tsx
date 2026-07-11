import Head from "next/head";
import Link from "next/link";

import { useI18n } from "@/lib/i18n";
import { EXPLORE_PATH } from "@/lib/routes";

/**
 * Honest "invite-only pilot" closed surface rendered in place of routes that
 * expose on-chain fund actions (market/buyout/portfolio/rewards/endorse) when the
 * public demo flag is off. It mounts NO transaction UI — the gated page component
 * never mounts, so none of its effects or wallet flows run.
 */
export const PilotClosedSurface = () => {
  const { t } = useI18n();

  return (
    <>
      <Head>
        <title>{`StreamPump | ${t("pilot.closed.title")}`}</title>
      </Head>
      <main className="relative flex min-h-screen items-center justify-center bg-[#090d14] px-5 py-16 text-white">
        <section className="liquid-panel relative w-full max-w-[520px] overflow-hidden border border-white/[0.08] px-7 py-9 text-center shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f8d48a]">
            {t("pilot.closed.eyebrow")}
          </p>
          <h1 className="type-h1 mt-4 font-semibold text-white">{t("pilot.closed.title")}</h1>
          <p className="mt-4 text-sm leading-7 text-[#93a3bb]">{t("pilot.closed.body")}</p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              className="card-radius block border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/[0.2] hover:bg-white/[0.08]"
              href={EXPLORE_PATH}
            >
              {t("pilot.closed.backHome")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};
