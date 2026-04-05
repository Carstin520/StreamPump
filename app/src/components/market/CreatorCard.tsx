import Link from "next/link";

import { CreatorMarketRecord, formatUsd } from "@/lib/mock-data";
import { Badge } from "@/components/shared/Badge";
import { Panel } from "@/components/shared/Panel";

export const CreatorCard = ({ creator }: { creator: CreatorMarketRecord }) => (
  <Panel className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{creator.niche}</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{creator.name}</h3>
        <p className="text-sm text-slate-300">{creator.handle}</p>
      </div>
      <Badge
        label={creator.state === "S1_DISCOVERY" ? "S1 discovery" : creator.state === "S1_BUYOUT" ? "Buyout live" : "S2 active"}
        tone={creator.state === "S2_ACTIVE" ? "success" : "warm"}
      />
    </div>

    <p className="text-sm leading-6 text-slate-300">{creator.teaser}</p>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-white/5 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Creator token</p>
        <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(creator.tokenPrice)}</p>
      </div>
      <div className="rounded-2xl bg-white/5 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Momentum</p>
        <p className="mt-2 text-2xl font-semibold text-white">{creator.momentumScore}</p>
      </div>
    </div>

    <div>
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
        <span>Graduation pressure</span>
        <span>{creator.graduationProgress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" style={{ width: `${creator.graduationProgress}%` }} />
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      {creator.tags.map((tag) => (
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300" key={tag}>
          {tag}
        </span>
      ))}
    </div>

    <div className="flex items-center justify-between border-t border-white/8 pt-4">
      <p className="text-xs text-slate-400">{creator.buyoutStatus}</p>
      <Link className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" href={`/creators/${creator.id}`}>
        View market
      </Link>
    </div>
  </Panel>
);
