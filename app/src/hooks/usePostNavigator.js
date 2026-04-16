"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePostNavigator = void 0;
const router_1 = require("next/router");
const react_1 = require("react");
const WHEEL_THRESHOLD = 110;
const WHEEL_GESTURE_IDLE_MS = 160;
const getDirection = (nextIndex, currentIndex) => nextIndex > currentIndex ? "up" : "down";
const usePostNavigator = (items, options = {}) => {
    const router = (0, router_1.useRouter)();
    const syncRoute = options.syncRoute ?? true;
    const routePostId = syncRoute
        ? typeof router.query.postId === "string"
            ? router.query.postId
            : items[0]?.id ?? ""
        : options.postId ?? items[0]?.id ?? "";
    const routeIndex = (0, react_1.useMemo)(() => {
        const index = items.findIndex((item) => item.id === routePostId);
        return index >= 0 ? index : 0;
    }, [items, routePostId]);
    const [currentIndex, setCurrentIndex] = (0, react_1.useState)(routeIndex);
    const [transitionDirection, setTransitionDirection] = (0, react_1.useState)("up");
    const [transitionKey, setTransitionKey] = (0, react_1.useState)(0);
    const [wheelEnabled, setWheelEnabled] = (0, react_1.useState)(false);
    const pendingPostIdRef = (0, react_1.useRef)(null);
    const wheelDirectionRef = (0, react_1.useRef)(null);
    const wheelAccumulatorRef = (0, react_1.useRef)(0);
    const wheelGestureConsumedRef = (0, react_1.useRef)(false);
    const wheelIdleTimeoutRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
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
    (0, react_1.useEffect)(() => {
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
    (0, react_1.useEffect)(() => {
        return () => {
            if (wheelIdleTimeoutRef.current !== null) {
                window.clearTimeout(wheelIdleTimeoutRef.current);
            }
        };
    }, []);
    const armWheelGestureUnlock = (0, react_1.useCallback)(() => {
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
    const goToIndex = (0, react_1.useCallback)((nextIndex, explicitDirection) => {
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
    }, [currentIndex, items, options, router, syncRoute]);
    const goPrevious = (0, react_1.useCallback)(() => {
        goToIndex(currentIndex - 1, "down");
    }, [currentIndex, goToIndex]);
    const goNext = (0, react_1.useCallback)(() => {
        goToIndex(currentIndex + 1, "up");
    }, [currentIndex, goToIndex]);
    const handleWheel = (0, react_1.useCallback)((event) => {
        if (!wheelEnabled || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }
        armWheelGestureUnlock();
        if (wheelGestureConsumedRef.current) {
            event.preventDefault();
            return;
        }
        const direction = event.deltaY > 0 ? "up" : "down";
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
    }, [armWheelGestureUnlock, currentIndex, goNext, goPrevious, items.length, wheelEnabled]);
    (0, react_1.useEffect)(() => {
        const onKeyDown = (event) => {
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
exports.usePostNavigator = usePostNavigator;
