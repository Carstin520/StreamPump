import { CreatorSeasonState } from "@/lib/mock-data";

type StageValue = CreatorSeasonState | "NONE";

const stageLabel: Record<Exclude<StageValue, "NONE">, string> = {
  S1_DISCOVERY: "S1",
  S1_BUYOUT: "S1 BUYOUT",
  S2_ACTIVE: "S2",
};

const stageTone: Record<Exclude<StageValue, "NONE">, string> = {
  S1_DISCOVERY: "border-white/10 bg-[#13291f]/80 text-[#90efac]",
  S1_BUYOUT: "border-white/10 bg-[#2d1621]/80 text-[#ff9fc4]",
  S2_ACTIVE: "border-white/10 bg-[#15263e]/80 text-[#93c8ff]",
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
