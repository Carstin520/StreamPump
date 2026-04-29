import Link from "next/link";
import { ReactNode } from "react";

export type ActionCardTone = "default" | "urgent" | "success" | "info";

const TONE_RING: Record<ActionCardTone, string> = {
  default: "border-white/[0.08]",
  urgent: "border-[#f3b33e]/25 bg-[linear-gradient(180deg,rgba(77,49,20,0.12)_0%,rgba(18,21,32,0.6)_100%)]",
  success: "border-[#65ecaf]/20 bg-[linear-gradient(180deg,rgba(20,60,40,0.12)_0%,rgba(18,21,32,0.6)_100%)]",
  info: "border-[#67b8ff]/20 bg-[linear-gradient(180deg,rgba(20,40,70,0.12)_0%,rgba(18,21,32,0.6)_100%)]",
};

export const ActionCard = ({
  icon,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  tone = "default",
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref?: string;
  tone?: ActionCardTone;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const inner = (
    <div className={`liquid-card card-radius border p-4 transition hover:border-white/[0.14] ${TONE_RING[tone]} ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#93a2bb]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[#8ea0ba]">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
          tone === "urgent"
            ? "bg-[#f3b33e]/15 text-[#f3c66e]"
            : "bg-white/[0.06] text-[#cdd7e7]"
        }`}>
          {ctaLabel}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24">
            <path d="m9.5 6.5 5 5.5-5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </span>
      </div>
    </div>
  );

  if (disabled) {
    return inner;
  }

  if (ctaHref) {
    return <Link className="block" href={ctaHref}>{inner}</Link>;
  }

  if (onClick) {
    return <button className="block w-full text-left" onClick={onClick} type="button">{inner}</button>;
  }

  return inner;
};
