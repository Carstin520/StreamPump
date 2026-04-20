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
    <main className="relative min-h-[100dvh] bg-[#090d14] text-[#f5f7fb]">
      <AnimatedFeedBackdrop />

      <aside className="liquid-glass-shell fixed bottom-4 left-4 top-4 z-40 hidden w-16 lg:flex lg:w-[248px] lg:flex-col">
        <div className="flex h-20 items-center justify-center border-b border-white/[0.06] lg:justify-start lg:px-6">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold text-white shadow-[0_14px_34px_rgba(222,64,42,0.34)]"
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
              className="glass-nav-link group flex h-12 items-center justify-center px-3 text-sm transition duration-200 lg:justify-start"
              data-active={isRouteActive(router.asPath, item)}
              href={item.href}
              key={item.href}
            >
              <span className={`${isRouteActive(router.asPath, item) ? "text-white" : "text-[#8f9eb7]"} transition duration-200 group-hover:text-white`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] p-2 lg:p-4">
          <Link href={PROFILE_PATH}>
            <div
              className={`surface-muted flex h-12 items-center justify-center rounded-2xl border px-1 transition duration-200 lg:h-auto lg:justify-start lg:px-3 lg:py-3 ${
                profileActive
                  ? "border-white/[0.14] bg-white/[0.09] text-white"
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

      <div className="relative lg:ml-[280px]">
        <div className="page-enter mx-auto max-w-[1480px] space-y-6 px-4 py-4 lg:px-6 lg:py-0">
          {header}
          {children}
        </div>
      </div>
    </main>
  );
};
