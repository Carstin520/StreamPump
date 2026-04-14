import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";
import {
  CreatorSeasonState,
  compactNumber,
  currentUser,
  currentUserLikedPosts,
  currentUserNotes,
  currentUserSavedPosts,
  UserNoteRecord,
} from "@/lib/mock-data";

type ProfileTab = "笔记" | "收藏" | "点赞";

const stageLabel: Record<CreatorSeasonState | "NONE", string | null> = {
  NONE: null,
  S1_DISCOVERY: "S1",
  S1_BUYOUT: "S1 Buyout",
  S2_ACTIVE: "S2",
};

export default function MePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("笔记");

  const items =
    activeTab === "笔记"
      ? currentUserNotes
      : activeTab === "收藏"
        ? currentUserSavedPosts
        : currentUserLikedPosts;

  return (
    <>
      <Head>
        <title>StreamPump | Me</title>
      </Head>
      <UserShell header={<UserTopbar />}>
        <div className="pb-10">
          <section className="-mx-4 border-b border-white/8 bg-[#0a0f18] lg:-mx-6">
            <div className="relative h-48 overflow-hidden sm:h-56">
              <img
                alt={`${currentUser.name} banner`}
                className="h-full w-full object-cover"
                src={currentUser.bannerSrc}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#09111b]/38 to-[#09111b]" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0f18] to-transparent" />
            </div>

            <div className="relative mx-auto max-w-[960px] px-4 pb-8">
              <div className="-mt-14 flex flex-col items-center text-center">
                <div className="h-24 w-24 overflow-hidden rounded-full border-[4px] border-[#0a0f18] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                  <img
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                    src={currentUser.avatarSrc}
                  />
                </div>

                <h1 className="mt-4 text-[36px] font-semibold tracking-[-0.05em] text-white">{currentUser.name}</h1>
                <p className="mt-2 text-sm text-[#8797ae]">
                  {currentUser.handle} · IP属地: {currentUser.location}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#ccd5e4]">{currentUser.bio}</p>

                <div className="mt-7 flex items-center gap-0">
                  <Stat label="关注" value={formatProfileCount(currentUser.followingCount)} />
                  <div className="h-8 w-px bg-white/8" />
                  <Stat label="粉丝" value={formatProfileCount(currentUser.followersCount)} />
                  <div className="h-8 w-px bg-white/8" />
                  <Stat label="获赞与收藏" value={formatProfileCount(currentUser.totalLikesAndSavesCount)} />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button className="rounded-full border border-white/8 bg-[#171f2d] px-7 py-2.5 text-sm font-medium text-white transition hover:bg-[#1c2636]" type="button">
                    编辑资料
                  </button>
                  <button className="rounded-full bg-[#de402a] px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ec553f]" type="button">
                    + 创作
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[960px] px-2 pt-8">
            <div className="mx-auto flex max-w-[560px] items-center justify-center gap-8 border-b border-white/8">
              {(["笔记", "收藏", "点赞"] as ProfileTab[]).map((tab) => (
                <button
                  className={`relative pb-4 text-sm transition ${
                    activeTab === tab ? "font-semibold text-white" : "text-[#7d8da6] hover:text-white"
                  }`}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                  {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-[960px] px-2 pt-2">
            <div className="masonry-grid">
              {items.map((item) => (
                <ProfileNoteCard item={item} key={item.id} />
              ))}
            </div>
          </section>
        </div>
      </UserShell>
    </>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-[110px] px-6">
    <p className="text-[28px] font-semibold tracking-[-0.04em] text-white">{value}</p>
    <p className="mt-1 text-xs text-[#8797ae]">{label}</p>
  </div>
);

const formatProfileCount = (value: number) => {
  if (value >= 10000) {
    const wan = value / 10000;
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(value);
};

const ProfileNoteCard = ({ item }: { item: UserNoteRecord }) => (
  <Link
    className="block"
    href={
      item.id.startsWith("saved-")
        ? `/posts/${item.id.replace("saved-", "")}`
        : item.id.startsWith("liked-")
          ? `/posts/${item.id.replace("liked-", "")}`
          : "/me"
    }
  >
    <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#101621] shadow-[0_16px_44px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-white/[0.1]">
      <div className="relative overflow-hidden">
        <img alt={item.title} className={`w-full object-cover transition duration-500 hover:scale-[1.02] ${item.mediaHeightClass}`} src={item.coverSrc} />
        {stageLabel[item.stage] ? (
          <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] tracking-[0.18em] text-white backdrop-blur-md">
            {stageLabel[item.stage]}
          </div>
        ) : null}
      </div>
      <div className="px-3.5 pb-3.5 pt-3">
        <p className="line-clamp-2 text-[14px] font-medium leading-6 text-white">{item.title}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img alt={item.authorName} className="h-5 w-5 rounded-full object-cover" src={item.authorAvatarSrc} />
            <span className="text-xs text-[#8ea0ba]">{item.authorName}</span>
          </div>
          <span className="text-xs text-[#8ea0ba]">♡ {compactNumber(item.likes)}</span>
        </div>
      </div>
    </div>
  </Link>
);
