import Link from "next/link";

import { primeHlsJs } from "@/components/shared/hlsPreload";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { PostRecord } from "@/lib/api/types";
import { compactNumber } from "@/lib/public-data";

const stageGlow: Record<PostRecord["stage"], string> = {
  NONE: "",
  S1_DISCOVERY: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(103,184,255,0.06)]",
  S1_BUYOUT: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(222,64,42,0.06)]",
  S2_ACTIVE: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(101,236,175,0.05)]",
};

export const PostCard = ({
  post,
  priority = false,
  onClick,
  onPreview,
}: {
  post: PostRecord;
  priority?: boolean;
  onClick?: () => void;
  onPreview?: () => void;
}) => {
  const handlePreview = () => {
    onPreview?.();

    if (post.type === "VIDEO") {
      void primeHlsJs();
    }
  };

  const inner = (
    <article className="glass-card relative overflow-hidden border-white/[0.06] bg-[#101621]">
      <div className={`relative overflow-hidden ${post.mediaHeightClass} ${post.mediaStyle}`}>
        <ProgressiveImage
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
          fill
          loadingEffect="feed"
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          src={post.coverSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_40%,rgba(8,17,28,0.36)_64%,rgba(8,17,28,0.82)_100%)]" />

        <div className="absolute left-3 top-3 z-[2]">
          <StagePill stage={post.stage} />
        </div>

        {(post.type === "VIDEO" || post.hasMultipleImages) ? (
          <div className="absolute right-3 top-3 z-[2] flex h-8 min-w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 px-2 text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-white backdrop-blur-md">
            {post.type === "VIDEO" ? "▶" : "•••"}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-[2] bg-[linear-gradient(180deg,rgba(8,12,30,0.2)_0%,rgba(8,12,30,0.82)_100%)] px-4 pb-3 pt-3 backdrop-blur-[18px]">
          <p className="line-clamp-2 text-[length:var(--fs-sm)] font-medium leading-6 text-[#f6f8fd]">{post.title}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <img alt={post.creatorName} className="h-6 w-6 rounded-full object-cover" src={post.creatorAvatarSrc} />
              <span className="truncate text-[length:var(--fs-caption)] text-[#cbd7e8]">{post.creatorName}</span>
            </div>
            <span className="shrink-0 text-[length:var(--fs-caption)] text-[#8ea0ba]">
              {post.likes > 0 ? `♡ ${compactNumber(post.likes)}` : "metrics pending"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );

  if (onClick) {
    return (
      <button
        className={`feed-masonry-item mb-4 inline-block w-full break-inside-avoid text-left ${stageGlow[post.stage]}`}
        onFocus={handlePreview}
        onMouseEnter={handlePreview}
        onClick={onClick}
        type="button"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      className={`feed-masonry-item mb-4 inline-block w-full break-inside-avoid ${stageGlow[post.stage]}`}
      href={`/posts/${post.id}`}
      onFocus={handlePreview}
      onMouseEnter={handlePreview}
    >
      {inner}
    </Link>
  );
};
