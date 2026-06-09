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

const STATUS_TONES: Record<ProductReadinessStatus, string> = {
  LIVE: "border-[#65ecaf]/25 bg-[#0e1f17]/60 text-[#8df0c4]",
  SEEDED_DEMO: "border-[#67b8ff]/25 bg-[#0d1b2a]/60 text-[#a8d8ff]",
  MOCK_PREVIEW: "border-[#f3b33e]/25 bg-[#1f1708]/60 text-[#f8d48a]",
  BACKEND_READY_UI_GAP: "border-[#b890ff]/25 bg-[#161225]/60 text-[#cdb5ff]",
  OPERATOR_REQUIRED: "border-[#de402a]/25 bg-[#24110d]/60 text-[#ff9a88]",
  NOT_STARTED: "border-white/[0.12] bg-white/[0.04] text-[#cbd6e7]",
};

export function ProductReadinessBanner({ description, status, title }: ProductReadinessBannerProps) {
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6f8099]">Phase 0 readiness</p>
          <p className="mt-1 text-[13px] font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#9aabc4]">{description}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${STATUS_TONES[status]}`}>
          {status}
        </span>
      </div>
    </aside>
  );
}
