type MomentumMeterTone = "momentum" | "graduation";

export const MomentumMeter = ({
  value,
  max = 100,
  tone = "momentum",
  label,
  valueText,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: MomentumMeterTone;
  label?: string;
  valueText?: string;
  className?: string;
}) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const displayPct = Math.round(pct);

  const fillStyle: React.CSSProperties =
    tone === "graduation"
      ? {
          background: "linear-gradient(90deg, var(--stage-s1) 0%, var(--stage-s2) 100%)",
          width: `${pct}%`,
        }
      : {
          background: "linear-gradient(90deg, var(--brand) 0%, var(--brand-strong) 100%)",
          width: `${pct}%`,
        };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label !== undefined || valueText !== undefined) && (
        <div className="flex items-center justify-between gap-2">
          {label !== undefined && (
            <span className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">{label}</span>
          )}
          {valueText !== undefined ? (
            <span className="text-[length:var(--fs-caption)] font-medium text-[color:var(--text-main)]">
              {valueText}
            </span>
          ) : (
            <span className="text-[length:var(--fs-caption)] font-medium text-[color:var(--text-main)]">
              {displayPct}%
            </span>
          )}
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-fluid)]"
          style={fillStyle}
        />
      </div>
    </div>
  );
};
