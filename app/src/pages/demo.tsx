import Head from "next/head";
import Link from "next/link";

import { PageShell } from "@/components/layout/PageShell";
import { ChevronRightIcon } from "@/components/shared/AppIcons";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import type { ProductReadinessStatus } from "@/components/shared/ProductReadinessBanner";
import { StagePill } from "@/components/shared/StagePill";
import { useI18n } from "@/lib/i18n";
import { findCreator } from "@/lib/public-data";
import {
  DEMO_S1_BUYOUT_PATH,
  DEMO_S1_CREATOR_PATH,
  DEMO_S1_MARKET_PATH,
  DEMO_S2_ENDORSE_PATH,
  DEMO_S2_SETTLEMENT_PATH,
  DEMO_S2_WORKSPACE_PATH,
  PORTFOLIO_PATH,
} from "@/lib/routes";

const demoCards = [
  {
    title: "S1 Market",
    subtitle: "Seeded creator market with live buy/sell builders when backend and wallet session are configured.",
    readiness: "SEEDED_DEMO" as ProductReadinessStatus,
    boundary: "Not open creator onboarding or production rating oracle.",
    stage: "S1_DISCOVERY" as const,
    creatorId: "mika-zhou",
    primaryHref: DEMO_S1_MARKET_PATH,
    primaryLabel: "Open market",
    secondaryLinks: [
      { href: DEMO_S1_CREATOR_PATH, label: "Creator profile" },
      { href: DEMO_S1_BUYOUT_PATH, label: "Buyout watch" },
    ],
  },
  {
    title: "S1 Buyout",
    subtitle: "Prepared accepted offer, rage quit window, and claimable seeded holder context.",
    readiness: "OPERATOR_REQUIRED" as ProductReadinessStatus,
    boundary: "Offer creation, creator acceptance, graduation, and reclaim are still seed/operator-driven.",
    stage: "S1_BUYOUT" as const,
    creatorId: "luna-cai",
    primaryHref: DEMO_S1_BUYOUT_PATH,
    primaryLabel: "Open buyout",
    secondaryLinks: [
      { href: DEMO_S1_MARKET_PATH, label: "S1 market" },
      { href: PORTFOLIO_PATH, label: "Portfolio" },
    ],
  },
  {
    title: "S2 Workspace",
    subtitle: "Content manifest, proposal intent, bundle signing, and submit path are API/wallet-wired for seeded S2-ready creators.",
    readiness: "SEEDED_DEMO" as ProductReadinessStatus,
    boundary: "Endorsement and settlement links remain preview/operator surfaces until real burn, claim, and oracle flows are productized.",
    stage: "S2_ACTIVE" as const,
    creatorId: "neo-park",
    primaryHref: DEMO_S2_WORKSPACE_PATH,
    primaryLabel: "Open workspace",
    secondaryLinks: [
      { href: DEMO_S2_ENDORSE_PATH, label: "Endorse" },
      { href: DEMO_S2_SETTLEMENT_PATH, label: "Settlement" },
    ],
  },
];

export default function DemoHubPage() {
  const { t } = useI18n();

  return (
    <>
      <Head>
        <title>{t("page.demo.title")}</title>
      </Head>
      <PageShell>
        <div className="mx-auto max-w-6xl space-y-5">
          <ProductReadinessBanner
            description="This hub routes to controlled demo paths. S1 market and S2 launch rely on seeded/devnet readiness; S1 buyout formation is operator-prepared; S2 endorsement and settlement pages remain preview/operator surfaces."
            status="SEEDED_DEMO"
            title="Demo hub is a boundary map, not a production capability list"
          />

          <section className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(170deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] px-5 py-5 md:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#67b8ff]">
              Demo hub
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.04em] text-white md:text-3xl">
                  Controlled demo tracks
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8ea0ba]">
                  Fixed entry points for what can be shown today, with preview/operator boundaries kept visible.
                </p>
              </div>
              <div className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#9aabc4]">
                Boundary-first demo
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <BoundaryItem
              label="Live demo baseline"
              text="S1 buy/sell, S1 portfolio claim, and S2 proposal launch require seeded/devnet state plus backend and wallet readiness."
            />
            <BoundaryItem
              label="Operator prepared"
              text="S1 buyout offer, acceptance, graduation, Track1/2 settlement smoke, and seeded account setup still require scripts or operator action."
            />
            <BoundaryItem
              label="Preview only"
              text="Rewards missions, S2 fan endorsement, and Track3 merchant reconciliation are local/mock surfaces until real integrations land."
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {demoCards.map((card) => {
              const creator = findCreator(card.creatorId);

              return (
                <article
                  className="rounded-[16px] border border-white/[0.06] bg-white/[0.025] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                  key={card.title}
                >
                  <div className="flex items-start gap-3">
                    <img
                      alt=""
                      className="h-12 w-12 rounded-full border border-white/[0.08] object-cover"
                      src={creator.avatarSrc}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StagePill compact stage={card.stage} />
                      </div>
                      <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{card.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-[#8ea0ba]">{card.subtitle}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6f8099]">
                        Readiness
                      </span>
                      <ReadinessPill status={card.readiness} />
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#8ea0ba]">{card.boundary}</p>
                  </div>

                  <Link
                    className="mt-5 flex items-center justify-between rounded-xl bg-[linear-gradient(180deg,rgba(222,64,42,0.82)_0%,rgba(190,52,34,0.82)_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                    href={card.primaryHref}
                  >
                    <span>{card.primaryLabel}</span>
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.secondaryLinks.map((link) => (
                      <Link
                        className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
                        href={link.href}
                        key={link.href}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </PageShell>
    </>
  );
}

const BoundaryItem = ({ label, text }: { label: string; text: string }) => (
  <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67b8ff]">{label}</p>
    <p className="mt-2 text-[11px] leading-5 text-[#8ea0ba]">{text}</p>
  </div>
);

const READINESS_TONES: Record<ProductReadinessStatus, string> = {
  LIVE: "border-[#65ecaf]/25 bg-[#0e1f17]/60 text-[#8df0c4]",
  SEEDED_DEMO: "border-[#67b8ff]/25 bg-[#0d1b2a]/60 text-[#a8d8ff]",
  MOCK_PREVIEW: "border-[#f3b33e]/25 bg-[#1f1708]/60 text-[#f8d48a]",
  BACKEND_READY_UI_GAP: "border-[#b890ff]/25 bg-[#161225]/60 text-[#cdb5ff]",
  OPERATOR_REQUIRED: "border-[#de402a]/25 bg-[#24110d]/60 text-[#ff9a88]",
  NOT_STARTED: "border-white/[0.12] bg-white/[0.04] text-[#cbd6e7]",
};

const ReadinessPill = ({ status }: { status: ProductReadinessStatus }) => (
  <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold ${READINESS_TONES[status]}`}>
    {status}
  </span>
);
