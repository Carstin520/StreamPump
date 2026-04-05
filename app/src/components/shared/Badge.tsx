type BadgeTone = "neutral" | "warm" | "success" | "alert";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-white/10 text-slate-100 ring-1 ring-white/15",
  warm: "bg-amber-300/15 text-amber-100 ring-1 ring-amber-200/20",
  success: "bg-emerald-300/15 text-emerald-100 ring-1 ring-emerald-200/20",
  alert: "bg-rose-300/15 text-rose-100 ring-1 ring-rose-200/20",
};

export const Badge = ({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) => <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${toneClasses[tone]}`}>{label}</span>;
