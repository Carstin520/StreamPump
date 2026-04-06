import Link from "next/link";
import { ReactNode } from "react";
import { useRouter } from "next/router";

import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";

const tabs = [
  { href: "/workspace", label: "Overview" },
  { href: "/workspace/content/new", label: "Create Content" },
  { href: "/workspace/intents/intent-luna-radiantlab", label: "Launch Intent" },
];

export const WorkspaceShell = ({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) => {
  const router = useRouter();

  return (
    <UserShell header={<UserTopbar searchPlaceholder="搜索内容包、launch、品牌合作" />}>
      <div className="space-y-6 py-4">
        <section className="liquid-panel rounded-[34px] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7486a1]">Workspace</p>
              <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] text-white">{title}</h1>
              <p className="mt-4 text-sm leading-7 text-[#95a6bf]">{subtitle}</p>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = router.asPath === tab.href;

              return (
                <Link
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-white text-[#08101a]"
                      : "liquid-pill text-white hover:bg-white/10"
                  }`}
                  href={tab.href}
                  key={tab.href}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </section>

        {children}
      </div>
    </UserShell>
  );
};
