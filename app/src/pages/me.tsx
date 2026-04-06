import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";
import {
  CreatorSeasonState,
  currentUser,
  currentUserLikedPosts,
  currentUserNotes,
  currentUserSavedPosts,
  UserNoteRecord,
  compactNumber,
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
        <div className="space-y-7 py-4">
          <section className="liquid-panel overflow-hidden rounded-[34px]">
            <div className="relative h-52 overflow-hidden">
              <img
                alt={`${currentUser.name} banner`}
                className="h-full w-full object-cover"
                src={currentUser.bannerSrc}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#09111b]/24 to-[#09111b]" />
            </div>

            <div className="relative px-6 pb-8 md:px-10">
              <div className="-mt-14 flex flex-col items-center text-center">
                <div className="h-28 w-28 overflow-hidden rounded-full border-[4px] border-[#09111b] shadow-[0_24px_60px_rgba(0,0,0,0.38)]">
                  <img
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                    src={currentUser.avatarSrc}
                  />
                </div>

                <h1 className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-white">{currentUser.name}</h1>
                <p className="mt-2 text-sm text-[#8ea0ba]">
                  {currentUser.handle} · IP属地: {currentUser.location}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#d2d9e6]">{currentUser.bio}</p>

                <div className="mt-6 flex items-center gap-8">
                  <Stat label="关注" value={compactNumber(currentUser.followingCount)} />
                  <div className="h-8 w-px bg-white/8" />
                  <Stat label="粉丝" value={compactNumber(currentUser.followersCount)} />
                  <div className="h-8 w-px bg-white/8" />
                  <Stat label="获赞与收藏" value={compactNumber(currentUser.totalLikesAndSavesCount)} />
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button className="liquid-pill rounded-full px-6 py-2.5 text-sm text-white transition hover:bg-white/10" type="button">
                    编辑资料
                  </button>
                  <button className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/92" type="button">
                    分享主页
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="px-2">
            <div className="mx-auto flex max-w-[720px] items-center justify-center gap-8 border-b border-white/8">
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
                  {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" /> : null}
                </button>
              ))}
            </div>
          </section>

          <section>
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
  <div className="min-w-[90px]">
    <p className="text-xl font-semibold tracking-[-0.03em] text-white">{value}</p>
    <p className="mt-1 text-xs text-[#8797ae]">{label}</p>
  </div>
);

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
    <div className="glass-card">
      <div className="relative overflow-hidden rounded-t-[24px]">
        <img alt={item.title} className={`w-full object-cover ${item.mediaHeightClass}`} src={item.coverSrc} />
        {stageLabel[item.stage] ? (
          <div className="liquid-pill absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] tracking-[0.18em] text-white">
            {stageLabel[item.stage]}
          </div>
        ) : null}
      </div>
      <div className="glass-card-footer px-4 pb-4 pt-4">
        <p className="line-clamp-2 text-[16px] font-medium leading-7 text-white">{item.title}</p>
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
