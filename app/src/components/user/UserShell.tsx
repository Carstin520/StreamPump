import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

import { currentUser } from "@/lib/mock-data";

const primaryNav = [
  { href: "/explore", label: "发现", match: ["/", "/explore", "/discover", "/posts"] },
  { href: "/trending", label: "Trending", match: ["/trending"] },
  { href: "/portfolio", label: "投资组合", match: ["/portfolio"] },
  { href: "/workspace", label: "创作中心", match: ["/workspace"] },
  { href: "/me", label: "我", match: ["/me"] },
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
    match.some((prefix) => (prefix === "/" ? router.pathname === "/" || router.pathname === "/discover" : router.pathname.startsWith(prefix))) || router.asPath === href;

  return (
    <main className="min-h-screen bg-[#090d14] text-[#f5f7fb]">
      <div className="mx-auto grid min-h-screen max-w-[1540px] grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[168px_minmax(0,1fr)]">
        <aside className="hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,#0d1420_0%,#0a111b_100%)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.3)] lg:flex lg:flex-col">
          <Link
            className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,#243a64_0%,#172740_100%)] text-2xl font-semibold text-[#d8ecff] shadow-[0_18px_40px_rgba(32,80,162,0.24)]"
            href="/explore"
          >
            SP
          </Link>
          <nav className="space-y-2.5">
            {primaryNav.map((item) => (
              <Link
                className={`block rounded-[18px] px-4 py-3 text-[15px] transition ${
                  isActive(item.href, item.match)
                    ? "border border-white/8 bg-[#182336] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border border-transparent text-[#92a0b9] hover:border-white/6 hover:bg-white/4 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,#101726_0%,#0b121b_100%)] p-4 backdrop-blur">
            <p className="text-[11px] tracking-[0.24em] text-[#7385a3]">SESSION</p>
            <div className="mt-3 flex items-center gap-3">
              <img
                alt={currentUser.name}
                className="h-10 w-10 rounded-full border border-white/12 object-cover"
                src={currentUser.avatarSrc}
              />
              <div>
                <p className="text-sm font-medium text-white">{currentUser.name}</p>
                <p className="text-xs text-[#8fa1bd]">{currentUser.handle}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#8d9cb3]">{currentUser.sessionMode}</p>
          </div>
        </aside>

        <div className="space-y-5">
          {header}
          {children}
        </div>
      </div>
    </main>
  );
};
