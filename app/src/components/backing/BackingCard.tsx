import Link from "next/link";
import type { CSSProperties } from "react";

import { MomentumMeter } from "@/components/shared/MomentumMeter";
import { StagePill } from "@/components/shared/StagePill";
import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

export type BackingCardProps = {
  variant?: "teaser" | "full";
  creatorName: string;
  creatorAvatarSrc?: string;
  stage: PostRecord["stage"];
  ctaHref: string;
  ctaLabel: string;
  note: string;
  readinessLabel?: string;
  momentum?: number;
  graduation?: number;
  className?: string;
};

const stageAccentStyle: Record<PostRecord["stage"], CSSProperties> = {
  NONE: {},
  S1_DISCOVERY: {
    background:
      "linear-gradient(160deg, color-mix(in srgb, var(--stage-s1) 10%, transparent), color-mix(in srgb, var(--stage-s1) 3%, transparent))",
    borderColor: "color-mix(in srgb, var(--stage-s1) 28%, transparent)",
  },
  S1_BUYOUT: {
    background:
      "linear-gradient(160deg, color-mix(in srgb, var(--stage-buyout) 12%, transparent), color-mix(in srgb, var(--stage-buyout) 3%, transparent))",
    borderColor: "color-mix(in srgb, var(--stage-buyout) 30%, transparent)",
  },
  S2_ACTIVE: {
    background:
      "linear-gradient(160deg, color-mix(in srgb, var(--stage-s2) 10%, transparent), color-mix(in srgb, var(--stage-s2) 3%, transparent))",
    borderColor: "color-mix(in srgb, var(--stage-s2) 28%, transparent)",
  },
};

export const BackingCard = ({
  variant = "teaser",
  creatorName,
  creatorAvatarSrc,
  stage,
  ctaHref,
  ctaLabel,
  note,
  readinessLabel,
  momentum,
  graduation,
  className = "",
}: BackingCardProps) => {
  const { t } = useI18n();
  const accentStyle = stage !== "NONE" ? stageAccentStyle[stage] : stageAccentStyle.S1_DISCOVERY;

  return (
    <div
      className={`rounded-[16px] border p-4 ${className}`}
      style={accentStyle}
    >
      {/* Creator row */}
      <div className="flex items-center gap-3">
        {creatorAvatarSrc ? (
          <img
            alt={creatorName}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
            src={creatorAvatarSrc}
          />
        ) : (
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)" }}
          >
            {creatorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{creatorName}</p>
          <div className="mt-0.5">
            <StagePill compact stage={stage} />
          </div>
        </div>
      </div>

      {/* Momentum meters — only when real numeric values are provided */}
      {variant === "full" && (momentum !== undefined || graduation !== undefined) ? (
        <div className="mt-3 flex flex-col gap-2">
          {momentum !== undefined ? (
            <MomentumMeter
              label={t("portfolio.momentum")}
              tone="momentum"
              value={momentum}
            />
          ) : null}
          {graduation !== undefined ? (
            <MomentumMeter
              label={t("portfolio.graduation")}
              tone="graduation"
              value={graduation}
            />
          ) : null}
        </div>
      ) : null}

      {/* CTA */}
      <Link
        className="mt-3 flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
        href={ctaHref}
        style={{
          background: "linear-gradient(180deg, var(--brand-strong, #f05540) 0%, var(--brand) 100%)",
          boxShadow: "0 10px 24px color-mix(in srgb, var(--brand) 28%, transparent)",
        }}
      >
        {ctaLabel}
      </Link>

      {/* Note */}
      <p
        className="mt-2 text-center text-[length:var(--fs-micro)] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {note}
      </p>

      {/* Readiness label */}
      {readinessLabel ? (
        <p
          className="mt-2 rounded-full border px-3 py-1 text-center text-[length:var(--fs-nano)]"
          style={{
            color: "color-mix(in srgb, var(--state-warning) 80%, var(--text-muted))",
            borderColor: "color-mix(in srgb, var(--state-warning) 26%, transparent)",
            background: "color-mix(in srgb, var(--state-warning) 10%, transparent)",
          }}
        >
          {readinessLabel}
        </p>
      ) : null}
    </div>
  );
};
