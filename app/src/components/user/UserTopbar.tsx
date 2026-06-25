import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { currentUser } from "@/lib/public-data";

export type TopbarMode = "sticky" | "scroll-reveal";

const FALLBACK_BAR_HEIGHT = 92;
const SCROLL_DELTA = 2;
const TOP_LOCK_Y = 4;
const CATEGORY_GAP = 6;
const TOUCH_DELTA = 4;
const SEARCH_AUTO_HIDE_MS = 10_000;

export const UserTopbar = ({
  mode = "sticky",
  searchPlaceholder,
  hideSearch = false,
  leading,
}: {
  mode?: TopbarMode;
  searchPlaceholder?: string;
  hideSearch?: boolean;
  leading?: ReactNode;
}) => {
  const { t } = useI18n();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("shell.searchPlaceholder");

  if (mode === "scroll-reveal") {
    return <ScrollRevealTopbar leading={leading} searchPlaceholder={resolvedSearchPlaceholder} />;
  }

  return (
    <header className="sticky top-0 z-30 pt-4">
      <TopbarInner hideSearch={hideSearch} leading={leading} searchPlaceholder={resolvedSearchPlaceholder} />
    </header>
  );
};

type RevealState = "visible" | "hidden";

const ScrollRevealTopbar = ({
  searchPlaceholder,
  leading,
}: {
  searchPlaceholder: string;
  leading?: ReactNode;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const barH = useRef(FALLBACK_BAR_HEIGHT);
  const barBottom = useRef(FALLBACK_BAR_HEIGHT);
  const lastY = useRef(0);
  const lastTouchY = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const autoHideTimer = useRef<number | null>(null);
  const stateRef = useRef<RevealState>("visible");
  const searchLocked = useRef(false);
  const [barHeight, setBarHeight] = useState(FALLBACK_BAR_HEIGHT);

  const syncRevealVars = useCallback((
    nextState: RevealState,
    nextHeight = barH.current,
    nextBottom = barBottom.current,
  ) => {
    const searchOpacity = nextState === "visible" ? 1 : 0;
    const searchPointer = nextState === "visible" ? "auto" : "none";
    const searchZ = nextState === "visible" ? 40 : 20;
    const categoryTop = (nextState === "visible" ? nextBottom : 0) + CATEGORY_GAP;

    document.body.style.setProperty("--scroll-reveal-bar-h", `${nextHeight}px`);
    document.body.style.setProperty("--scroll-reveal-search-opacity", `${searchOpacity}`);
    document.body.style.setProperty("--scroll-reveal-search-pointer", searchPointer);
    document.body.style.setProperty("--scroll-reveal-search-z", `${searchZ}`);
    document.body.style.setProperty("--scroll-reveal-category-top", `${categoryTop}px`);
  }, []);

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimer.current === null) return;

    window.clearTimeout(autoHideTimer.current);
    autoHideTimer.current = null;
  }, []);

  const isAtTop = useCallback(() => Math.max(0, window.scrollY) <= TOP_LOCK_Y, []);

  const setRevealState = useCallback((nextState: RevealState) => {
    if (nextState === "hidden") {
      clearAutoHideTimer();
      searchLocked.current = false;
    }

    if (stateRef.current === nextState) return;

    stateRef.current = nextState;
    syncRevealVars(nextState);
  }, [clearAutoHideTimer, syncRevealVars]);

  const scheduleAutoHide = useCallback(() => {
    clearAutoHideTimer();

    if (stateRef.current !== "visible" || searchLocked.current || isAtTop()) return;

    autoHideTimer.current = window.setTimeout(() => {
      autoHideTimer.current = null;
      if (stateRef.current !== "visible" || searchLocked.current || isAtTop()) return;
      setRevealState("hidden");
    }, SEARCH_AUTO_HIDE_MS);
  }, [clearAutoHideTimer, isAtTop, setRevealState]);

  const showSearch = useCallback(() => {
    setRevealState("visible");

    if (isAtTop() || searchLocked.current) {
      clearAutoHideTimer();
      return;
    }

    scheduleAutoHide();
  }, [clearAutoHideTimer, isAtTop, scheduleAutoHide, setRevealState]);

  useEffect(() => {
    if (!barRef.current) return;

    const measure = () => {
      if (!barRef.current) return;
      const h = barRef.current.offsetHeight;
      if (h <= 0) return;
      const bottom = barRef.current.getBoundingClientRect().bottom;
      barH.current = h;
      barBottom.current = bottom;
      setBarHeight(h);
      syncRevealVars(stateRef.current, h, bottom);
    };

    measure();
    lastY.current = window.scrollY;

    const ro = new ResizeObserver(measure);
    ro.observe(barRef.current);

    return () => {
      ro.disconnect();
      document.body.style.removeProperty("--scroll-reveal-bar-h");
      document.body.style.removeProperty("--scroll-reveal-search-opacity");
      document.body.style.removeProperty("--scroll-reveal-search-pointer");
      document.body.style.removeProperty("--scroll-reveal-search-z");
      document.body.style.removeProperty("--scroll-reveal-category-top");
    };
  }, [syncRevealVars]);

  const onScroll = useCallback(() => {
    if (rafId.current !== null) return;

    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null;

      const y = Math.max(0, window.scrollY);
      const goingUp = y < lastY.current - SCROLL_DELTA;
      const goingDown = y > lastY.current + SCROLL_DELTA;
      const atTop = y <= TOP_LOCK_Y;

      if (atTop || goingUp) {
        showSearch();
      } else if (goingDown) {
        setRevealState("hidden");
      }

      lastY.current = y;
    });
  }, [setRevealState, showSearch]);

  const onWheel = useCallback((event: WheelEvent) => {
    const y = Math.max(0, window.scrollY);

    if (y <= TOP_LOCK_Y || event.deltaY < -SCROLL_DELTA) {
      showSearch();
    } else if (event.deltaY > SCROLL_DELTA) {
      setRevealState("hidden");
    }
  }, [setRevealState, showSearch]);

  const onTouchStart = useCallback((event: TouchEvent) => {
    lastTouchY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchMove = useCallback((event: TouchEvent) => {
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined || lastTouchY.current === null) return;

    const delta = currentY - lastTouchY.current;
    const y = Math.max(0, window.scrollY);

    if (y <= TOP_LOCK_Y || delta > TOUCH_DELTA) {
      showSearch();
    } else if (delta < -TOUCH_DELTA) {
      setRevealState("hidden");
    }

    lastTouchY.current = currentY;
  }, [setRevealState, showSearch]);

  const onTouchEnd = useCallback(() => {
    lastTouchY.current = null;
  }, []);

  const onPointerDown = useCallback((event: PointerEvent) => {
    const target = event.target;
    const searchInput = barRef.current?.querySelector("input");
    const clickedSearchInput = target instanceof Node && Boolean(searchInput?.contains(target));

    if (clickedSearchInput) {
      searchLocked.current = true;
      clearAutoHideTimer();
      return;
    }

    if (!searchLocked.current) return;

    searchLocked.current = false;
    scheduleAutoHide();
  }, [clearAutoHideTimer, scheduleAutoHide]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("pointerdown", onPointerDown);
      clearAutoHideTimer();
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, [clearAutoHideTimer, onPointerDown, onScroll, onTouchEnd, onTouchMove, onTouchStart, onWheel]);

  return (
    <>
      <div aria-hidden style={{ height: barHeight }} />

      <header
        ref={barRef}
        className="scroll-reveal-search-header fixed inset-x-0 top-0 pt-4 lg:left-[280px] transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity]"
        style={{
          opacity: "var(--scroll-reveal-search-opacity, 1)",
        }}
      >
        <div className="mx-auto max-w-[1480px] px-4 lg:px-6">
          <TopbarInner leading={leading} searchPlaceholder={searchPlaceholder} />
        </div>
      </header>
    </>
  );
};

const TopbarInner = ({
  hideSearch = false,
  searchPlaceholder,
  leading,
}: {
  hideSearch?: boolean;
  searchPlaceholder: string;
  leading?: ReactNode;
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-toolbar flex min-h-[56px] items-center justify-between gap-4 px-3 py-2.5 lg:px-4">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      {hideSearch ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 lg:max-w-xl">
          <div className="input-glass group relative rounded-full">
            <input
              className="h-10 w-full rounded-full bg-transparent pl-5 pr-12 text-sm text-white outline-none placeholder:text-[#6f7d95]"
              placeholder={searchPlaceholder}
              type="text"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-[#8ea0ba] transition group-focus-within:text-white">
              ⌕
            </span>
          </div>
        </div>
      )}

      <div className="ml-4 flex items-center gap-3">
        <Link
          className="glass-button-primary px-5 py-2.5 text-sm font-semibold"
          href="/workspace"
        >
          + {t("shell.workspaceCenter")}
        </Link>
        <Link
          className="glass-button-ghost flex items-center gap-2 px-2.5 py-1.5 text-sm text-[#c4d0e3] transition duration-200 hover:text-white"
          href="/me"
        >
          <img alt={currentUser.name} className="h-7 w-7 rounded-full object-cover" src={currentUser.avatarSrc} />
          <span className="hidden max-w-[140px] truncate sm:inline">{currentUser.handle}</span>
        </Link>
      </div>
    </div>
  );
};
