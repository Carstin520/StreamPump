import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import { SwitchAccountIcon } from "@/components/shared/AppIcons";
import { currentUser } from "@/lib/public-data";
import { PROFILE_PATH, buildLoginHref, isRouteActive, primaryNavItems } from "@/lib/routes";

export const UserShell = ({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) => {
  const router = useRouter();
  const switchAccountHref = buildLoginHref({
    nextPath: router.asPath,
    preview: "switch",
  });
  const profileActive = isRouteActive(router.asPath, {
    href: PROFILE_PATH,
    label: "Me",
    prefixes: [PROFILE_PATH],
  });

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#090d14] text-[#f5f7fb]">
      <AnimatedFeedBackdrop />

      <aside className="app-shell-frame fixed left-0 top-0 z-40 hidden h-[100dvh] w-16 border-r border-white/[0.05] bg-[#090d14]/90 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center justify-center border-b border-white/[0.05] lg:justify-start lg:px-6">
          <Link
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(222,64,42,0.32)]"
            href="/explore"
          >
            SP
          </Link>
          <span className="ml-3 hidden text-lg font-bold tracking-[-0.05em] text-white lg:block">
            StreamPump
          </span>
        </div>

        <nav className="flex-1 space-y-2 px-2 py-6 lg:px-4">
          {primaryNavItems.map((item) => (
            <Link
              className={`group flex h-12 items-center justify-center rounded-2xl px-3 text-sm transition duration-200 lg:justify-start ${
                isRouteActive(router.asPath, item)
                  ? "border border-white/10 bg-white/[0.08] text-white shadow-[0_14px_34px_rgba(0,0,0,0.14)]"
                  : "border border-transparent text-[#8f9eb7] hover:border-white/8 hover:bg-white/[0.05] hover:text-white"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/[0.05] p-2 lg:p-4">
          <Link href={PROFILE_PATH}>
            <div
              className={`surface-muted flex h-12 items-center justify-center rounded-2xl border px-1 transition duration-200 lg:h-auto lg:justify-start lg:px-3 lg:py-3 ${
                profileActive
                  ? "border-white/[0.12] bg-white/[0.08] text-white"
                  : "text-white/80 hover:bg-white/[0.07]"
              }`}
            >
              <img
                alt={currentUser.name}
                className="h-8 w-8 rounded-full object-cover"
                src={currentUser.avatarSrc}
              />
              <div className="ml-3 hidden min-w-0 lg:block">
                <p className="truncate text-sm font-medium text-white">{currentUser.name}</p>
                <p className="truncate text-xs text-[#8fa1bd]">{currentUser.handle}</p>
              </div>
            </div>
          </Link>

          <Link href={switchAccountHref}>
            <div className="surface-muted flex h-12 items-center justify-center rounded-2xl border px-1 text-white/80 transition duration-200 hover:bg-white/[0.07] lg:justify-start lg:px-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-[#9dadc6]">
                <SwitchAccountIcon className="h-4 w-4" />
              </span>
              <span className="ml-3 hidden text-sm font-medium text-white lg:block">切换账号</span>
            </div>
          </Link>
        </div>
      </aside>

      <div className="relative lg:ml-64">
        <div className="page-enter mx-auto max-w-[1440px] space-y-6 px-4 py-4 lg:px-6 lg:py-0">
          {header}
          {children}
        </div>
      </div>
    </main>
  );
};
