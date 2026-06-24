import { compactNumber } from "@/lib/public-data";

type EnergyAmountSize = "sm" | "md" | "lg";

const sizeClass: Record<EnergyAmountSize, string> = {
  sm: "text-[length:var(--fs-caption)]",
  md: "text-[length:var(--fs-sm)]",
  lg: "text-[length:var(--fs-title)]",
};

export const EnergyAmount = ({
  amount,
  size = "md",
  muted = false,
  className = "",
}: {
  amount: number;
  size?: EnergyAmountSize;
  muted?: boolean;
  className?: string;
}) => {
  const colorStyle = muted
    ? { color: "color-mix(in srgb, var(--energy) 50%, var(--text-muted))" }
    : { color: "var(--energy)" };

  return (
    <span
      className={`inline-flex items-baseline gap-0.5 font-semibold tabular-nums ${sizeClass[size]} ${className}`}
      style={colorStyle}
    >
      <span>⚡</span>
      <span>{compactNumber(amount)}</span>
    </span>
  );
};
