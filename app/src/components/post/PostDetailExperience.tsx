import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FollowCheckIcon,
  FollowPlusIcon,
  HeartOutlineIcon,
  HeartSolidIcon,
} from "@/components/shared/AppIcons";
import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import {
  MediaVideoPlayer,
  primeHlsJs,
} from "@/components/shared/MediaVideoPlayer";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { usePostNavigator } from "@/hooks/usePostNavigator";
import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { requireInteractiveSession } from "@/lib/interaction-auth";
import { compactNumber } from "@/lib/public-data";

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
  const { t } = useI18n();
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

  useEffect(() => {
    if (currentPost?.type === "VIDEO" && currentPost.videoSrc) {
      void primeHlsJs();
    }
  }, [currentPost]);

  if (!currentPost) {
    return null;
  }

  const shell = (
    <section
      className="detail-card-surface immersive-shell resize-detail-card overflow-hidden rounded-[34px] border border-white/[0.055]"
      style={{
        width: mode === "modal" ? "calc(100vw - 120px)" : "min(1500px, calc(100vw - 20px))",
        height: mode === "modal" ? "calc(100vh - 90px)" : "min(780px, calc(100vh - 190px))",
        minHeight: mode === "modal" ? undefined : "520px",
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

          <div
            className="relative z-10 mt-2 flex min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-t border-white/[0.045] pt-2.5"
            style={{ maxHeight: "44%" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link className="flex min-w-0 items-center gap-3" href={`/creators/${currentPost.creatorId}`}>
                <img alt={currentPost.creatorName} className="h-10 w-10 rounded-full object-cover ring-1 ring-white/12" src={currentPost.creatorAvatarSrc} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{currentPost.creatorName}</p>
                  <p className="truncate text-xs text-[#8ea0ba]">
                    {currentPost.timeLabel} · {currentPost.location}
                  </p>
                </div>
              </Link>
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[#93a5bd]">
                <StagePill stage={currentPost.stage} />
                {previousPost ? <RouteHint label={t("common.previous")} onClick={goPrevious} post={previousPost} /> : null}
                {nextPost ? <RouteHint label={t("common.next")} onClick={goNext} post={nextPost} /> : null}
              </div>
            </div>

            <PostContentBlock post={currentPost} />
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[length:var(--fs-micro)] text-white/44">
            ◢
          </div>
        </div>

        <div className="flex min-h-[36vh] flex-col overflow-hidden border-t border-white/[0.045] lg:min-h-0 lg:border-l lg:border-t-0">
          <DetailRightColumn
            currentPost={currentPost}
            items={items}
            onChangePostId={onChangePostId}
          />
        </div>
      </div>
    </section>
  );

  if (mode === "modal") {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
        <button
          aria-label={t("shell.closePostDetail")}
          className="absolute inset-0 bg-[#090d14]/72 backdrop-blur-[12px]"
          onClick={onClose}
          type="button"
        />
        <div className="pointer-events-none absolute inset-[6%] rounded-[48px] border border-white/[0.03] bg-[linear-gradient(180deg,rgba(15,21,32,0.18)_0%,rgba(7,11,18,0.08)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.14)] backdrop-blur-[3px]" />
        <div className="relative z-10 flex w-full items-center justify-center">{shell}</div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#090d14] text-white">
      <AnimatedFeedBackdrop className="opacity-[0.78]" />
      <div className="pointer-events-none fixed inset-[5%] z-0 rounded-[48px] border border-white/[0.025] bg-[linear-gradient(180deg,rgba(17,24,38,0.3)_0%,rgba(10,14,22,0.16)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-[4px]" />
      <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[1800px] flex-col items-center justify-center gap-3 px-2 py-3 lg:px-5 lg:py-4">
        <div className="flex w-full items-center justify-center">{shell}</div>
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
          posterOverlay={false}
          posterPriority
          posterSizes="(max-width: 1280px) 100vw, 72vw"
          posterSrc={post.coverSrc}
          preload="auto"
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
      {post.durationLabel ? (
        <div className="pointer-events-none absolute bottom-5 right-5 rounded-full border border-white/12 bg-black/26 px-3 py-1.5 text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-white backdrop-blur-xl">
          {post.durationLabel}
        </div>
      ) : null}
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
}) => {
  const { t } = useI18n();

  return (
    <>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-black/24 to-transparent" />
    <div className="absolute left-4 top-4 z-30 flex items-center gap-2">
      {closeHref ? (
        <Link
          aria-label={closeLabel}
          className="liquid-glass-icon-btn flex h-10 w-10 items-center justify-center rounded-full text-base text-white transition duration-200 hover:scale-[1.03] hover:bg-white/10"
          href={closeHref}
          scroll={false}
          title={closeLabel}
        >
          {mode === "page" ? <ArrowLeftIcon /> : <CloseIcon />}
        </Link>
      ) : (
        <button
          aria-label={closeLabel}
          className="liquid-glass-icon-btn flex h-10 w-10 items-center justify-center rounded-full text-base text-white transition duration-200 hover:scale-[1.03] hover:bg-white/10"
          onClick={onClose}
          title={closeLabel}
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
        <div className="hint-flash rounded-full border border-white/[0.08] bg-black/22 px-2.5 py-1.5 text-[length:var(--fs-micro)] uppercase tracking-[0.2em] text-[#c3d0e2] backdrop-blur-md">
          {t("feed.scroll")}
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-white/[0.08] bg-black/22 p-1.5 backdrop-blur-lg">
        <PostSwitchButton ariaLabel={t("shell.previousPost")} direction="up" disabled={!hasPrevious} onClick={onPrevious} />
        <PostSwitchButton ariaLabel={t("shell.nextPost")} direction="down" disabled={!hasNext} onClick={onNext} />
      </div>
    </div>
  </>
  );
};

const PostSwitchButton = ({
  ariaLabel,
  direction,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    aria-label={ariaLabel}
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
}) => {
  const { t } = useI18n();

  return (
    <button
      aria-label={direction === "left" ? t("shell.previousImage") : t("shell.nextImage")}
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
};

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

// Left column content under the media: title + meta actions + body + tags.
// (Prototype content-page-c.html: title/简介/actions live in the left column;
// the right column is backing + related + comments only.)
const PostContentBlock = ({ post }: { post: PostRecord }) => {
  const { t } = useI18n();
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleLike = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }
    setLiked((value) => !value);
  };

  const toggleSave = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }
    setSaved((value) => !value);
  };

  return (
    <div>
      {post.title ? (
        <h1 className="text-[19px] font-semibold leading-[1.32] tracking-[-0.03em] text-white">{post.title}</h1>
      ) : null}

      <div className="mt-2.5 flex items-center gap-5 text-sm">
        <button
          className={`flex items-center gap-1.5 transition hover:text-white ${liked ? "text-[#ff9fc4]" : "text-[#c7d2e3]"}`}
          onClick={toggleLike}
          type="button"
        >
          {liked ? <HeartSolidIcon className="h-4 w-4" /> : <HeartOutlineIcon className="h-4 w-4" />}
          <span>{compactNumber(post.likes + (liked ? 1 : 0))}</span>
        </button>
        <button
          className={`flex items-center gap-1.5 transition hover:text-white ${saved ? "text-[#93c8ff]" : "text-[#c7d2e3]"}`}
          onClick={toggleSave}
          type="button"
        >
          <span className="text-base">{saved ? "★" : "☆"}</span>
          <span>{compactNumber(post.saves + (saved ? 1 : 0))}</span>
        </button>
        <span className="flex items-center gap-1.5 text-[#c7d2e3]">
          <span className="text-base">↗</span>
          <span>{t("feed.share")}</span>
        </span>
      </div>

      {post.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#cfd8e7]">{post.body}</p>
      ) : null}

      {post.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span className="text-xs text-[#de725f]" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// Stage-aware backing panel: one creator header (avatar + Follow at top) plus a
// stage-specific action — S1 discovery → back/energy on /market, Buyout → a
// graduation-funding prompt → /buyout, S2 → a campaign entry. NONE → honest
// "view creator". No fabricated momentum numbers; real value lives on /market.
const STAGE_ACCENT: Record<PostRecord["stage"], string> = {
  NONE: "var(--stage-s1)",
  S1_DISCOVERY: "var(--stage-s1)",
  S1_BUYOUT: "var(--stage-buyout)",
  S2_ACTIVE: "var(--stage-s2)",
};

const CreatorBackingPanel = ({ post }: { post: PostRecord }) => {
  const { t } = useI18n();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);

  const toggleFollow = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }
    setIsFollowing((value) => !value);
  };

  const accent = STAGE_ACCENT[post.stage];

  const action = ((): { eyebrow?: string; badge?: string; cta: string; href: string; note: string; source?: string } => {
    switch (post.stage) {
      case "S1_DISCOVERY":
        return {
          eyebrow: t("backing.s1Eyebrow"),
          cta: t("backing.teaserCta"),
          href: `/market/${post.creatorId}`,
          note: t("backing.teaserNote"),
          source: t("backing.teaserReadiness"),
        };
      case "S1_BUYOUT":
        return {
          badge: t("backing.buyoutBadge"),
          cta: t("backing.buyoutCta"),
          href: `/buyout/${post.creatorId}`,
          note: t("backing.buyoutNote"),
          source: t("backing.teaserReadiness"),
        };
      case "S2_ACTIVE":
        return {
          eyebrow: t("backing.s2Eyebrow"),
          cta: t("backing.s2Cta"),
          href: `/creators/${post.creatorId}`,
          note: t("backing.s2Note"),
          source: t("backing.teaserReadiness"),
        };
      default:
        return {
          cta: t("backing.viewCreator"),
          href: `/creators/${post.creatorId}`,
          note: t("backing.notInSeason"),
          source: t("backing.teaserSource"),
        };
    }
  })();

  return (
    <div
      className="rounded-[16px] border p-4"
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 10%, transparent), color-mix(in srgb, ${accent} 3%, transparent))`,
        borderColor: `color-mix(in srgb, ${accent} 28%, transparent)`,
      }}
    >
      {/* Creator header with Follow at the top */}
      <div className="flex items-center justify-between gap-3">
        <Link className="flex min-w-0 items-center gap-3" href={`/creators/${post.creatorId}`}>
          <img alt={post.creatorName} className="h-10 w-10 flex-none rounded-full object-cover ring-1 ring-white/10" src={post.creatorAvatarSrc} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{post.creatorName}</p>
              <StagePill compact stage={post.stage} />
            </div>
            <p className="truncate text-xs text-[#8799b3]">
              {post.creatorHandle}
              <span className="ml-1.5 text-[#5a6d87]">· {t("feed.identityPlaceholder")}</span>
            </p>
          </div>
        </Link>
        <button
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition hover:scale-[1.02] ${
            isFollowing ? "border-[#90efac]/30 bg-[#13291f]/70 text-[#90efac]" : "border-white/14 bg-white/[0.05] text-white hover:bg-white/10"
          }`}
          onClick={toggleFollow}
          type="button"
        >
          {isFollowing ? <FollowCheckIcon className="h-4 w-4" /> : <FollowPlusIcon className="h-4 w-4" />}
          {isFollowing ? t("feed.following") : t("feed.follow")}
        </button>
      </div>

      {/* Stage eyebrow / buyout badge */}
      {action.badge ? (
        <p className="mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[length:var(--fs-nano)] font-semibold" style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 34%, transparent)`, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}>
          {action.badge}
        </p>
      ) : action.eyebrow ? (
        <p className="mt-3 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {action.eyebrow}
        </p>
      ) : null}

      {/* Stage-aware CTA */}
      <Link
        className="mt-3 flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
        href={action.href}
        style={{
          background: post.stage === "NONE" || post.stage === "S1_DISCOVERY"
            ? "linear-gradient(180deg, var(--brand-strong, #f05540) 0%, var(--brand) 100%)"
            : `color-mix(in srgb, ${accent} 18%, transparent)`,
          borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
        }}
      >
        {action.cta}
      </Link>

      <p className="mt-2 text-center text-[length:var(--fs-micro)] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {action.note}
      </p>

      {action.source ? (
        <p
          className="mt-2 rounded-full border px-3 py-1 text-center text-[length:var(--fs-nano)]"
          style={{
            color: "color-mix(in srgb, var(--state-warning) 80%, var(--text-muted))",
            borderColor: "color-mix(in srgb, var(--state-warning) 26%, transparent)",
            background: "color-mix(in srgb, var(--state-warning) 10%, transparent)",
          }}
        >
          {action.source}
        </p>
      ) : null}
    </div>
  );
};

// Right column: stage-aware backing panel + related posts + comments-only panel
const DetailRightColumn = ({
  currentPost,
  items,
  onChangePostId,
}: {
  currentPost: PostRecord;
  items: PostRecord[];
  onChangePostId?: (postId: string) => void;
}) => {
  const { t } = useI18n();

  // Related posts: exclude current, up to 4
  const related = items.filter((item) => item.id !== currentPost.id).slice(0, 4);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Scrollable upper area: creator + Follow + stage-aware backing + Related.
          Creator/Follow live ONLY here (the comments panel no longer repeats them). */}
      <div className="overflow-y-auto">
        <div className="px-3 pt-3">
          <CreatorBackingPanel post={currentPost} />
        </div>

        {/* Related posts */}
        {related.length > 0 ? (
          <div className="mt-3 pb-2">
            <p className="px-4 pb-2 text-[length:var(--fs-caption)] font-semibold text-[#8ea0ba]">
              {t("backing.related")}
            </p>
            <div className="flex flex-col">
              {related.map((item) => (
                <RelatedPostRow key={item.id} onClick={onChangePostId} post={item} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="my-1 h-px bg-white/[0.045]" />
      </div>

      {/* Comments only — post title/body/actions live in the left media column */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <DynamicCommentPanel post={currentPost} showPostContent={false} />
      </div>
    </div>
  );
};

const RelatedPostRow = ({
  post,
  onClick,
}: {
  post: PostRecord;
  onClick?: (postId: string) => void;
}) => {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-2 transition hover:bg-white/[0.04]">
      <div className="relative h-[58px] w-[88px] flex-none overflow-hidden rounded-[8px] bg-[#091019]">
        <ProgressiveImage
          alt={post.title}
          className="object-cover"
          fill
          sizes="88px"
          src={post.coverSrc}
        />
        {post.type === "VIDEO" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="text-[10px] text-white/80">▶</span>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[length:var(--fs-caption)] leading-5 text-[#e0e8f4]">{post.title}</p>
        <p className="mt-1 truncate text-[length:var(--fs-nano)] text-[#7a8ba5]">{post.creatorName}</p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button className="w-full text-left" onClick={() => onClick(post.id)} type="button">
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/posts/${post.id}`}>
      {inner}
    </Link>
  );
};
