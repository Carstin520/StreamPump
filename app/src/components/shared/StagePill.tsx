import { CreatorSeasonState } from "@/lib/api/types";

type StageValue = CreatorSeasonState | "NONE";

const stageLabel: Record<Exclude<StageValue, "NONE">, string> = {
  S1_DISCOVERY: "S1",
  S1_BUYOUT: "S1 BUYOUT",
  S2_ACTIVE: "S2",
};

const stageTone: Record<Exclude<StageValue, "NONE">, string> = {
  S1_DISCOVERY: "border-[#67b8ff]/25 bg-[#0e1726]/80 text-[#8ad0ff]",
  S1_BUYOUT: "border-[#de402a]/30 bg-[#1f120e]/80 text-[#ff8a78]",
  S2_ACTIVE: "border-[#65ecaf]/25 bg-[#0e1f17]/80 text-[#8df0c4]",
};

export const StagePill = ({
  stage,
  compact = false,
  className = "",
}: {
  stage: StageValue;
  compact?: boolean;
  className?: string;
}) => {
  if (stage === "NONE") {
    return null;
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur-md ${
        compact ? "text-[9px]" : "text-[10px]"
      } ${stageTone[stage]} ${className}`}
    >
      {stageLabel[stage]}
    </span>
  );
};
