import { DemoActionState } from "@/hooks/useDemoActionFlow";

type DemoActionStatusCardProps = {
  amountLabel?: string;
  confirmLabel: string;
  description: string;
  state: DemoActionState;
  successLabel: string;
  title: string;
  onCancel: () => void;
  onConfirm: (options?: { fail?: boolean }) => void;
  onRetry: () => void;
};

export function DemoActionStatusCard({
  amountLabel,
  confirmLabel,
  description,
  state,
  successLabel,
  title,
  onCancel,
  onConfirm,
  onRetry,
}: DemoActionStatusCardProps) {
  if (state.status === "idle") return null;

  return (
    <div className="mt-3 rounded-[14px] border border-white/[0.07] bg-white/[0.025] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0ba]">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#cbd6e7]">{description}</p>
          {amountLabel ? (
            <p className="mt-1 font-mono text-[11px] text-[#67b8ff]">{amountLabel}</p>
          ) : null}
        </div>
        {state.status === "submitted" ? (
          <span className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
        ) : null}
      </div>

      {state.status === "confirming" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-full bg-[#de402a] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#ea523e]"
            onClick={() => onConfirm()}
            type="button"
          >
            {confirmLabel}
          </button>
          <button
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-medium text-[#cbd6e7] transition hover:text-white"
            onClick={() => onConfirm({ fail: true })}
            type="button"
          >
            Simulate failure
          </button>
          <button
            className="rounded-full px-3 py-2 text-[11px] font-medium text-[#7e90aa] transition hover:text-white"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {state.status === "submitted" ? (
        <p className="mt-3 text-[12px] font-medium text-[#f3b33e]">Submitting...</p>
      ) : null}

      {state.status === "success" ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-[#65ecaf]">{successLabel}</p>
          <button
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] font-medium text-[#cbd6e7] transition hover:text-white"
            onClick={onCancel}
            type="button"
          >
            Done
          </button>
        </div>
      ) : null}

      {state.status === "failed" ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-[240px] text-[12px] text-[#ff8a78]">
            {state.error ?? "Demo action failed."}
          </p>
          <button
            className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/15"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
