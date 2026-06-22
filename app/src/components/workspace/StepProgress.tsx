export type StepStatus = "done" | "current" | "blocked" | "pending";

export type StepItem = {
  label: string;
  status: StepStatus;
};

const STATUS_DOT: Record<StepStatus, string> = {
  done: "border-[#65ecaf] bg-[#65ecaf]",
  current: "border-[#de402a] bg-[#de402a] shadow-[0_0_12px_rgba(222,64,42,0.4)]",
  blocked: "border-[#f3b33e] bg-[#f3b33e]",
  pending: "border-[#3a4556] bg-[#1a2231]",
};

const STATUS_LABEL: Record<StepStatus, string> = {
  done: "text-[#65ecaf]",
  current: "text-white font-semibold",
  blocked: "text-[#f3b33e]",
  pending: "text-[#5a6b82]",
};

const STATUS_LINE: Record<StepStatus, string> = {
  done: "bg-[#65ecaf]/60",
  current: "bg-[#de402a]/40",
  blocked: "bg-[#f3b33e]/30",
  pending: "bg-[#2a3444]",
};

export const StepProgress = ({
  steps,
  compact = false,
  className = "",
}: {
  steps: StepItem[];
  compact?: boolean;
  className?: string;
}) => {
  return (
    <div className={`flex items-start overflow-x-auto scrollbar-none ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const lineStatus = step.status === "done" ? "done" : "pending";

        return (
          <div
            className={`flex items-start ${isLast ? "" : "flex-1"}`}
            key={`${step.label}-${index}`}
          >
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center rounded-full border-2 ${STATUS_DOT[step.status]} ${compact ? "h-3 w-3" : "h-4 w-4"}`}>
                {step.status === "done" && !compact && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24">
                    <path d="m5 13 4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  </svg>
                )}
              </div>
              <span className={`mt-1.5 whitespace-nowrap text-center ${compact ? "text-[length:var(--fs-micro)]" : "text-[length:var(--fs-micro)]"} leading-tight ${STATUS_LABEL[step.status]}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-1 mt-[7px] h-[2px] flex-1 rounded-full ${compact ? "mt-[5px]" : ""} ${STATUS_LINE[lineStatus]}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};
