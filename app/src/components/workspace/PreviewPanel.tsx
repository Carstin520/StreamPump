import { ReactNode } from "react";

import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StatusDot, StatusTone } from "@/components/workspace/StatusDot";

export type HealthItem = {
  label: string;
  tone: StatusTone;
};

export const PreviewPanel = ({
  coverSrc,
  title,
  subtitle,
  tags,
  statusLabel,
  statusTone = "muted",
  children,
  className = "",
}: {
  coverSrc?: string;
  title?: string;
  subtitle?: string;
  tags?: string[];
  statusLabel?: string;
  statusTone?: StatusTone;
  children?: ReactNode;
  className?: string;
}) => {
  return (
    <aside className={`space-y-4 ${className}`}>
      <div className="liquid-card card-radius overflow-hidden">
        {coverSrc && (
          <div className="relative aspect-video overflow-hidden">
            <ProgressiveImage
              alt={title ?? "Preview"}
              className="h-full w-full object-cover"
              fill
              sizes="280px"
              src={coverSrc}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(8,17,28,0.6)_100%)]" />
          </div>
        )}
        <div className="p-4">
          {title && (
            <p className="line-clamp-2 text-sm font-medium text-white">{title}</p>
          )}
          {subtitle && (
            <p className="mt-1 line-clamp-2 text-xs text-[#8ea0ba]">{subtitle}</p>
          )}
          {tags && tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.slice(0, 5).map((tag) => (
                <span
                  className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-[#93a2bb]"
                  key={tag}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {statusLabel && (
            <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
              <StatusDot tone={statusTone} pulse={statusTone === "warning"} />
              <span className="text-xs text-[#93a2bb]">{statusLabel}</span>
            </div>
          )}
        </div>
      </div>
      {children}
    </aside>
  );
};

export const HealthChecklist = ({
  items,
}: {
  items: HealthItem[];
}) => (
  <div className="liquid-card card-radius p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">系统状态</p>
    <div className="mt-3 space-y-2.5">
      {items.map((item) => (
        <div className="flex items-center gap-2.5" key={item.label}>
          <StatusDot tone={item.tone} size="xs" />
          <span className="text-xs text-[#93a2bb]">{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);
