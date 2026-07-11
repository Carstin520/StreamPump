import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import { SettingsMenu } from "@/components/shared/SettingsMenu";
import { shortenWalletLabel, useSessionIdentity } from "@/hooks/useSessionIdentity";
import { useI18n } from "@/lib/i18n";
import {
  ACTIVITY_PATH,
  EXPLORE_PATH,
  PROFILE_PATH,
  TRENDING_PATH,
  WORKSPACE_PATH,
  buildLoginHref,
  isRouteActive,
} from "@/lib/routes";

type ShellNavItem = {
  href: string;
  glyph: string;
  labelKey: string;
  subKey?: string;
  prefixes: string[];
  separatorBefore?: boolean;
};

// P2 Pilot consumer nav. Portfolio and Rewards (S1/SPUMP-era surfaces) are out
// of the Pilot corridor and intentionally excluded from primary navigation.
const NAV_ITEMS: ShellNavItem[] = [
  { href: EXPLORE_PATH, glyph: "▦", labelKey: "nav.explore", subKey: "nav.exploreSub", prefixes: [EXPLORE_PATH, "/posts"] },
  { href: ACTIVITY_PATH, glyph: "◉", labelKey: "nav.activity", prefixes: [ACTIVITY_PATH] },
  { href: TRENDING_PATH, glyph: "✦", labelKey: "nav.trending", subKey: "nav.trendingSub", prefixes: [TRENDING_PATH] },
  { href: WORKSPACE_PATH, glyph: "✎", labelKey: "nav.workspace", prefixes: [WORKSPACE_PATH], separatorBefore: true },
];

const initialFor = (value: string | null | undefined) => {
  const trimmed = value?.trim().replace(/^@+/, "");
  return trimmed ? trimmed.charAt(0).toUpperCase() : "·";
};

export const UserShell = ({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) => {
  const router = useRouter();
  const { t } = useI18n();
  const identity = useSessionIdentity();
  // Narrow directly on the discriminant so the signed-in fields are type-safe.
  const profile =
    identity.status === "signed-in"
      ? {
          name:
            identity.displayName ||
            (identity.handle ? `@${identity.handle}` : shortenWalletLabel(identity.wallet)),
          sub:
            identity.handle && identity.displayName
              ? `@${identity.handle}`
              : shortenWalletLabel(identity.wallet),
          initial: initialFor(identity.displayName || identity.handle || identity.wallet),
        }
      : null;
  const profileHref = profile ? PROFILE_PATH : buildLoginHref({ nextPath: router.asPath });

  return (
    <main className="relative min-h-[100dvh] bg-[#090d14] text-[#f5f7fb]">
      <AnimatedFeedBackdrop />

      <aside className="liquid-glass-shell fixed bottom-4 left-4 top-4 z-40 hidden w-16 lg:flex lg:w-[248px] lg:flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center border-b border-white/[0.06] lg:justify-start lg:px-5">
          <Link
            className="flex h-9 w-9 items-center justify-center rounded-[11px] text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(222,64,42,0.34)]"
            href={EXPLORE_PATH}
            style={{ background: "linear-gradient(150deg, #de402a, #f0795f)" }}
          >
            S
          </Link>
          <span className="ml-3 hidden text-[17px] font-extrabold tracking-[-0.03em] text-white lg:block">
            StreamPump
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 lg:px-3">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(router.asPath, { href: item.href, label: item.labelKey, labelKey: item.labelKey, prefixes: item.prefixes });
            return (
              <div key={item.href}>
                {item.separatorBefore ? <div className="my-2.5 h-px bg-white/[0.06] lg:mx-1.5" /> : null}
                <Link
                  className={`group flex h-11 items-center gap-3 rounded-[13px] px-3 transition duration-200 ${
                    active ? "bg-white/[0.09] text-white" : "text-[#93a2bb] hover:bg-white/[0.05] hover:text-white"
                  }`}
                  data-active={active}
                  href={item.href}
                >
                  <span className={`w-5 shrink-0 text-center text-[15px] ${active ? "text-white" : "text-[#93a2bb] group-hover:text-white"}`}>
                    {item.glyph}
                  </span>
                  <span className="hidden flex-1 items-baseline gap-2 lg:flex">
                    <span className="text-sm font-semibold">{t(item.labelKey)}</span>
                    {item.subKey ? (
                      <span className="text-[length:var(--fs-nano)] font-medium text-[#7486a1]">{t(item.subKey)}</span>
                    ) : null}
                  </span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Bottom: real/anonymous identity + language switch. The SPUMP energy
            card is an S1-era surface outside the Pilot corridor and is not
            rendered here. No fabricated balance or fixture user is shown. */}
        <div className="space-y-2 border-t border-white/[0.06] p-2 lg:p-3">
          <div className="flex items-center gap-2">
            {profile ? (
              <Link className="min-w-0 flex-1" href={profileHref}>
                <div className="flex items-center gap-2.5 rounded-[13px] px-2 py-1.5 transition hover:bg-white/[0.05]">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: "linear-gradient(150deg, #de402a, #f0795f)" }}
                  >
                    {profile.initial}
                  </span>
                  <div className="hidden min-w-0 lg:block">
                    <p className="truncate text-[13px] font-semibold text-white">{profile.name}</p>
                    <p className="truncate font-mono text-[length:var(--fs-nano)] text-[#7486a1]">{profile.sub}</p>
                  </div>
                </div>
              </Link>
            ) : (
              <Link className="min-w-0 flex-1" href={profileHref}>
                <div className="flex items-center gap-2.5 rounded-[13px] px-2 py-1.5 transition hover:bg-white/[0.05]">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 flex-none place-items-center rounded-full border border-white/[0.12] bg-white/[0.04] text-sm text-[#7486a1]"
                  >
                    ↳
                  </span>
                  <div className="hidden min-w-0 lg:block">
                    <p className="truncate text-[13px] font-semibold text-white">{t("shell.signIn")}</p>
                    <p className="truncate text-[length:var(--fs-nano)] text-[#7486a1]">{t("shell.signInSub")}</p>
                  </div>
                </div>
              </Link>
            )}
            <div className="hidden lg:block">
              <SettingsMenu openUp />
            </div>
          </div>
        </div>
      </aside>

      <div className="relative lg:ml-[280px]">
        <div className="page-enter mx-auto max-w-[1480px] space-y-6 px-4 pb-24 pt-4 lg:px-6 lg:py-0">
          <div className="flex justify-end lg:hidden">
            <SettingsMenu />
          </div>
          {header}
          {children}
        </div>
      </div>

      {/* Mobile bottom tab bar — sidebar is hidden < lg, so this is the phone nav. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/[0.08] bg-[#0b1018]/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.filter((item) => item.href !== WORKSPACE_PATH).map((item) => {
          const active = isRouteActive(router.asPath, { href: item.href, label: item.labelKey, labelKey: item.labelKey, prefixes: item.prefixes });
          return (
            <Link
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition ${active ? "text-white" : "text-[#7e90aa]"}`}
              href={item.href}
              key={item.href}
            >
              <span className="text-[17px] leading-none">{item.glyph}</span>
              <span className="max-w-[68px] truncate text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
};
