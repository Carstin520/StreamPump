import { useI18n } from "@/lib/i18n";

export type ProductReadinessStatus =
  | "LIVE"
  | "SEEDED_DEMO"
  | "MOCK_PREVIEW"
  | "BACKEND_READY_UI_GAP"
  | "OPERATOR_REQUIRED"
  | "NOT_STARTED";

type ProductReadinessBannerProps = {
  description: string;
  status: ProductReadinessStatus;
  title: string;
};

// Readiness statuses map onto the semantic state palette; OPERATOR_REQUIRED is
// decoupled from brand red and now reads as --state-danger.
const STATUS_TONES: Record<ProductReadinessStatus, string> = {
  LIVE: "tone-state-success",
  SEEDED_DEMO: "tone-state-info",
  MOCK_PREVIEW: "tone-state-warning",
  BACKEND_READY_UI_GAP: "tone-state-pending",
  OPERATOR_REQUIRED: "tone-state-danger",
  NOT_STARTED: "tone-state-neutral",
};

export function ProductReadinessBanner({ description, status, title }: ProductReadinessBannerProps) {
  const { t } = useI18n();
  const showBanner = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS === "1";

  if (!showBanner) {
    return null;
  }

  return (
    <aside
      aria-label="Product readiness"
      className="rounded-[14px] border border-white/[0.07] bg-[linear-gradient(160deg,rgba(15,21,32,0.88)_0%,rgba(10,15,23,0.88)_100%)] px-4 py-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.2em] text-[#6f8099]">{t("readiness.phaseLabel")}</p>
          <p className="mt-1 text-[length:var(--fs-caption)] font-semibold text-white">{title}</p>
          <p className="mt-1 text-[length:var(--fs-micro)] leading-5 text-[#9aabc4]">{description}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[length:var(--fs-micro)] font-semibold ${STATUS_TONES[status]}`}>
          {status}
        </span>
      </div>
    </aside>
  );
}
