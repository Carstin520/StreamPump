export type StatusTone = "success" | "active" | "warning" | "error" | "muted" | "processing";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-[var(--state-success)]",
  active: "bg-[var(--brand)]",
  warning: "bg-[var(--state-warning)]",
  error: "bg-[var(--state-danger)]",
  muted: "bg-[#4a5568]",
  processing: "bg-[var(--state-info)]",
};

const PULSE_CLASSES: Record<StatusTone, string> = {
  success: "bg-[color:color-mix(in_srgb,var(--state-success)_40%,transparent)]",
  active: "bg-[color:color-mix(in_srgb,var(--brand)_40%,transparent)]",
  warning: "bg-[color:color-mix(in_srgb,var(--state-warning)_40%,transparent)]",
  error: "bg-[color:color-mix(in_srgb,var(--state-danger)_40%,transparent)]",
  muted: "",
  processing: "bg-[color:color-mix(in_srgb,var(--state-info)_40%,transparent)]",
};

export const StatusDot = ({
  tone,
  pulse = false,
  size = "sm",
  className = "",
}: {
  tone: StatusTone;
  pulse?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}) => {
  const sizeClass = size === "xs" ? "h-1.5 w-1.5" : size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const pulseSize = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {pulse && tone !== "muted" && (
        <span className={`absolute ${pulseSize} animate-ping rounded-full ${PULSE_CLASSES[tone]} opacity-75`} />
      )}
      <span className={`relative rounded-full ${sizeClass} ${TONE_CLASSES[tone]}`} />
    </span>
  );
};
