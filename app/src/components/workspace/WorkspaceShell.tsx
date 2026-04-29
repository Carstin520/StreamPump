import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useState } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import {
  AnalyticsIcon,
  CampaignIcon,
  CloseIcon,
  CreateIcon,
  EarningsIcon,
  EyeIcon,
  LibraryIcon,
  MenuIcon,
  MoreIcon,
  OverviewIcon,
  SettingsIcon,
  SponsorIcon,
} from "@/components/shared/AppIcons";
import { StagePill } from "@/components/shared/StagePill";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { CreatorSeasonState } from "@/lib/api/types";
import { EXPLORE_PATH, isRouteActive, workspaceSidebarNav } from "@/lib/routes";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: OverviewIcon,
  create: CreateIcon,
  library: LibraryIcon,
  sponsor: SponsorIcon,
  campaign: CampaignIcon,
  analytics: AnalyticsIcon,
  earnings: EarningsIcon,
  settings: SettingsIcon,
};

const STAGE_LABELS: Record<CreatorSeasonState, string> = {
  S1_DISCOVERY: "S1 Discovery",
  S1_BUYOUT: "S1 Buyout Candidate",
  S2_ACTIVE: "S2 Sponsored Creator",
};

const MOBILE_NAV_LIMIT = 4;

export const WorkspaceShell = ({
  children,
  aside,
  stage = "S2_ACTIVE",
  wallet,
}: {
  children: ReactNode;
  aside?: ReactNode;
  stage?: CreatorSeasonState;
  wallet?: string;
}) => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAsideOpen, setMobileAsideOpen] = useState(false);

  const mobileNavItems = workspaceSidebarNav.filter((item) => !item.disabled).slice(0, MOBILE_NAV_LIMIT);
  const hasMore = workspaceSidebarNav.filter((item) => !item.disabled).length > MOBILE_NAV_LIMIT;

  return (
    <main className="relative min-h-[100dvh] bg-[#090d14] text-[#f5f7fb]">
      <AnimatedFeedBackdrop />

      {/* Desktop sidebar */}
      <aside className="liquid-glass-shell fixed bottom-4 left-4 top-4 z-40 hidden w-[240px] flex-col lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-5">
          <Link
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#de402a] text-xs font-bold text-white shadow-[0_8px_20px_rgba(222,64,42,0.3)]"
            href={EXPLORE_PATH}
          >
            SP
          </Link>
          <span className="text-sm font-bold tracking-[-0.04em] text-white">StreamPump</span>
        </div>

        {/* Stage badge */}
        <div className="border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <StagePill stage={stage} compact />
            <span className="text-[11px] text-[#8ea0ba]">{STAGE_LABELS[stage]}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-none">
          {workspaceSidebarNav.map((item) => {
            const Icon = ICON_MAP[item.iconName];
            const active = isRouteActive(router.asPath, item);
            const disabled = item.disabled;

            return (
              <Link
                className={`glass-nav-link group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition duration-200 ${
                  disabled ? "pointer-events-none opacity-35" : ""
                }`}
                data-active={active}
                href={disabled ? "#" : item.href}
                key={item.href}
              >
                {Icon && (
                  <Icon className={`h-[18px] w-[18px] shrink-0 transition ${active ? "text-white" : "text-[#6b7d96] group-hover:text-white"}`} />
                )}
                <span className={`transition ${active ? "font-medium text-white" : "text-[#8f9eb7] group-hover:text-white"}`}>
                  {item.label}
                </span>
                {disabled && (
                  <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-[#5a6b82]">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Wallet mini */}
        {wallet && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#65ecaf]" />
              <span className="truncate text-xs text-[#93a2bb]">
                {wallet.slice(0, 4)}...{wallet.slice(-4)}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-white/[0.06] bg-[#090d14]/90 backdrop-blur-xl lg:hidden">
        {mobileNavItems.map((item) => {
          const Icon = ICON_MAP[item.iconName];
          const active = isRouteActive(router.asPath, item);
          return (
            <Link
              className={`flex flex-col items-center gap-1 px-3 py-1.5 ${active ? "text-white" : "text-[#6b7d96]"}`}
              href={item.href}
              key={item.href}
            >
              {Icon && <Icon className="h-5 w-5" />}
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
        {hasMore && (
          <button
            className={`flex flex-col items-center gap-1 px-3 py-1.5 ${mobileMenuOpen ? "text-white" : "text-[#6b7d96]"}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
          >
            <MoreIcon className="h-5 w-5" />
            <span className="text-[10px]">更多</span>
          </button>
        )}
      </nav>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute bottom-16 left-4 right-4 rounded-3xl border border-white/[0.08] bg-[#0d1420]/95 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white">更多功能</span>
              <button onClick={() => setMobileMenuOpen(false)} type="button">
                <CloseIcon className="h-4 w-4 text-[#93a2bb]" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {workspaceSidebarNav.map((item) => {
                const Icon = ICON_MAP[item.iconName];
                return (
                  <Link
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition ${item.disabled ? "opacity-35" : "hover:bg-white/[0.05]"}`}
                    href={item.disabled ? "#" : item.href}
                    key={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {Icon && <Icon className="h-5 w-5 text-[#93a2bb]" />}
                    <span className="text-[10px] text-[#93a2bb]">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile aside toggle */}
      {aside && (
        <button
          className="fixed bottom-20 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[#de402a] text-white shadow-[0_8px_24px_rgba(222,64,42,0.4)] lg:hidden"
          onClick={() => setMobileAsideOpen(true)}
          type="button"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      )}

      {/* Mobile aside drawer */}
      {aside && mobileAsideOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileAsideOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[#0d1420]/95 p-4 pb-8 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white">预览面板</span>
              <button onClick={() => setMobileAsideOpen(false)} type="button">
                <CloseIcon className="h-4 w-4 text-[#93a2bb]" />
              </button>
            </div>
            {aside}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="relative pb-20 lg:ml-[272px] lg:pb-0">
        <div className="page-enter mx-auto max-w-[1280px] px-4 py-2 lg:px-6">
          <WorkspaceHeader wallet={wallet} />

          <div className={`mt-2 ${aside ? "gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
            <div className="min-w-0 space-y-6">{children}</div>
            {aside && <div className="hidden lg:block">{aside}</div>}
          </div>
        </div>
      </div>
    </main>
  );
};
