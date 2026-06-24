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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
    <PageShell searchPlaceholder={t("feed.searchActivityPlaceholder")}>
      <div className="mx-auto max-w-[1400px] space-y-4 py-4">
        <ActivitySourceNotice error={error} />
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
                <span className="text-[length:var(--fs-caption)] font-medium">{t("feed.allActivity")}</span>
                <span className="text-[length:var(--fs-micro)] text-[#7f91ab]">{activityFeedItems.length}</span>
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
                        <p className="truncate text-[length:var(--fs-caption)] font-medium">{creator.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[length:var(--fs-micro)] text-[#7487a3]">{author.note}</p>
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
                <h1 className="type-h3 font-semibold text-white">{t("common.activity")}</h1>
                <p className="hidden text-xs text-[#7f90ab] md:block">
                  {t("feed.followFirst")}
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
                    {tab.id === "overview" ? t("feed.tabs.overview") : t("feed.tabs.video")}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <div className="text-sm text-[#8ea0ba]">{t("feed.loadingActivity")}</div> : null}

            {!loading && error ? <div className="text-sm text-[#8ea0ba]">{error}</div> : null}

            {!loading && !error && activityFeedItems.length === 0 ? (
              <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
                <p className="font-semibold text-white">{t("feed.emptyTitle")}</p>
                <p className="mt-2 text-[#8ea0ba]">{t("feed.emptyBody")}</p>
              </div>
            ) : null}

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
                              <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{creator.name}</p>
                              <StagePill compact stage={creator.state} />
                            </div>
                            <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7e90aa]">
                              {creator.handle} · {item.postedAtLabel}
                            </p>
                          </div>
                        </Link>

                        <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-[#7f90ab]">
                          {item.kind === "post" ? "POST" : "UPDATE"}
                        </span>
                      </div>

                      <Link className="mt-3 block" href={`/posts/${item.postId}`}>
                        {item.title ? (
                          <h2 className="line-clamp-2 text-[16px] font-semibold leading-[1.3] tracking-[-0.02em] text-white">
                            {item.title}
                          </h2>
                        ) : null}
                        <p className="mt-1.5 line-clamp-2 text-[length:var(--fs-caption)] leading-[1.55] text-[#bcc8de]">{item.body}</p>
                        <p className="mt-1.5 text-[length:var(--fs-micro)] text-[#de7a68]">{item.actionSummary}</p>

                        {item.coverSrc ? (
                          <div className="mt-3 overflow-hidden rounded-lg bg-[#0b1019]">
                            {item.gallerySrcs && item.gallerySrcs.length >= 2 ? (
                              <div className="grid grid-cols-2 gap-1">
                                {item.gallerySrcs.slice(0, 2).map((src, imgIdx) => (
                                  <div className="relative aspect-square overflow-hidden rounded-md" key={imgIdx}>
                                    <ProgressiveImage
                                      alt={`${item.title ?? creator.name} ${imgIdx + 1}`}
                                      className="absolute inset-0 h-full w-full object-cover"
                                      fill
                                      priority={index === 0 && imgIdx === 0}
                                      sizes="(max-width: 1024px) 50vw, 360px"
                                      src={src}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg">
                                <ProgressiveImage
                                  alt={item.title ?? creator.name}
                                  className="absolute inset-0 h-full w-full object-cover"
                                  fill
                                  priority={index === 0}
                                  sizes="(max-width: 1024px) 100vw, 720px"
                                  src={item.coverSrc}
                                />
                                {item.mediaType === "VIDEO" && item.durationLabel ? (
                                  <div className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[length:var(--fs-micro)] font-medium text-white">
                                    {item.durationLabel}
                                  </div>
                                ) : null}
                              </div>
                            )}
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
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {visibleVideoItems.map((item, index) => {
                  const creator = creatorMap.get(item.creatorId);
                  if (!creator) {
                    return null;
                  }

                  return (
                    <Link
                      className="group block"
                      href={`/posts/${item.postId}`}
                      key={item.id}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden rounded-lg">
                        <ProgressiveImage
                          alt={item.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          fill
                          priority={index < 2}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                          src={item.coverSrc}
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-1.5 left-2 z-[2] flex items-center gap-2.5 text-[length:var(--fs-micro)] text-white/80">
                          <span className="flex items-center gap-0.5">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 16 16"><path d="M6.25 4.72a.75.75 0 0 1 1.06-.02l3.22 3.05a.75.75 0 0 1 0 1.08l-3.22 3.05a.75.75 0 0 1-1.03-1.09L8.87 8.2 6.27 5.78a.75.75 0 0 1-.02-1.06Z" /></svg>
                            {compactNumber(item.viewsCount)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <CommentBubbleIcon className="h-3 w-3" />
                            {compactNumber(item.commentsCount)}
                          </span>
                        </div>
                        {item.durationLabel ? (
                          <div className="absolute bottom-1.5 right-2 z-[2] rounded px-1 py-px text-[length:var(--fs-micro)] font-medium leading-4 text-white/90 bg-black/50">
                            {item.durationLabel}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-2 px-0.5">
                        <p className="line-clamp-2 text-[length:var(--fs-caption)] font-normal leading-[1.4] text-[#d1d7e0] group-hover:text-[#67b8ff]">{item.title}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[length:var(--fs-micro)] text-[#9aa8bc]">
                          <img alt={creator.name} className="h-5 w-5 rounded-full object-cover" src={creator.avatarSrc} />
                          <span className="truncate">{creator.name}</span>
                          <span className="text-[#4a5568]">·</span>
                          <span className="shrink-0">{item.timeLabel}</span>
                        </div>
                      </div>
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
                    <p className="text-[length:var(--fs-caption)] font-semibold text-white">{t("feed.activeCreators")}</p>
                    <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7d8faa]">{t("feed.activeCreatorsDesc")}</p>
                  </div>
                  <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-[#8b9cb7]">
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
                          <p className="truncate text-[length:var(--fs-caption)] font-medium text-white">{creator.name}</p>
                          <StagePill compact stage={creator.state} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[length:var(--fs-overline)] leading-[1.5] text-[#cbd6e7]">{item.headline}</p>
                        <p className="mt-1 text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-[#7f90ab]">{item.statusLabel}</p>
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

const ActivitySourceNotice = ({ error }: { error: string | null }) => {
  if (!error) {
    return null;
  }

  return (
    <section className="tone-state-warning rounded-[14px] border px-4 py-3">
      <p className="text-sm font-semibold text-white">Activity unavailable</p>
      <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{error}</p>
    </section>
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
