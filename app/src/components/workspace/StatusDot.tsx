export type StatusTone = "success" | "active" | "warning" | "error" | "muted" | "processing";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-[#65ecaf]",
  active: "bg-[#de402a]",
  warning: "bg-[#f3b33e]",
  error: "bg-[#f67263]",
  muted: "bg-[#4a5568]",
  processing: "bg-[#67b8ff]",
};

const PULSE_CLASSES: Record<StatusTone, string> = {
  success: "bg-[#65ecaf]/40",
  active: "bg-[#de402a]/40",
  warning: "bg-[#f3b33e]/40",
  error: "bg-[#f67263]/40",
  muted: "",
  processing: "bg-[#67b8ff]/40",
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
