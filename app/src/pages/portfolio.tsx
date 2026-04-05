import Head from "next/head";
import Link from "next/link";

import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";
import { compactNumber, findCreator, formatUsd, portfolioActions, portfolioHoldings } from "@/lib/mock-data";

export default function PortfolioPage() {
  const totalExposure = portfolioHoldings.reduce((sum, holding) => {
    const creator = findCreator(holding.creatorId);
    return sum + creator.tokenPrice * holding.tokenCount;
  }, 0);

  return (
    <>
      <Head>
        <title>StreamPump | Portfolio</title>
      </Head>
      <UserShell
        header={
          <UserTopbar
            title="Your S1 exposure and next actions"
            subtitle="Manage your creator token holdings and upcoming claims."
          />
        }
      >
        <div className="space-y-5">
          <section className="rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,#0d1727_0%,#0b111d_100%)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.22em] text-[#6c7d97]">Portfolio overview</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Investment Cards</h1>

            <div className="mt-6 flex items-center gap-6 border-b border-white/8">
              {["Portfolio", "Claim queue", "Re-entry"].map((tab, index) => (
                <button
                  className={`relative pb-4 text-sm font-medium ${index === 0 ? "text-white" : "text-[#8798b2]"}`}
                  key={tab}
                  type="button"
                >
                  {tab}
                  {index === 0 ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#4d8fff]" /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <MetricCard glow="blue" label="Active holdings" value={String(portfolioHoldings.length)} />
            <MetricCard glow="green" label="Exposure value" value={formatUsd(totalExposure)} />
            <MetricCard glow="pink" label="Waiting actions" value={String(portfolioActions.length)} />
          </section>

          <section className="rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,#0d1624_0%,#0a1019_100%)] px-5 py-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                {portfolioHoldings.map((holding) => {
                  const creator = findCreator(holding.creatorId);

                  return (
                    <Link
                      className="block rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#10192a_0%,#0b111b_100%)] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                      href={`/creators/${creator.id}`}
                      key={holding.creatorId}
                    >
                      <div className="flex items-center gap-4">
                        <img alt={creator.name} className="h-14 w-14 rounded-xl border border-white/10 object-cover" src={creator.avatarSrc} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-white">{creator.name}</p>
                            <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#d8e1ee]">
                              {creator.state === "S1_DISCOVERY" ? "S1" : creator.state === "S1_BUYOUT" ? "S1 Buyout" : "S2"}
                            </span>
                          </div>
                          <p className="text-sm text-[#8ea0ba]">{holding.tokenCount} held</p>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-right">
                          <HoldingMetric label="Price" value={formatUsd(creator.tokenPrice)} />
                          <HoldingMetric label="Avg entry" value={formatUsd(holding.avgEntryUsd)} />
                          <HoldingMetric
                            highlight={holding.unrealizedChangePct >= 0 ? "green" : "pink"}
                            label="P/L"
                            value={`${holding.unrealizedChangePct > 0 ? "+" : ""}${holding.unrealizedChangePct.toFixed(1)}%`}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="space-y-4">
                {portfolioActions.map((card) => {
                  const creator = card.creatorId ? findCreator(card.creatorId) : null;
                  const toneClass =
                    card.tone === "buyout"
                      ? "from-[#3a1520] via-[#28131c] to-[#16121a]"
                      : card.tone === "opportunity"
                        ? "from-[#10253b] via-[#0f1d31] to-[#0b121c]"
                        : "from-[#121d2d] via-[#111827] to-[#0b111b]";
                  const buttonClass =
                    card.tone === "buyout"
                      ? "bg-[linear-gradient(90deg,#ff6b8b_0%,#ff476d_100%)] text-white"
                      : "bg-[linear-gradient(90deg,#3ea8ff_0%,#2795ff_100%)] text-[#04101b]";

                  return (
                    <div
                      className={`rounded-[24px] border border-white/8 bg-gradient-to-b ${toneClass} p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]`}
                      key={card.id}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7f90ab]">Pending action</p>
                      <h3 className="mt-3 text-[32px] font-semibold leading-10 text-white">{card.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#ced7e5]">{card.body}</p>

                      {creator ? (
                        <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-black/18 p-3">
                          <img alt={creator.name} className="h-10 w-10 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{creator.name}</p>
                            <p className="text-xs text-[#8ea0ba]">{compactNumber(creator.holderCount)} holders · {formatUsd(creator.tokenPrice)}</p>
                          </div>
                        </div>
                      ) : null}

                      {card.actionLabel ? (
                        <button className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-medium shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${buttonClass}`} type="button">
                          {card.actionLabel}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </UserShell>
    </>
  );
}

const MetricCard = ({
  label,
  value,
  glow,
}: {
  label: string;
  value: string;
  glow: "blue" | "green" | "pink";
}) => (
  <div
    className={`rounded-[20px] border bg-white/5 px-4 py-4 ${
      glow === "blue"
        ? "border-[#95bfff]/30 shadow-[0_0_22px_rgba(103,156,255,0.18)]"
        : glow === "green"
          ? "border-[#66f0b1]/28 shadow-[0_0_22px_rgba(58,223,138,0.18)]"
          : "border-[#ff8aa6]/28 shadow-[0_0_22px_rgba(255,91,133,0.18)]"
    }`}
  >
    <p className="text-xs uppercase tracking-[0.18em] text-[#6f8099]">{label}</p>
    <p className="mt-2 text-xl font-semibold text-white">{value}</p>
  </div>
);

const HoldingMetric = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "pink";
}) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">{label}</p>
    <p className={`mt-1 text-sm font-medium ${highlight === "green" ? "text-[#65ecaf]" : highlight === "pink" ? "text-[#ff8ca8]" : "text-white"}`}>{value}</p>
  </div>
);
