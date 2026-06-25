import Link from "next/link";

import { primeHlsJs } from "@/components/shared/hlsPreload";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { compactNumber } from "@/lib/public-data";

const stageGlow: Record<PostRecord["stage"], string> = {
  NONE: "",
  S1_DISCOVERY: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(103,184,255,0.06)]",
  S1_BUYOUT: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(222,64,42,0.06)]",
  S2_ACTIVE: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(101,236,175,0.05)]",
};

// Energy chip: ⚡S1 / ⚡S1 BUYOUT / ⚡S2 labels with stage color
const stageTailColor: Record<Exclude<PostRecord["stage"], "NONE">, string> = {
  S1_DISCOVERY: "var(--stage-s1)",
  S1_BUYOUT: "var(--stage-buyout)",
  S2_ACTIVE: "var(--stage-s2)",
};

const stageTailLabel: Record<Exclude<PostRecord["stage"], "NONE">, string> = {
  S1_DISCOVERY: "S1",
  S1_BUYOUT: "S1 ✦",
  S2_ACTIVE: "S2",
};

const EnergyTailChip = ({ stage }: { stage: PostRecord["stage"] }) => {
  if (stage === "NONE") return null;

  const color = stageTailColor[stage];
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[length:var(--fs-nano)] font-semibold"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
      }}
    >
      <span>⚡</span>
      <span>{stageTailLabel[stage]}</span>
    </span>
  );
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
  const { t } = useI18n();
  const imageCount = post.gallerySrcs?.length ?? 0;
  // Fallback box height parsed from the Tailwind height class (e.g. "h-[420px]").
  // Applied as an inline style so the media box ALWAYS has a definite height and
  // clips its image even if the global stylesheet (Tailwind) fails to load — this
  // prevents the first card's image layer from blowing out and covering the viewport.
  const mediaHeightPx = Number(post.mediaHeightClass.match(/(\d+)px/)?.[1]) || 360;

  const handlePreview = () => {
    onPreview?.();

    if (post.type === "VIDEO") {
      void primeHlsJs();
    }
  };

  const inner = (
    <article className="glass-card relative overflow-hidden border-white/[0.06] bg-[#101621]">
      <div
        className={`relative overflow-hidden ${post.mediaHeightClass} ${post.mediaStyle}`}
        style={{ position: "relative", overflow: "hidden", height: mediaHeightPx }}
      >
        <ProgressiveImage
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
          fill
          loadingEffect="feed"
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          src={post.coverSrc}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_40%,rgba(8,17,28,0.36)_64%,rgba(8,17,28,0.82)_100%)]" />

        <div className="absolute left-3 top-3 z-[2]">
          <StagePill stage={post.stage} />
        </div>

        {/* Top-right: video duration, or multi-image count (▤ N 图) */}
        {post.type === "VIDEO" && post.durationLabel ? (
          <div className="absolute right-3 top-3 z-[2] rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[length:var(--fs-nano)] text-white backdrop-blur-md">
            {post.durationLabel}
          </div>
        ) : post.hasMultipleImages && imageCount > 1 ? (
          <div className="absolute right-3 top-3 z-[2] flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[length:var(--fs-nano)] font-medium text-white backdrop-blur-md">
            <span aria-hidden>▤</span>
            <span>{t("feed.imageCount", { count: String(imageCount) })}</span>
          </div>
        ) : null}

        {/* Centered circular play button for video */}
        {post.type === "VIDEO" ? (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/25 backdrop-blur-md">
              <svg className="ml-0.5 h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-[2] bg-[linear-gradient(180deg,rgba(8,12,30,0.2)_0%,rgba(8,12,30,0.82)_100%)] px-4 pb-3 pt-3 backdrop-blur-[18px]">
          <p className="line-clamp-2 text-[length:var(--fs-sm)] font-medium leading-6 text-[#f6f8fd]">{post.title}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <img alt={post.creatorName} className="h-6 w-6 rounded-full object-cover" src={post.creatorAvatarSrc} />
              <span className="truncate text-[length:var(--fs-caption)] text-[#cbd7e8]">{post.creatorName}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[length:var(--fs-caption)] text-[#8ea0ba]">
                {post.likes > 0 ? `♡ ${compactNumber(post.likes)}` : t("feed.metricsPending")}
              </span>
              <EnergyTailChip stage={post.stage} />
            </div>
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
