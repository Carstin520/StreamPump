import Link from "next/link";

import { compactNumber, findCreator, formatUsd, PostRecord } from "@/lib/mock-data";

const stageLabel: Record<PostRecord["stage"], string | null> = {
  NONE: null,
  S1_DISCOVERY: "S1",
  S1_BUYOUT: "S1 BUYOUT",
  S2_ACTIVE: "S2",
};

const stageGlow: Record<PostRecord["stage"], string> = {
  NONE: "shadow-[0_18px_44px_rgba(0,0,0,0.18)]",
  S1_DISCOVERY: "shadow-[0_18px_44px_rgba(0,0,0,0.2),0_0_26px_rgba(74,153,255,0.08)]",
  S1_BUYOUT: "shadow-[0_18px_44px_rgba(0,0,0,0.2),0_0_26px_rgba(255,89,147,0.07)]",
  S2_ACTIVE: "shadow-[0_18px_44px_rgba(0,0,0,0.2),0_0_26px_rgba(42,211,138,0.06)]",
};

export const PostCard = ({ post }: { post: PostRecord }) => {
  const creator = findCreator(post.creatorId);
  const pseudoViews = post.type === "VIDEO" ? post.likes * 78 : post.likes * 52;

  return (
    <Link
      className={`mb-6 inline-block w-full break-inside-avoid rounded-[30px] bg-[linear-gradient(180deg,rgba(15,21,32,0.62)_0%,rgba(10,16,24,0.54)_100%)] p-2.5 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:shadow-[0_26px_58px_rgba(0,0,0,0.3)] ${stageGlow[post.stage]}`}
      href={`/posts/${post.id}`}
    >
      <div className={`relative overflow-hidden rounded-[19px] ${post.mediaHeightClass} ${post.mediaStyle}`}>
        <img
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover"
          src={post.coverSrc}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08111c]/72 via-transparent to-transparent" />

        {stageLabel[post.stage] ? (
          <div className="liquid-pill absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
            {stageLabel[post.stage]}
          </div>
        ) : null}

        <div className="liquid-pill absolute right-3 top-3 flex items-center gap-2 rounded-[16px] px-3 py-2 text-white">
          <MetricOverlay label="Likes" value={compactNumber(post.likes)} />
          <div className="h-6 w-px bg-white/14" />
          <MetricOverlay label="Views" value={compactNumber(pseudoViews)} />
        </div>

        {(post.type === "VIDEO" || post.hasMultipleImages) ? (
          <div className="liquid-pill absolute left-3 top-14 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
            {post.type === "VIDEO" ? "video" : "multi"}
          </div>
        ) : null}
      </div>

      <div className="px-2.5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <img
            alt={post.creatorName}
            className="h-8 w-8 rounded-full object-cover"
            src={post.creatorAvatarSrc}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#f5f8ff]">{post.creatorName}</p>
            <p className="truncate text-xs text-[#90a2be]">{post.creatorHandle}</p>
          </div>
          <span className="text-xs text-[#8fa1bb]">♡ {compactNumber(post.likes)}</span>
        </div>

        <p className="mt-3 line-clamp-2 text-[17px] font-medium leading-7 text-[#f4f7fd]">{post.title}</p>

        <div className="liquid-card mt-4 grid grid-cols-3 gap-2 rounded-[18px] p-3">
          {post.stage === "S1_DISCOVERY" ? (
            <>
              <MetricRow label="Price" value={formatUsd(creator.tokenPrice)} />
              <MetricRow label="Holders" value={compactNumber(creator.holderCount)} />
              <MetricRow label="Progress" value={`${creator.graduationProgress}%`} />
            </>
          ) : null}
          {post.stage === "S1_BUYOUT" ? (
            <>
              <MetricRow label="Pool" value={formatUsd(creator.supporterDistributableUsd ?? 0)} />
              <MetricRow label="Offer" value={formatUsd(creator.buyoutOfferUsd ?? 0)} />
              <MetricRow label="Holders" value={compactNumber(creator.holderCount)} />
            </>
          ) : null}
          {post.stage === "S2_ACTIVE" ? (
            <>
              <MetricRow label="Price" value={formatUsd(creator.tokenPrice)} />
              <MetricRow label="Holders" value={compactNumber(creator.holderCount)} />
              <MetricRow label="Activity" value={String(creator.activityScore ?? 0)} />
            </>
          ) : null}
          {post.stage === "NONE" ? (
            <>
              <MetricRow label="Likes" value={compactNumber(post.likes)} />
              <MetricRow label="Saves" value={compactNumber(post.saves)} />
              <MetricRow label="Discuss" value={compactNumber(post.commentsCount)} />
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
};

const MetricOverlay = ({ label, value }: { label: string; value: string }) => (
  <div className="text-right">
    <p className="text-base font-semibold leading-none">{value}</p>
    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/72">{label}</p>
  </div>
);

const MetricRow = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <p className="text-[10px] uppercase tracking-[0.16em] text-[#8ea0ba]">{label}</p>
    <p className="mt-1.5 text-[14px] font-semibold text-white">{value}</p>
  </div>
);
