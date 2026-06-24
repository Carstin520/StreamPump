export const ScarcityBar = ({
  claimed,
  total,
  label,
  tailText,
  className = "",
}: {
  claimed: number;
  total: number;
  label: string;
  tailText?: string;
  className?: string;
}) => {
  const pct = total > 0 ? Math.min((claimed / total) * 100, 100) : 0;
  const displayPct = Math.round(pct);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">{label}</span>
        <span className="text-[length:var(--fs-caption)] font-medium tabular-nums text-[color:var(--text-main)]">
          {displayPct}%{tailText !== undefined && <span className="ml-1 text-[color:var(--text-faint)]">{tailText}</span>}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-fluid)]"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--brand) 0%, var(--brand-strong) 100%)",
          }}
        />
      </div>
    </div>
  );
};
