import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import { CheckCircleIcon, ChevronRightIcon, SettingsIcon } from "@/components/shared/AppIcons";
import { AuthSessionRecord } from "@/lib/api/types";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth-session";
import { shortenWallet } from "@/lib/formatting";
import { useI18n } from "@/lib/i18n";
import { EXPLORE_PATH, buildLoginHref } from "@/lib/routes";

// Gear-icon menu shared by the consumer shell: combines auth (login/logout)
// with a language submenu. Auth state is read client-side from the existing
// session store; no new persistence is introduced here.
export const SettingsMenu = ({ openUp = false }: { openUp?: boolean }) => {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [session, setSession] = useState<AuthSessionRecord | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh auth state on mount and whenever the route changes.
  useEffect(() => {
    setSession(getStoredAuthSession());
  }, [router.asPath]);

  // Dismiss on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setLangOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const signedIn = Boolean(session);
  const loginHref = buildLoginHref({ nextPath: router.asPath });

  const close = () => {
    setOpen(false);
    setLangOpen(false);
  };

  const handleLogout = () => {
    clearStoredAuthSession();
    setSession(null);
    close();
    void router.replace(EXPLORE_PATH);
  };

  const pickLocale = (next: "zh" | "en") => {
    setLocale(next);
    close();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("shell.settings")}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.035] text-[#9aabc4] transition hover:bg-white/[0.08] hover:text-white ${
          open ? "bg-white/[0.08] text-white" : ""
        }`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <SettingsIcon className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-50 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c121d]/98 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          role="menu"
        >
          {signedIn ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#65ecaf]/[0.12] text-[#65ecaf]">
                <CheckCircleIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[length:var(--fs-micro)] font-semibold text-white">{t("shell.signedIn")}</p>
                <p className="truncate font-mono text-[length:var(--fs-nano)] text-[#7486a1]">{shortenWallet(session?.wallet)}</p>
              </div>
            </div>
          ) : null}

          {/* Language — second-level menu */}
          <button
            aria-expanded={langOpen}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[length:var(--fs-caption)] text-[#cbd6e7] transition hover:bg-white/[0.05] hover:text-white"
            onClick={() => setLangOpen((value) => !value)}
            type="button"
          >
            <span className="flex-1">{t("shell.language")}</span>
            <span className="text-[length:var(--fs-nano)] text-[#7486a1]">{locale === "zh" ? t("shell.languageZh") : t("shell.languageEn")}</span>
            <ChevronRightIcon className={`h-3.5 w-3.5 text-[#7486a1] transition-transform ${langOpen ? "rotate-90" : ""}`} />
          </button>
          {langOpen ? (
            <div className="mb-1 ml-3 space-y-0.5 border-l border-white/[0.08] pl-2">
              {(["zh", "en"] as const).map((item) => {
                const active = locale === item;
                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[length:var(--fs-micro)] transition ${
                      active ? "bg-white/[0.08] text-white" : "text-[#9aabc4] hover:bg-white/[0.05] hover:text-white"
                    }`}
                    key={item}
                    onClick={() => pickLocale(item)}
                    type="button"
                  >
                    <span>{item === "zh" ? t("shell.languageZh") : t("shell.languageEn")}</span>
                    {active ? <CheckCircleIcon className="h-3.5 w-3.5 text-[#65ecaf]" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="my-1 h-px bg-white/[0.06]" />

          {signedIn ? (
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[length:var(--fs-caption)] font-medium text-[#ff8a78] transition hover:bg-[#de402a]/[0.1]"
              onClick={handleLogout}
              type="button"
            >
              {t("shell.logout")}
            </button>
          ) : (
            <Link
              className="flex w-full items-center gap-2 rounded-xl bg-[#de402a] px-3 py-2 text-left text-[length:var(--fs-caption)] font-semibold text-white transition hover:bg-[#ea523e]"
              href={loginHref}
              onClick={close}
            >
              {t("shell.login")}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
};
