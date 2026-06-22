import { InfluenceRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

export const InfluenceChip = ({ influence }: { influence: InfluenceRecord }) => {
  const { t, locale } = useI18n();
  const tierLabel = locale === "zh" ? influence.scoutTierLabel.zh : influence.scoutTierLabel.en;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[#67b8ff]/20 bg-[#67b8ff]/8 px-2.5 py-1"
      title={t("influence.chipTooltip")}
    >
      <span className="text-[length:var(--fs-micro)] font-bold text-[#67b8ff]">Lv{influence.level}</span>
      <span className="text-[length:var(--fs-micro)] text-[#67b8ff]/50">·</span>
      <span className="text-[length:var(--fs-micro)] font-medium text-[#8ec8ff]">{tierLabel}</span>
    </span>
  );
};

export const InfluenceChipSkeleton = () => (
  <span className="inline-block h-6 w-24 animate-pulse rounded-full bg-white/[0.06]" />
);
