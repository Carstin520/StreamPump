import Link from "next/link";

import { compactNumber, CreatorMarketRecord, formatUsd } from "@/lib/mock-data";

const stateTone: Record<CreatorMarketRecord["state"], string> = {
  S1_DISCOVERY: "bg-[#13291f] text-[#82f1a1]",
  S1_BUYOUT: "bg-[#2a1b1b] text-[#ff8a8a]",
  S2_ACTIVE: "bg-[#142233] text-[#8cc6ff]",
};

export const TrendingCreatorCard = ({ creator }: { creator: CreatorMarketRecord }) => (
  <Link className="mb-4 inline-block w-full break-inside-avoid rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,#0f1725_0%,#0b111b_100%)] p-2 transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(0,0,0,0.3)]" href={`/creators/${creator.id}`}>
    <div className="relative overflow-hidden rounded-[18px]">
      <img
        alt={creator.name}
        className="h-[220px] w-full object-cover"
        src={creator.heroSrc}
      />
      <div className="absolute left-4 top-4">
        <span className={`rounded-full px-3 py-1 text-[11px] font-medium shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${stateTone[creator.state]}`}>
          {creator.state === "S1_DISCOVERY" ? "S1" : creator.state === "S1_BUYOUT" ? "S1 Buyout" : "S2"}
        </span>
      </div>
    </div>

    <div className="px-3 pb-3 pt-4">
      <div className="flex items-start gap-3">
        <img
          alt={creator.name}
          className="mt-0.5 h-11 w-11 rounded-full border border-white/10 object-cover"
          src={creator.avatarSrc}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.22em] text-[#6f7f98]">{creator.niche}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{creator.name}</h3>
          <p className="mt-1 text-sm text-[#9eb0c8]">{creator.handle} · {creator.city}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[#d4dcea]">{creator.teaser}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
      <Metric label="Current price" value={formatUsd(creator.tokenPrice)} />
      <Metric label="Holders" value={compactNumber(creator.holderCount)} />
      {creator.state === "S1_DISCOVERY" ? (
        <>
          <Metric label="Graduation" value={`${creator.graduationProgress}%`} />
          <Metric label="Target price" value={formatUsd(creator.targetGraduationPrice)} />
        </>
      ) : null}
      {creator.state === "S1_BUYOUT" ? (
        <>
          <Metric label="Supporter pool" value={formatUsd(creator.supporterDistributableUsd ?? 0)} />
          <Metric label="Offer value" value={formatUsd(creator.buyoutOfferUsd ?? 0)} />
        </>
      ) : null}
      {creator.state === "S2_ACTIVE" ? (
        <>
          <Metric label="Activity" value={String(creator.activityScore ?? 0)} />
          <Metric label="Valuation" value={formatUsd(creator.valuationUsd ?? 0)} />
        </>
      ) : null}
      </div>

      {creator.state === "S1_DISCOVERY" ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[#7b8ca5]">
            <span>Graduation pressure</span>
            <span>{creator.graduationProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ff6a5e] to-[#ffaf6d]" style={{ width: `${creator.graduationProgress}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  </Link>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-white/5 p-4">
    <p className="text-xs uppercase tracking-[0.18em] text-[#6e7e98]">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </div>
);
