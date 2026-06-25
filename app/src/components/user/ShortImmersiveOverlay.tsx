import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import { MediaVideoPlayer } from "@/components/shared/MediaVideoPlayer";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { PostRecord } from "@/lib/api/types";
import { requireInteractiveSession } from "@/lib/interaction-auth";
import { useI18n } from "@/lib/i18n";

export const ShortImmersiveOverlay = ({
  shorts,
  currentPostId,
  onChangePostId,
  onClose,
}: {
  shorts: PostRecord[];
  currentPostId: string | null;
  onChangePostId: (id: string) => void;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  const router = useRouter();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const currentIndex = shorts.findIndex((s) => s.id === currentPostId);
  const post = currentIndex !== -1 ? shorts[currentIndex] : null;

  const goTo = useCallback(
    (delta: number) => {
      const next = currentIndex + delta;
      if (next >= 0 && next < shorts.length) {
        onChangePostId(shorts[next].id);
      }
    },
    [currentIndex, shorts, onChangePostId],
  );

  // Keyboard nav + Esc
  useEffect(() => {
    if (!currentPostId) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowUp") {
        goTo(-1);
      } else if (e.key === "ArrowDown") {
        goTo(1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPostId, onClose, goTo]);

  if (!currentPostId || !post) {
    return null;
  }

  const isLiked = likedIds.has(post.id);

  const handleLike = () => {
    if (!requireInteractiveSession(router)) return;
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(post.id)) {
        next.delete(post.id);
      } else {
        next.add(post.id);
      }
      return next;
    });
  };

  const backHref =
    post.stage !== "NONE"
      ? `/market/${post.creatorId}`
      : `/creators/${post.creatorId}`;

  const backLabel =
    post.stage !== "NONE" ? t("feed.shortBack") : t("feed.shortViewCreator");

  const backIcon = post.stage !== "NONE" ? "⚡" : "→";

  const isBackActive = post.stage !== "NONE";

  return (
    <div
      aria-modal
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 sm:px-6"
      role="dialog"
      style={{ background: "rgba(6,9,14,0.82)", backdropFilter: "blur(14px)" }}
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Close button */}
      <button
        aria-label={t("common.close")}
        className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-black/60 text-[15px] text-white backdrop-blur-md transition hover:bg-white/10"
        onClick={onClose}
        type="button"
      >
        ✕
      </button>

      {/* Content row */}
      <div className="relative z-10 flex items-stretch gap-3.5">
        {/* Vertical video card */}
        <div
          className="relative w-[316px] shrink-0 overflow-hidden rounded-[18px]"
          style={{
            height: "clamp(320px, 78vh, 640px)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          {post.videoSrc ? (
            <MediaVideoPlayer
              autoPlay
              controls={false}
              loop
              muted
              playsInline
              posterSrc={post.coverSrc}
              src={post.videoSrc}
              videoClassName="h-full w-full object-cover"
            />
          ) : (
            <ProgressiveImage
              alt={post.title}
              className="object-cover"
              fill
              sizes="316px"
              src={post.coverSrc}
            />
          )}

          {/* Caption overlay */}
          <div
            className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12"
            style={{
              background:
                "linear-gradient(180deg, transparent, rgba(0,0,0,0.76))",
            }}
          >
            {/* Creator row */}
            <div className="flex items-center gap-2">
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-[1.5px] border-white">
                <ProgressiveImage
                  alt={post.creatorName}
                  className="object-cover"
                  fill
                  sizes="28px"
                  src={post.creatorAvatarSrc}
                />
              </div>
              <span className="text-[13px] font-bold text-white">
                {post.creatorName}
              </span>
              {post.stage !== "NONE" && (
                <span className="text-[length:var(--fs-nano)] text-[#67b8ff]">
                  {post.stage === "S1_DISCOVERY"
                    ? "S1"
                    : post.stage === "S1_BUYOUT"
                      ? "BUYOUT"
                      : "S2"}
                </span>
              )}
            </div>

            {/* Caption text */}
            <p className="mt-2 text-[12.5px] leading-snug text-white/92 line-clamp-2">
              {post.title}
            </p>
          </div>
        </div>

        {/* Right action rail */}
        <div className="flex flex-col items-center justify-center gap-[18px]">
          {/* Like */}
          <RailButton
            icon="♥"
            label={String(post.likes + (isLiked ? 1 : 0))}
            active={isLiked}
            activeTone="liked"
            onClick={handleLike}
          />

          {/* Comment */}
          <RailButton
            icon="💬"
            label={String(post.commentsCount)}
            onClick={() => {}}
          />

          {/* Share */}
          <RailButton icon="↗" label={t("feed.share")} onClick={() => {}} />

          {/* Back / View creator */}
          <div className="flex flex-col items-center gap-1">
            <Link href={backHref}>
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-[19px] transition hover:opacity-90 ${
                  isBackActive
                    ? "border-[rgba(222,122,42,0.5)] bg-[rgba(222,122,42,0.2)] text-[#f0a070]"
                    : "border-white/16 bg-white/6 text-white"
                }`}
              >
                {backIcon}
              </span>
            </Link>
            <span
              className={`block text-center text-[10px] ${
                isBackActive ? "text-[#f0a070]" : "text-[color:var(--text-muted)]"
              }`}
            >
              {backLabel}
            </span>
          </div>

          {/* Up/Down nav */}
          <div className="mt-2 flex flex-col gap-2.5">
            <button
              aria-label="Previous short"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-white/6 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-30"
              disabled={currentIndex === 0}
              onClick={() => goTo(-1)}
              type="button"
            >
              ↑
            </button>
            <button
              aria-label="Next short"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-white/6 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-30"
              disabled={currentIndex === shorts.length - 1}
              onClick={() => goTo(1)}
              type="button"
            >
              ↓
            </button>
          </div>
        </div>

        {/* Comment panel — visible lg+ */}
        <div
          className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-[18px] border border-white/[0.07] p-4 lg:flex"
          style={{
            height: "clamp(320px, 78vh, 640px)",
            background:
              "linear-gradient(180deg, rgba(20,28,41,0.86), rgba(11,16,25,0.82))",
          }}
        >
          <h4 className="shrink-0 border-b border-white/[0.07] pb-3 text-[13px] font-bold text-white">
            {t("feed.shortComments")}{" "}
            <span className="tabular-nums">{post.commentsCount}</span>
          </h4>
          <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto pt-3.5 [scrollbar-width:thin]">
            {post.comments.length > 0 ? (
              post.comments.map((c) => (
                <div className="flex gap-2.5" key={c.id}>
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/12 bg-[rgba(42,51,70,1)]">
                    {c.avatarSrc ? (
                      <ProgressiveImage
                        alt={c.author}
                        className="object-cover"
                        fill
                        sizes="32px"
                        src={c.avatarSrc}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[length:var(--fs-caption)] text-[color:var(--text-faint)]">
                      {c.author}
                    </span>
                    <p className="mt-0.5 text-[13px] leading-snug text-[#dbe3ef]">
                      {c.content}
                    </p>
                    <span className="mt-1 block text-[10.5px] text-[#5d6b82]">
                      {c.timeLabel} · {c.likes}♥
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[length:var(--fs-caption)] text-[color:var(--text-faint)]">
                {t("feed.commentPlaceholder")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

type RailButtonProps = {
  icon: string;
  label: string;
  active?: boolean;
  activeTone?: "liked";
  onClick: () => void;
};

const RailButton = ({
  icon,
  label,
  active,
  activeTone,
  onClick,
}: RailButtonProps) => {
  const activeClass =
    activeTone === "liked"
      ? "bg-[rgba(222,64,42,0.2)] border-[rgba(222,64,42,0.5)] text-[#ff8a78]"
      : "bg-white/10 border-white/16 text-white";

  const idleClass = "bg-white/6 border-white/16 text-white hover:bg-white/12";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        className={`flex h-12 w-12 items-center justify-center rounded-full border text-[19px] transition ${
          active ? activeClass : idleClass
        }`}
        onClick={onClick}
        type="button"
      >
        {icon}
      </button>
      <span className="block text-center text-[10px] text-[color:var(--text-muted)]">
        {label}
      </span>
    </div>
  );
};
