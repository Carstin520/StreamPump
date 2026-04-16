import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";

import { PostRecord } from "@/lib/mock-data";

type NavigationDirection = "up" | "down";
type UsePostNavigatorOptions = {
  syncRoute?: boolean;
  postId?: string;
  onNavigate?: (postId: string) => void;
  hrefBuilder?: (postId: string) => string;
};

const WHEEL_THRESHOLD = 110;
const WHEEL_GESTURE_IDLE_MS = 160;

const getDirection = (nextIndex: number, currentIndex: number): NavigationDirection =>
  nextIndex > currentIndex ? "up" : "down";

export const usePostNavigator = (items: PostRecord[], options: UsePostNavigatorOptions = {}) => {
  const router = useRouter();
  const syncRoute = options.syncRoute ?? true;
  const routePostId = syncRoute
    ? typeof router.query.postId === "string"
      ? router.query.postId
      : items[0]?.id ?? ""
    : options.postId ?? items[0]?.id ?? "";
  const routeIndex = useMemo(() => {
    const index = items.findIndex((item) => item.id === routePostId);
    return index >= 0 ? index : 0;
  }, [items, routePostId]);

  const [currentIndex, setCurrentIndex] = useState(routeIndex);
  const [transitionDirection, setTransitionDirection] = useState<NavigationDirection>("up");
  const [transitionKey, setTransitionKey] = useState(0);
  const [wheelEnabled, setWheelEnabled] = useState(false);

  const pendingPostIdRef = useRef<string | null>(null);
  const wheelDirectionRef = useRef<NavigationDirection | null>(null);
  const wheelAccumulatorRef = useRef(0);
  const wheelGestureConsumedRef = useRef(false);
  const wheelIdleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const pendingPostId = pendingPostIdRef.current;

    if (pendingPostId) {
      if (pendingPostId === routePostId) {
        pendingPostIdRef.current = null;
      }
      return;
    }

    const nextIndex = routeIndex;
    if (nextIndex === currentIndex) {
      return;
    }

    const nextDirection = getDirection(nextIndex, currentIndex);
    setTransitionDirection(nextDirection);
    setCurrentIndex(nextIndex);
    setTransitionKey((value) => value + 1);
  }, [currentIndex, routeIndex, routePostId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: fine)");
    const updateState = () => setWheelEnabled(mediaQuery.matches);

    updateState();
    mediaQuery.addEventListener("change", updateState);

    return () => {
      mediaQuery.removeEventListener("change", updateState);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (wheelIdleTimeoutRef.current !== null) {
        window.clearTimeout(wheelIdleTimeoutRef.current);
      }
    };
  }, []);

  const armWheelGestureUnlock = useCallback(() => {
    if (wheelIdleTimeoutRef.current !== null) {
      window.clearTimeout(wheelIdleTimeoutRef.current);
    }

    wheelIdleTimeoutRef.current = window.setTimeout(() => {
      wheelGestureConsumedRef.current = false;
      wheelAccumulatorRef.current = 0;
      wheelDirectionRef.current = null;
      wheelIdleTimeoutRef.current = null;
    }, WHEEL_GESTURE_IDLE_MS);
  }, []);

  const goToIndex = useCallback(
    (nextIndex: number, explicitDirection?: NavigationDirection) => {
      if (nextIndex < 0 || nextIndex >= items.length || nextIndex === currentIndex) {
        return;
      }

      const direction = explicitDirection ?? getDirection(nextIndex, currentIndex);

      setTransitionDirection(direction);
      setCurrentIndex(nextIndex);
      setTransitionKey((value) => value + 1);
      wheelAccumulatorRef.current = 0;
      wheelDirectionRef.current = direction;
      wheelGestureConsumedRef.current = true;
      if (syncRoute) {
        const nextPostId = items[nextIndex].id;
        pendingPostIdRef.current = nextPostId;
        void router.replace(options.hrefBuilder?.(nextPostId) ?? `/posts/${nextPostId}`, undefined, {
          shallow: true,
          scroll: false,
        });
        return;
      }

      options.onNavigate?.(items[nextIndex].id);
    },
    [currentIndex, items, options, router, syncRoute],
  );

  const goPrevious = useCallback(() => {
    goToIndex(currentIndex - 1, "down");
  }, [currentIndex, goToIndex]);

  const goNext = useCallback(() => {
    goToIndex(currentIndex + 1, "up");
  }, [currentIndex, goToIndex]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (!wheelEnabled || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      armWheelGestureUnlock();

      if (wheelGestureConsumedRef.current) {
        event.preventDefault();
        return;
      }

      const direction: NavigationDirection = event.deltaY > 0 ? "up" : "down";
      const hasTarget = direction === "up" ? currentIndex < items.length - 1 : currentIndex > 0;

      if (!hasTarget) {
        return;
      }

      if (wheelDirectionRef.current && wheelDirectionRef.current !== direction) {
        wheelAccumulatorRef.current = 0;
      }

      wheelDirectionRef.current = direction;
      wheelAccumulatorRef.current += Math.abs(event.deltaY);

      if (wheelAccumulatorRef.current < WHEEL_THRESHOLD) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      wheelAccumulatorRef.current = 0;

      if (direction === "up") {
        goNext();
        return;
      }

      goPrevious();
    },
    [armWheelGestureUnlock, currentIndex, goNext, goPrevious, items.length, wheelEnabled],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        goNext();
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        goPrevious();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goNext, goPrevious]);

  return {
    currentIndex,
    currentPost: items[currentIndex] ?? items[0],
    hasNext: currentIndex < items.length - 1,
    hasPrevious: currentIndex > 0,
    nextPost: currentIndex < items.length - 1 ? items[currentIndex + 1] : null,
    previousPost: currentIndex > 0 ? items[currentIndex - 1] : null,
    total: items.length,
    transitionDirection,
    transitionKey,
    wheelEnabled,
    goNext,
    goPrevious,
    goToIndex,
    handleWheel,
  };
};
