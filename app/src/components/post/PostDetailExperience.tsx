import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/shared/AppIcons";
import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import { MediaVideoPlayer } from "@/components/shared/MediaVideoPlayer";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { usePostNavigator } from "@/hooks/usePostNavigator";
import { PostRecord } from "@/lib/api/types";

const DynamicCommentPanel = dynamic(
  () => import("@/components/user/CommentPanel").then((mod) => mod.CommentPanel),
  {
    ssr: false,
    loading: () => (
      <aside className="flex h-full min-h-[38vh] flex-col gap-4 border-l border-white/[0.045] bg-[linear-gradient(180deg,rgba(14,19,29,0.96)_0%,rgba(9,13,20,0.98)_100%)] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/[0.05]" />
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-8 w-[72%] animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-4 w-full animate-pulse rounded-full bg-white/[0.05]" />
          <div className="h-4 w-[94%] animate-pulse rounded-full bg-white/[0.05]" />
          <div className="h-4 w-[82%] animate-pulse rounded-full bg-white/[0.05]" />
        </div>
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="flex gap-3" key={`comment-skeleton-${index}`}>
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.08]" />
                <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.05]" />
                <div className="h-3 w-[78%] animate-pulse rounded-full bg-white/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      </aside>
    ),
  },
);

type PostDetailExperienceProps = {
  items: PostRecord[];
  currentPostId?: string;
  syncRoute?: boolean;
  onChangePostId?: (postId: string) => void;
  onClose?: () => void;
  closeHref?: string;
  closeLabel?: string;
  mode?: "page" | "modal";
};

export const PostDetailExperience = ({
  items,
  currentPostId,
  syncRoute = true,
  onChangePostId,
  onClose,
  closeHref,
  closeLabel = "Back",
  mode = "page",
}: PostDetailExperienceProps) => {
  const {
    currentIndex,
    currentPost,
    handleWheel,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
    nextPost,
    previousPost,
    total,
    transitionDirection,
    transitionKey,
    wheelEnabled,
  } = usePostNavigator(items, {
    syncRoute,
    postId: currentPostId,
    onNavigate: onChangePostId,
  });
  const [showScrollHint, setShowScrollHint] = useState(false);
  const transitionClass = transitionDirection === "up" ? "slot-reel-up" : "slot-reel-down";

  useEffect(() => {
    if (!wheelEnabled) {
      setShowScrollHint(false);
      return;
    }

    setShowScrollHint(true);
    const timeoutId = window.setTimeout(() => {
      setShowScrollHint(false);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [wheelEnabled]);

  useEffect(() => {
    if (mode !== "modal") {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "modal" || !onClose) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mode, onClose]);

  if (!currentPost) {
    return null;
  }

  const shell = (
    <section
      className="detail-card-surface immersive-shell resize-detail-card overflow-hidden rounded-[34px] border border-white/[0.055]"
      style={{
        width: mode === "modal" ? "min(1480px, calc(100vw - 48px))" : "min(1500px, calc(100vw - 20px))",
        height: mode === "modal" ? "min(880px, calc(100vh - 56px))" : "min(900px, calc(100vh - 20px))",
      }}
    >
      <div className={`grid h-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_clamp(312px,26vw,392px)] ${transitionClass}`} key={`${currentPost.id}-${transitionKey}`}>
        <div
          className="relative flex min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_28%),linear-gradient(180deg,rgba(8,11,18,0.74)_0%,rgba(5,8,13,0.88)_100%)] px-3 pb-3 pt-3 lg:px-4 lg:pb-3 lg:pt-3"
          onWheel={handleWheel}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(96,128,190,0.09),transparent_22%)]" />

          <div className="relative z-10 flex min-h-0 flex-1 items-stretch">
            <PostMediaStage post={currentPost} />
            <StageOverlayControls
              closeHref={closeHref}
              closeLabel={closeLabel}
              currentIndex={currentIndex}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              mode={mode}
              onClose={onClose}
              onNext={goNext}
              onPrevious={goPrevious}
              showScrollHint={showScrollHint}
              total={total}
            />
          </div>

          <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.045] pt-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <img alt={currentPost.creatorName} className="h-10 w-10 rounded-full object-cover ring-1 ring-white/12" src={currentPost.creatorAvatarSrc} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{currentPost.creatorName}</p>
                <p className="truncate text-xs text-[#8ea0ba]">
                  {currentPost.timeLabel} · {currentPost.location}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[#93a5bd]">
              <StagePill stage={currentPost.stage} />
              {previousPost ? <RouteHint label="Prev" onClick={goPrevious} post={previousPost} /> : null}
              {nextPost ? <RouteHint label="Next" onClick={goNext} post={nextPost} /> : null}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] text-white/44">
            ◢
          </div>
        </div>

        <div className="min-h-[36vh] border-t border-white/[0.045] lg:min-h-0 lg:border-l lg:border-t-0">
          <DynamicCommentPanel post={currentPost} />
        </div>
      </div>
    </section>
  );

  if (mode === "modal") {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
        <button
          aria-label="Close post detail"
          className="absolute inset-0 bg-[#05080d]/54 backdrop-blur-[7px]"
          onClick={onClose}
          type="button"
        />
        <div className="pointer-events-none absolute inset-[6%] rounded-[48px] border border-white/[0.03] bg-[linear-gradient(180deg,rgba(15,21,32,0.18)_0%,rgba(7,11,18,0.08)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.14)] backdrop-blur-[3px]" />
        <div className="relative z-10 flex w-full items-center justify-center">{shell}</div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05080d] text-white">
      <AnimatedFeedBackdrop className="opacity-[0.78]" />
      <div className="pointer-events-none absolute inset-[5%] rounded-[48px] border border-white/[0.025] bg-[linear-gradient(180deg,rgba(17,24,38,0.3)_0%,rgba(10,14,22,0.16)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-[4px]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] items-center justify-center px-2 py-2 lg:px-5 lg:py-4">
        {shell}
      </div>
    </main>
  );
};

const PostMediaStage = ({ post }: { post: PostRecord }) => {
  if (post.type === "VIDEO") {
    return <VideoStage post={post} />;
  }

  return <ImageCarouselStage post={post} />;
};

const ImageCarouselStage = ({ post }: { post: PostRecord }) => {
  const images = post.gallerySrcs?.length ? post.gallerySrcs : [post.coverSrc];
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [post.id]);

  const goPrevious = () => {
    setActiveIndex((value) => Math.max(value - 1, 0));
  };

  const goNext = () => {
    setActiveIndex((value) => Math.min(value + 1, images.length - 1));
  };

  return (
    <div className="h-full w-full">
      <div
        className="relative h-full min-h-[320px] overflow-hidden rounded-[30px] border border-white/10 bg-[#091019] shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
        onTouchEnd={(event) => {
          const touchStartX = touchStartXRef.current;
          const touchEndX = event.changedTouches[0]?.clientX ?? 0;

          if (touchStartX === null) {
            return;
          }

          const deltaX = touchEndX - touchStartX;
          if (Math.abs(deltaX) < 48) {
            return;
          }

          if (deltaX < 0) {
            goNext();
            return;
          }

          goPrevious();
        }}
        onTouchStart={(event) => {
          touchStartXRef.current = event.touches[0]?.clientX ?? null;
        }}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div className="relative h-full min-w-full" key={`${post.id}-${index}`}>
              <ProgressiveImage
                alt={`${post.title} ${index + 1}`}
                className="object-contain"
                fill
                priority={index === 0}
                sizes="(max-width: 1280px) 100vw, 72vw"
                src={image}
              />
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <>
            <GalleryArrow direction="left" disabled={activeIndex === 0} onClick={goPrevious} />
            <GalleryArrow direction="right" disabled={activeIndex === images.length - 1} onClick={goNext} />
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/34 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="liquid-pill absolute bottom-4 right-4 z-10 rounded-full px-3 py-1 text-xs text-white">
          {activeIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

const VideoStage = ({ post }: { post: PostRecord }) => (
  <div className="h-full w-full">
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-[30px] border border-white/10 bg-[#05070d] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
      {post.videoSrc ? (
        <MediaVideoPlayer
          autoPlay
          className="h-full w-full"
          controls
          key={`${post.id}-${post.videoSrc}`}
          loadingLabel="Preparing video…"
          loop
          muted
          playsInline
          posterPriority
          posterSizes="(max-width: 1280px) 100vw, 72vw"
          posterSrc={post.coverSrc}
          preload="metadata"
          src={post.videoSrc}
          videoClassName="h-full w-full object-contain"
        />
      ) : (
        <>
          <ProgressiveImage
            alt={post.title}
            className="object-cover"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 72vw"
            src={post.coverSrc}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-black/26 text-xl text-white shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-xl transition duration-200 hover:scale-[1.03] hover:bg-black/34"
              type="button"
            >
              ▶
            </button>
          </div>
        </>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_20%),linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.46)_55%,rgba(0,0,0,0.78)_100%)]" />
      <div className="pointer-events-none absolute bottom-5 left-5 rounded-full border border-white/12 bg-black/26 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white backdrop-blur-xl">
        Video post
      </div>
      {post.durationLabel ? (
        <div className="pointer-events-none absolute bottom-5 right-5 rounded-full border border-white/12 bg-black/26 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white backdrop-blur-xl">
          {post.durationLabel}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_64%,rgba(0,0,0,0.34)_100%)]" />
    </div>
  </div>
);

const StageOverlayControls = ({
  closeHref,
  closeLabel,
  currentIndex,
  total,
  hasPrevious,
  hasNext,
  mode,
  onClose,
  onPrevious,
  onNext,
  showScrollHint,
}: {
  closeHref?: string;
  closeLabel: string;
  currentIndex: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  mode: "page" | "modal";
  onClose?: () => void;
  onPrevious: () => void;
  onNext: () => void;
  showScrollHint: boolean;
}) => (
  <>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-black/24 to-transparent" />
    <div className="absolute left-4 top-4 z-30 flex items-center gap-2">
      {closeHref ? (
        <Link
          aria-label={closeLabel}
          className="liquid-glass-icon-btn flex h-10 w-10 items-center justify-center rounded-full text-base text-white transition duration-200 hover:scale-[1.03] hover:bg-white/10"
          href={closeHref}
          scroll={false}
        >
          {mode === "page" ? <ArrowLeftIcon /> : <CloseIcon />}
        </Link>
      ) : (
        <button
          aria-label={closeLabel}
          className="liquid-glass-icon-btn flex h-10 w-10 items-center justify-center rounded-full text-base text-white transition duration-200 hover:scale-[1.03] hover:bg-white/10"
          onClick={onClose}
          type="button"
        >
          {mode === "page" ? <ArrowLeftIcon /> : <CloseIcon />}
        </button>
      )}
      <div className="liquid-panel rounded-full px-3 py-1.5 text-sm font-medium text-white">
        {currentIndex + 1}/{total}
      </div>
    </div>

    <div className="absolute right-4 top-4 z-30 flex items-start gap-2">
      {showScrollHint ? (
        <div className="hint-flash rounded-full border border-white/[0.08] bg-black/22 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#c3d0e2] backdrop-blur-md">
          Scroll
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-white/[0.08] bg-black/22 p-1.5 backdrop-blur-lg">
        <PostSwitchButton direction="up" disabled={!hasPrevious} onClick={onPrevious} />
        <PostSwitchButton direction="down" disabled={!hasNext} onClick={onNext} />
      </div>
    </div>
  </>
);

const PostSwitchButton = ({
  direction,
  disabled,
  onClick,
}: {
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    aria-label={direction === "up" ? "Previous post" : "Next post"}
    disabled={disabled}
    className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm transition duration-200 ${
      disabled
        ? "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-white/24"
        : "border-white/[0.12] bg-white/[0.08] text-white hover:scale-[1.03] hover:bg-white/[0.14]"
    }`}
    onClick={onClick}
    type="button"
  >
    {direction === "up" ? <ArrowUpIcon /> : <ArrowDownIcon />}
  </button>
);

const GalleryArrow = ({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    aria-label={direction === "left" ? "Previous image" : "Next image"}
    disabled={disabled}
    className={`liquid-glass-icon-btn absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-lg text-white transition duration-200 ${
      direction === "left" ? "left-4" : "right-4"
    } ${disabled ? "pointer-events-none opacity-20" : "hover:scale-[1.03] hover:bg-white/12"}`}
    onClick={onClick}
    type="button"
  >
    {direction === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
  </button>
);

const RouteHint = ({
  label,
  post,
  onClick,
}: {
  label: string;
  post: PostRecord;
  onClick: () => void;
}) => (
  <button
    className="max-w-[220px] truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-left transition hover:bg-white/[0.08] hover:text-white"
    onClick={onClick}
    type="button"
  >
    {label}: {post.title}
  </button>
);
