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
import {
  activityAuthors,
  activityFeedItems,
  activityFeedTabs,
  activitySidebarHighlights,
  activityVideoItems,
  compactNumber,
  findCreator,
} from "@/lib/public-data";

const ALL_ACTIVITY = "all";

export const ActivitySurface = () => {
  const [activeTab, setActiveTab] = useState<ActivityTab>("overview");
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(ALL_ACTIVITY);

  const visibleFeedItems = activityFeedItems.filter((item) =>
    selectedCreatorId === ALL_ACTIVITY ? true : item.creatorId === selectedCreatorId,
  );
  const visibleVideoItems = activityVideoItems.filter((item) =>
    selectedCreatorId === ALL_ACTIVITY ? true : item.creatorId === selectedCreatorId,
  );

  return (
    <PageShell searchPlaceholder="搜索动态、创作者、视频">
      <div className="mx-auto max-w-[1400px] py-6">
        <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-3">
              <button
                className={`card-radius flex w-full items-center justify-between border px-4 py-3 text-left transition ${
                  selectedCreatorId === ALL_ACTIVITY
                    ? "border-white/[0.12] bg-white/[0.08] text-white"
                    : "border-white/[0.05] bg-[#101621]/88 text-[#a7b5c9] hover:border-white/[0.1] hover:text-white"
                }`}
                onClick={() => {
                  startTransition(() => setSelectedCreatorId(ALL_ACTIVITY));
                }}
                type="button"
              >
                <span className="text-sm font-medium">全部动态</span>
                <span className="text-xs text-[#7f91ab]">{activityFeedItems.length}</span>
              </button>

              <div className="card-radius border border-white/[0.05] bg-[#0f1521]/90 p-2">
                {activityAuthors.map((author) => {
                  const creator = findCreator(author.creatorId);
                  const isActive = selectedCreatorId === creator.id;

                  return (
                    <button
                      className={`card-radius flex w-full items-center gap-3 px-3 py-3 text-left transition ${
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
                        <img alt={creator.name} className="h-10 w-10 rounded-full object-cover" src={creator.avatarSrc} />
                        {author.hasUnread ? (
                          <span className="absolute -right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-[#de402a] shadow-[0_0_16px_rgba(222,64,42,0.7)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{creator.name}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-[#7487a3]">{author.note}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f90ab]">Following feed</p>
                <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.05em] text-white">动态</h1>
                <p className="mt-2 text-sm text-[#8ea0ba]">
                  Follow-first updates from creators you already care about.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#101621]/88 p-1">
                {activityFeedTabs.map((tab) => (
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? "bg-white/[0.08] text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
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

            {activeTab === "overview" ? (
              <div className="space-y-4">
                {visibleFeedItems.map((item) => {
                  const creator = findCreator(item.creatorId);

                  return (
                    <article className="liquid-panel card-radius overflow-hidden px-5 py-5" key={item.id}>
                      <div className="flex items-start justify-between gap-4">
                        <Link className="flex min-w-0 items-center gap-3" href={`/creators/${creator.id}`}>
                          <img alt={creator.name} className="h-11 w-11 rounded-full object-cover" src={creator.avatarSrc} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                              <StagePill compact stage={creator.state} />
                            </div>
                            <p className="mt-1 text-xs text-[#7e90aa]">
                              {creator.handle} · {item.postedAtLabel}
                            </p>
                          </div>
                        </Link>

                        <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[#7f90ab]">
                          {item.kind === "post" ? "POST" : "UPDATE"}
                        </span>
                      </div>

                      <Link className="mt-4 block" href={`/posts/${item.postId}`}>
                        {item.title ? (
                          <h2 className="max-w-3xl text-[23px] font-semibold leading-[1.24] tracking-[-0.04em] text-white">
                            {item.title}
                          </h2>
                        ) : null}
                        <p className="mt-3 max-w-3xl text-[15px] leading-8 text-[#d4deec]">{item.body}</p>
                        <p className="mt-3 text-sm text-[#de7a68]">{item.actionSummary}</p>

                        {item.coverSrc ? (
                          <div className="card-radius mt-4 overflow-hidden border border-white/[0.06] bg-[#0b1019]">
                            <div className="relative h-[230px] md:h-[320px]">
                              <ProgressiveImage
                                alt={item.title ?? creator.name}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
                                fill
                                sizes="(max-width: 1024px) 100vw, 720px"
                                src={item.coverSrc}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#08111c]/62 via-transparent to-transparent" />
                              <div className="absolute left-4 top-4">
                                <StagePill stage={item.stage} />
                              </div>
                              {item.mediaType === "VIDEO" && item.durationLabel ? (
                                <div className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                                  {item.durationLabel}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </Link>

                      <div className="mt-4 flex items-center gap-6 border-t border-white/[0.05] pt-4 text-sm text-[#90a1ba]">
                        <FeedStat
                          icon={<CommentBubbleIcon className="h-4 w-4" />}
                          value={compactNumber(item.commentsCount)}
                        />
                        <FeedStat
                          icon={<HeartOutlineIcon className="h-4 w-4" />}
                          value={compactNumber(item.likesCount)}
                        />
                        <FeedStat
                          icon={<SendRoundedIcon className="h-4 w-4" />}
                          value={compactNumber(item.sharesCount)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {activeTab === "video" ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {visibleVideoItems.map((item) => {
                  const creator = findCreator(item.creatorId);

                  return (
                    <Link
                      className="group block overflow-hidden"
                      href={`/posts/${item.postId}`}
                      key={item.id}
                    >
                      <article className="glass-card overflow-hidden border-white/[0.06] bg-[#101621]">
                        <div className="relative h-[190px] overflow-hidden">
                          <ProgressiveImage
                            alt={item.title}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                            src={item.coverSrc}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#070d15]/88 via-[#070d15]/15 to-transparent" />
                          <div className="absolute left-3 top-3">
                            <StagePill compact stage={creator.state} />
                          </div>
                          <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs text-white">
                            <span>▶ {compactNumber(item.viewsCount)}</span>
                            <span>◌ {compactNumber(item.commentsCount)}</span>
                          </div>
                          {item.durationLabel ? (
                            <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                              {item.durationLabel}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3 px-4 py-4">
                          <p className="line-clamp-2 text-[15px] font-medium leading-6 text-white">{item.title}</p>
                          <div className="flex items-center justify-between gap-3 text-xs text-[#8fa1bb]">
                            <div className="flex min-w-0 items-center gap-2">
                              <img alt={creator.name} className="h-6 w-6 rounded-full object-cover" src={creator.avatarSrc} />
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
            <div className="sticky top-24 space-y-3">
              <div className="card-radius border border-white/[0.05] bg-[#101621]/88 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">关注中的活跃创作者</p>
                    <p className="mt-1 text-xs text-[#7d8faa]">Keep an eye on creators already shaping your feed.</p>
                  </div>
                  <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8b9cb7]">
                    {activitySidebarHighlights.length}
                  </span>
                </div>
              </div>

              <div className="card-radius border border-white/[0.05] bg-[#101621]/88 p-2">
                {activitySidebarHighlights.map((item) => {
                  const creator = findCreator(item.creatorId);

                  return (
                    <Link
                      className="card-radius flex items-start gap-3 px-3 py-3 transition hover:bg-white/[0.04]"
                      href={`/creators/${creator.id}`}
                      key={item.creatorId}
                    >
                      <img alt={creator.name} className="h-10 w-10 rounded-full object-cover" src={creator.avatarSrc} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{creator.name}</p>
                          <StagePill compact stage={creator.state} />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#cbd6e7]">{item.headline}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#7f90ab]">{item.statusLabel}</p>
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
