import { ReactNode } from "react";

import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";

export const AppShell = ({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <UserShell header={<UserTopbar searchPlaceholder="搜索页面、活动、帖子" />}>
    <div className="space-y-6 py-4">
      <section className="liquid-panel section-enter relative overflow-hidden rounded-[34px] p-6 md:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-[#7486a1]">StreamPump</p>
            <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] text-white">{title}</h1>
            <p className="mt-4 text-sm leading-7 text-[#95a6bf]">{subtitle}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </section>

      <div className="section-enter">{children}</div>
    </div>
  </UserShell>
);
