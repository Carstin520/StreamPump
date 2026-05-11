import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

import { UserShell } from "@/components/user/UserShell";
import { UserTopbar, type TopbarMode } from "@/components/user/UserTopbar";
import { RouteItem, isRouteActive } from "@/lib/routes";

type PageShellProps = {
  action?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  hideSearch?: boolean;
  hideTopbar?: boolean;
  searchPlaceholder?: string;
  subtitle?: string;
  tabs?: RouteItem[];
  title?: string;
  topbarMode?: TopbarMode;
};

export const PageShell = ({
  action,
  children,
  eyebrow = "StreamPump",
  hideSearch,
  hideTopbar,
  searchPlaceholder,
  subtitle,
  tabs,
  title,
  topbarMode = "sticky",
}: PageShellProps) => {
  const router = useRouter();
  const showHeaderCard = Boolean(title || subtitle || action || tabs?.length);

  return (
    <UserShell header={hideTopbar ? undefined : <UserTopbar hideSearch={hideSearch} mode={topbarMode} searchPlaceholder={searchPlaceholder} />}>
      <div className="space-y-6 py-4">
        {showHeaderCard ? (
          <section className="liquid-glass-shell hero-glow section-enter relative p-6 md:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
            {title || subtitle || action ? (
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#7486a1]">{eyebrow}</p>
                  {title ? (
                    <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.06em] text-white md:text-[46px]">
                      {title}
                    </h1>
                  ) : null}
                  {subtitle ? (
                    <p className="mt-4 text-sm leading-7 text-[#95a6bf]">{subtitle}</p>
                  ) : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
              </div>
            ) : null}

            {tabs?.length ? (
              <div className={`${title || subtitle || action ? "mt-7" : "relative"} flex flex-wrap gap-2`}>
                {tabs.map((tab) => {
                  const active = isRouteActive(router.asPath, tab);

                  return (
                    <Link
                      className={`rounded-full px-4 py-2 text-sm transition duration-200 ${
                        active
                          ? "glass-button-primary text-white"
                          : "liquid-pill text-white hover:scale-[1.02] hover:bg-white/10"
                      }`}
                      href={tab.href}
                      key={tab.href}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="section-enter">{children}</div>
      </div>
    </UserShell>
  );
};
