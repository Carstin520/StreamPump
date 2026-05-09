import Link from "next/link";

import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { CreatorMarketRecord } from "@/lib/api/types";
import { compactNumber, formatUsd } from "@/lib/public-data";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";

export const TrendingCreatorCard = ({
  creator,
  priority = false,
}: {
  creator: CreatorMarketRecord;
  priority?: boolean;
}) => {
  const liveCreatorWallet = resolveCreatorWalletForRoute(creator.id);

  return (
    <Link className="block" href={liveCreatorWallet ? `/market/${liveCreatorWallet}` : `/creators/${creator.id}`}>
      <div className="glass-card card-radius group cursor-pointer overflow-hidden border-white/[0.06] bg-[#121826]">
        <div className="relative h-20 overflow-hidden">
          <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,transparent_0%,transparent_30%,rgba(18,24,38,0.4)_60%,#121826_100%)]" />
          <ProgressiveImage
            alt={creator.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 25vw"
            src={creator.heroSrc}
          />
          <div className="absolute left-3 top-3 z-[2]">
            <StagePill compact stage={creator.state} />
          </div>
          <div className="absolute right-3 top-3 z-[2] max-w-[50%] truncate rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
            {creator.niche}
          </div>
        </div>

        <div className="relative z-[2] -mt-3 px-3.5 pb-3.5 pt-0">
          <div className="mb-2 flex items-start justify-between">
            <div className="h-10 w-10 overflow-hidden rounded-[12px] border border-white/10 bg-[#0d1420] p-0.5 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
              <img
                alt={creator.name}
                className="h-full w-full rounded-[10px] object-cover"
                src={creator.avatarSrc}
              />
            </div>
            <p className="pt-2 text-[10px] text-[#90a0b9]">{creator.city}</p>
          </div>

          <div className="mb-0.5 min-w-0 space-y-0.5">
            <h3 className="truncate text-lg font-semibold tracking-[-0.04em] text-white">{creator.name}</h3>
            <p className="truncate text-xs text-[#93a4bc]">{creator.handle}</p>
          </div>

          <p className="mb-3 mt-2 truncate text-xs leading-5 text-[#d3dceb]">{creator.teaser}</p>

          <div className="grid grid-cols-2 gap-1.5">
            <Metric accent label="Current price" value={formatUsd(creator.tokenPrice)} />
            <Metric label="Holders" value={compactNumber(creator.holderCount)} />
            <Metric label="Pool" value={formatUsd(resolveSupporterPool(creator))} />
            <Metric label="Offer value" value={formatUsd(resolveOfferValue(creator))} />
          </div>
        </div>
      </div>
    </Link>
  );
};

const resolveSupporterPool = (creator: CreatorMarketRecord) => {
  if (creator.supporterDistributableUsd) return creator.supporterDistributableUsd;
  if (creator.valuationUsd) return Math.round(creator.valuationUsd * 0.74);
  return Math.round(creator.targetGraduationPrice * 14500);
};

const resolveOfferValue = (creator: CreatorMarketRecord) => {
  if (creator.buyoutOfferUsd) return creator.buyoutOfferUsd;
  if (creator.valuationUsd) return creator.valuationUsd;
  return Math.round(creator.targetGraduationPrice * 64500);
};

const Metric = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 backdrop-blur-md">
    <p className="truncate text-[9px] uppercase tracking-[0.16em] text-[#73849e]">{label}</p>
    <p className={`mt-1 truncate text-sm font-semibold ${accent ? "text-[#de402a]" : "text-white"}`}>{value}</p>
  </div>
);
