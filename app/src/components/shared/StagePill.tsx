import { CreatorSeasonState } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

type StageValue = CreatorSeasonState | "NONE";

const stageLabel: Record<Exclude<StageValue, "NONE">, string> = {
  S1_DISCOVERY: "S1",
  S1_BUYOUT: "S1 BUYOUT",
  S2_ACTIVE: "S2",
};

const stageTone: Record<Exclude<StageValue, "NONE">, string> = {
  S1_DISCOVERY: "tone-stage-s1",
  S1_BUYOUT: "tone-stage-buyout",
  S2_ACTIVE: "tone-stage-s2",
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
  const { t } = useI18n();

  if (stage === "NONE") {
    return null;
  }

  const label = stage === "S1_BUYOUT" ? t("stage.s1Buyout") : stageLabel[stage];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur-md ${
        compact ? "text-[length:var(--fs-nano)]" : "text-[length:var(--fs-micro)]"
      } ${stageTone[stage]} ${className}`}
    >
      {label}
    </span>
  );
};
