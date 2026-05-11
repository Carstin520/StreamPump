import Link from "next/link";
import type { ReactNode } from "react";
import { startTransition, useState } from "react";

import {
  CommentBubbleIcon,
  HeartOutlineIcon,
  SendRoundedIcon,
} from "@/components/shared/AppIcons";
import { PageShell } from "@/components/layout/PageShell";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { ActivityTab } from "@/lib/api/types";
import { PostRecord } from "@/lib/api/types";
import { compactNumber } from "@/lib/public-data";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";

const ALL_ACTIVITY = "all";

export const ActivitySurface = ({
  initialError = null,
  initialPosts = [],
}: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>("overview");
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(ALL_ACTIVITY);
  const {
    activityAuthors,
    activityFeedItems,
    activityFeedTabs,
    activitySidebarHighlights,
    activityVideoItems,
    creatorMap,
    error,
    loading,
  } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });

  const visibleFeedItems = activityFeedItems.filter((item) =>
    selectedCreatorId === ALL_ACTIVITY ? true : item.creatorId === selectedCreatorId,
  );
  const visibleVideoItems = activityVideoItems.filter((item) =>
    selectedCreatorId === ALL_ACTIVITY ? true : item.creatorId === selectedCreatorId,
  );

  return (
    <PageShell searchPlaceholder="搜索动态、创作者、视频">
      <div className="mx-auto max-w-[1400px] py-4">
        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-2.5">
              <button
                className={`card-radius liquid-card flex w-full items-center justify-between border px-3.5 py-2.5 text-left transition ${
                  selectedCreatorId === ALL_ACTIVITY
                    ? "border-white/[0.12] bg-white/[0.08] text-white"
                    : "border-white/[0.05] bg-[#101621]/88 text-[#a7b5c9] hover:border-white/[0.1] hover:text-white"
                }`}
                onClick={() => {
                  startTransition(() => setSelectedCreatorId(ALL_ACTIVITY));
                }}
                type="button"
              >
                <span className="text-[13px] font-medium">全部动态</span>
                <span className="text-[11px] text-[#7f91ab]">{activityFeedItems.length}</span>
              </button>

              <div className="liquid-glass-shell p-1.5">
                {activityAuthors.map((author) => {
                  const creator = creatorMap.get(author.creatorId);
                  if (!creator) {
                    return null;
                  }
                  const isActive = selectedCreatorId === creator.id;

                  return (
                    <button
                      className={`card-radius flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition ${
                        isActive
                          ? "bg-white/[0.08] text-white"
                          : "text-[#9aacbf] hover:bg-white/[0.04] hover:text-white"
                      }`}
                      key={creator.id}
                      onClick={() => {
                        startTransition(() => setSelectedCreatorId(creator.id));
                      }}
                      type="button"
                    >
                      <div className="relative">
                        <img alt={creator.name} className="h-8 w-8 rounded-full object-cover" src={creator.avatarSrc} />
                        {author.hasUnread ? (
                          <span className="absolute -right-0.5 top-0 h-2 w-2 rounded-full bg-[#de402a] shadow-[0_0_12px_rgba(222,64,42,0.7)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{creator.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#7487a3]">{author.note}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div className="flex items-baseline gap-3">
                <h1 className="text-[22px] font-semibold tracking-[-0.04em] text-white">动态</h1>
                <p className="hidden text-xs text-[#7f90ab] md:block">
                  Follow-first updates from creators you already care about.
                </p>
              </div>

              <div className="glass-toolbar flex items-center gap-1 p-0.5">
                {activityFeedTabs.map((tab) => (
                  <button
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === tab.id
                        ? "glass-button-primary text-white"
                        : "text-[#8192ac] hover:text-white"
                    }`}
                    key={tab.id}
                    onClick={() => {
                      startTransition(() => setActiveTab(tab.id));
                    }}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <div className="text-sm text-[#8ea0ba]">Loading imported activity…</div> : null}

            {!loading && error ? <div className="text-sm text-[#8ea0ba]">{error}</div> : null}

            {!loading && !error && activeTab === "overview" ? (
              <div className="space-y-2.5">
                {visibleFeedItems.map((item, index) => {
                  const creator = creatorMap.get(item.creatorId);
                  if (!creator) {
                    return null;
                  }

                  return (
                    <article className="liquid-glass-shell card-radius overflow-hidden px-4 py-3.5" key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <Link className="flex min-w-0 items-center gap-2.5" href={`/creators/${creator.id}`}>
                          <img alt={creator.name} className="h-9 w-9 rounded-full object-cover" src={creator.avatarSrc} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13px] font-semibold text-white">{creator.name}</p>
                              <StagePill compact stage={creator.state} />
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-[#7e90aa]">
                              {creator.handle} · {item.postedAtLabel}
                            </p>
                          </div>
                        </Link>

                        <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#7f90ab]">
                          {item.kind === "post" ? "POST" : "UPDATE"}
                        </span>
                      </div>

                      <Link className="mt-3 block" href={`/posts/${item.postId}`}>
                        {item.title ? (
                          <h2 className="line-clamp-2 text-[16px] font-semibold leading-[1.3] tracking-[-0.02em] text-white">
                            {item.title}
                          </h2>
                        ) : null}
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-[#bcc8de]">{item.body}</p>
                        <p className="mt-1.5 text-[11px] text-[#de7a68]">{item.actionSummary}</p>

                        {item.coverSrc ? (
                          <div className="card-radius mt-3 overflow-hidden border border-white/[0.06] bg-[#0b1019]">
                            <div className="relative aspect-[16/9] max-h-[220px] w-full">
                              <ProgressiveImage
                                alt={item.title ?? creator.name}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
                                fill
                                priority={index === 0}
                                sizes="(max-width: 1024px) 100vw, 720px"
                                src={item.coverSrc}
                              />
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,28,0.05)_0%,transparent_30%,transparent_60%,rgba(8,17,28,0.4)_100%)]" />
                              {item.mediaType === "VIDEO" && item.durationLabel ? (
                                <div className="absolute bottom-2.5 right-2.5 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                                  {item.durationLabel}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </Link>

                      <div className="mt-3 flex items-center gap-5 border-t border-white/[0.05] pt-2.5 text-xs text-[#90a1ba]">
                        <FeedStat
                          icon={<CommentBubbleIcon className="h-3.5 w-3.5" />}
                          value={compactNumber(item.commentsCount)}
                        />
                        <FeedStat
                          icon={<HeartOutlineIcon className="h-3.5 w-3.5" />}
                          value={compactNumber(item.likesCount)}
                        />
                        <FeedStat
                          icon={<SendRoundedIcon className="h-3.5 w-3.5" />}
                          value={compactNumber(item.sharesCount)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!loading && !error && activeTab === "video" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {visibleVideoItems.map((item, index) => {
                  const creator = creatorMap.get(item.creatorId);
                  if (!creator) {
                    return null;
                  }

                  return (
                    <Link
                      className="group block overflow-hidden"
                      href={`/posts/${item.postId}`}
                      key={item.id}
                    >
                      <article className="glass-card overflow-hidden border-white/[0.06] bg-[#101621]">
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <ProgressiveImage
                            alt={item.title}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            fill
                            priority={index < 2}
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                            src={item.coverSrc}
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_40%,rgba(7,13,21,0.36)_70%,rgba(7,13,21,0.78)_100%)]" />
                          <div className="absolute left-2.5 top-2.5">
                            <StagePill compact stage={creator.state} />
                          </div>
                          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2.5 text-[11px] text-white">
                            <span>▶ {compactNumber(item.viewsCount)}</span>
                            <span>◌ {compactNumber(item.commentsCount)}</span>
                          </div>
                          {item.durationLabel ? (
                            <div className="absolute bottom-2.5 right-2.5 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                              {item.durationLabel}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-2 px-3 py-3">
                          <p className="line-clamp-2 text-[13px] font-medium leading-5 text-white">{item.title}</p>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#8fa1bb]">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <img alt={creator.name} className="h-5 w-5 rounded-full object-cover" src={creator.avatarSrc} />
                              <span className="truncate">{creator.name}</span>
                            </div>
                            <span className="shrink-0">{item.timeLabel}</span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>

          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-2.5">
              <div className="liquid-glass-shell card-radius px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-white">关注中的活跃创作者</p>
                    <p className="mt-0.5 text-[11px] text-[#7d8faa]">Creators already shaping your feed.</p>
                  </div>
                  <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#8b9cb7]">
                    {activitySidebarHighlights.length}
                  </span>
                </div>
              </div>

              <div className="liquid-glass-shell card-radius p-1.5">
                {activitySidebarHighlights.map((item) => {
                  const creator = creatorMap.get(item.creatorId);
                  if (!creator) {
                    return null;
                  }

                  return (
                    <Link
                      className="card-radius flex items-start gap-2.5 px-2.5 py-2.5 transition hover:bg-white/[0.04]"
                      href={`/creators/${creator.id}`}
                      key={item.creatorId}
                    >
                      <img alt={creator.name} className="h-8 w-8 rounded-full object-cover" src={creator.avatarSrc} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-medium text-white">{creator.name}</p>
                          <StagePill compact stage={creator.state} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[#cbd6e7]">{item.headline}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#7f90ab]">{item.statusLabel}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
};

const FeedStat = ({
  icon,
  value,
}: {
  icon: ReactNode;
  value: string;
}) => (
  <span className="flex items-center gap-2">
    <span className="text-[#8194af]">{icon}</span>
    <span>{value}</span>
  </span>
);
