import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

import { currentUser } from "@/lib/mock-data";

const primaryNav = [
  { href: "/explore", label: "发现", match: ["/", "/explore", "/discover", "/posts"] },
  { href: "/trending", label: "Trending", match: ["/trending"] },
  { href: "/portfolio", label: "投资组合", match: ["/portfolio"] },
  { href: "/workspace", label: "创作中心", match: ["/workspace"] },
];

export const UserShell = ({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) => {
  const router = useRouter();

  const isActive = (href: string, match: string[]) =>
    match.some((prefix) => (prefix === "/" ? router.pathname === "/" || router.pathname === "/discover" : router.pathname.startsWith(prefix))) ||
    router.asPath === href;

  return (
    <main className="min-h-[100dvh] bg-[#090d14] text-[#f5f7fb]">
      <aside className="fixed left-0 top-0 z-40 hidden h-[100dvh] w-16 border-r border-white/[0.045] bg-[#090d14]/96 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center justify-center border-b border-white/[0.04] lg:justify-start lg:px-6">
          <Link
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold text-white"
            href="/explore"
          >
            SP
          </Link>
          <span className="ml-3 hidden font-['DM_Sans'] text-lg font-bold tracking-[-0.03em] text-white lg:block">
            StreamPump
          </span>
        </div>

        <nav className="flex-1 space-y-2 px-2 py-6 lg:px-4">
          {primaryNav.map((item) => (
            <Link
              className={`group flex h-12 items-center justify-center rounded-xl px-3 text-sm transition lg:justify-start ${
                isActive(item.href, item.match)
                  ? "bg-[#171f2d] text-white"
                  : "text-[#8f9eb7] hover:bg-[#141b27] hover:text-white"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/[0.04] p-2 lg:p-4">
          <Link href="/me">
            <div
              className={`flex h-12 items-center justify-center rounded-xl border px-1 transition lg:h-auto lg:justify-start lg:px-3 lg:py-3 ${
                router.pathname.startsWith("/me")
                  ? "border-white/[0.08] bg-[#171f2d] text-white"
                  : "border-white/[0.05] bg-[#111827] text-white/80 hover:bg-[#141b27]"
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
        </div>
      </aside>

      <div className="lg:ml-64">
        <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-0">
          {header}
          {children}
        </div>
      </div>
    </main>
  );
};
