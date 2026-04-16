"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendingCreatorCard = void 0;
const link_1 = __importDefault(require("next/link"));
const StagePill_1 = require("@/components/shared/StagePill");
const utils_1 = require("@/lib/mocks/utils");
const TrendingCreatorCard = ({ creator }) => (<link_1.default className="block" href={`/creators/${creator.id}`}>
    <div className="card-radius group cursor-pointer overflow-hidden border border-white/[0.06] bg-[#121826] shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-white/[0.1]">
      <div className="relative h-24 overflow-hidden">
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#121826] via-transparent to-transparent"/>
        <img alt={creator.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" src={creator.heroSrc}/>
        <div className="absolute left-4 top-4 z-[2]">
          <StagePill_1.StagePill compact stage={creator.state}/>
        </div>
        <div className="absolute right-4 top-4 z-[2] rounded-full border border-white/10 bg-black/24 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/82 backdrop-blur-md">
          {creator.niche}
        </div>
      </div>

      <div className="relative z-[2] -mt-3 px-4 pb-4 pt-0">
        <div className="mb-3 flex items-start justify-between">
          <div className="h-12 w-12 overflow-hidden rounded-[14px] border border-white/10 bg-[#0d1420] p-0.5 shadow-[0_16px_34px_rgba(0,0,0,0.26)]">
            <img alt={creator.name} className="h-full w-full rounded-[12px] object-cover" src={creator.avatarSrc}/>
          </div>
          <p className="pt-3 text-xs text-[#90a0b9]">{creator.city}</p>
        </div>

        <div className="mb-1 space-y-1">
          <h3 className="text-2xl font-semibold tracking-[-0.05em] text-white">{creator.name}</h3>
          <p className="text-sm text-[#93a4bc]">{creator.handle}</p>
        </div>

        <p className="mb-4 mt-3 line-clamp-2 text-sm leading-6 text-[#d3dceb]">{creator.teaser}</p>

        <div className="grid grid-cols-2 gap-2">
          <Metric accent label="Current price" value={(0, utils_1.formatUsd)(creator.tokenPrice)}/>
          <Metric label="Holders" value={(0, utils_1.compactNumber)(creator.holderCount)}/>
          <Metric label="Supporter pool" value={(0, utils_1.formatUsd)(resolveSupporterPool(creator))}/>
          <Metric label="Offer value" value={(0, utils_1.formatUsd)(resolveOfferValue(creator))}/>
        </div>
      </div>
    </div>
  </link_1.default>);
exports.TrendingCreatorCard = TrendingCreatorCard;
const resolveSupporterPool = (creator) => {
    if (creator.supporterDistributableUsd)
        return creator.supporterDistributableUsd;
    if (creator.valuationUsd)
        return Math.round(creator.valuationUsd * 0.74);
    return Math.round(creator.targetGraduationPrice * 14500);
};
const resolveOfferValue = (creator) => {
    if (creator.buyoutOfferUsd)
        return creator.buyoutOfferUsd;
    if (creator.valuationUsd)
        return creator.valuationUsd;
    return Math.round(creator.targetGraduationPrice * 64500);
};
const Metric = ({ label, value, accent = false }) => (<div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] p-3">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#73849e]">{label}</p>
    <p className={`mt-2 text-base font-semibold ${accent ? "text-[#de402a]" : "text-white"}`}>{value}</p>
  </div>);
