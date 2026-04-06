import Link from "next/link";

import { compactNumber, CreatorMarketRecord, formatUsd } from "@/lib/mock-data";

const stateTone: Record<CreatorMarketRecord["state"], string> = {
  S1_DISCOVERY: "bg-[#13291f]/80 text-[#90efac]",
  S1_BUYOUT: "bg-[#2d1621]/80 text-[#ff9fc4]",
  S2_ACTIVE: "bg-[#15263e]/80 text-[#93c8ff]",
};

export const TrendingCreatorCard = ({ creator }: { creator: CreatorMarketRecord }) => (
  <Link className="block" href={`/creators/${creator.id}`}>
    <div className="glass-card group cursor-pointer">
      <div className="relative h-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#08101a] via-transparent to-transparent z-[1]" />
        <img
          alt={creator.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          src={creator.heroSrc}
        />
        <div className="absolute left-4 top-4 z-[2]">
          <span
            className={`liquid-pill rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${stateTone[creator.state]}`}
          >
            {creator.state === "S1_DISCOVERY" ? "S1" : creator.state === "S1_BUYOUT" ? "S1 Buyout" : "S2"}
          </span>
        </div>
        <div className="absolute right-4 top-4 z-[2] rounded-full border border-white/10 bg-black/28 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/82 backdrop-blur-md">
          {creator.niche}
        </div>
      </div>

      <div className="relative z-[2] px-4 pb-4 pt-0">
        <div className="-mt-7 mb-3 flex items-end justify-between">
          <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1420] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.34)]">
            <img
              alt={creator.name}
              className="h-full w-full rounded-xl object-cover"
              src={creator.avatarSrc}
            />
          </div>
          <p className="pb-1 text-xs text-[#90a0b9]">{creator.city}</p>
        </div>

        <div className="mb-1">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{creator.name}</h3>
          <p className="mt-1 text-sm text-[#93a4bc]">{creator.handle}</p>
        </div>

        <p className="mb-4 mt-3 line-clamp-2 text-sm leading-6 text-[#d3dceb]">{creator.teaser}</p>

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Price" value={formatUsd(creator.tokenPrice)} />
          <Metric label="Holders" value={compactNumber(creator.holderCount)} />
          {creator.state === "S1_DISCOVERY" ? (
            <>
              <Metric label="Graduation" value={`${creator.graduationProgress}%`} />
              <Metric label="Target" value={formatUsd(creator.targetGraduationPrice)} />
            </>
          ) : null}
          {creator.state === "S1_BUYOUT" ? (
            <>
              <Metric label="Pool" value={formatUsd(creator.supporterDistributableUsd ?? 0)} />
              <Metric label="Offer" value={formatUsd(creator.buyoutOfferUsd ?? 0)} />
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
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[#7d8ea7]">
              <span>Graduation pressure</span>
              <span>{creator.graduationProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff6f90] via-[#8c86ff] to-[#71b8ff]"
                style={{ width: `${creator.graduationProgress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  </Link>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3.5">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#73849e]">{label}</p>
    <p className="mt-2 text-base font-semibold text-white">{value}</p>
  </div>
);
