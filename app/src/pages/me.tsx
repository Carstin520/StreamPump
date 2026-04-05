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
      <UserShell
        header={<UserTopbar subtitle="Profile" />}
      >
        <div className="space-y-6">
          <section className="rounded-[34px] px-6 py-8 text-center">
            <div className="mx-auto flex max-w-3xl flex-col items-center">
              <img
                alt={currentUser.name}
                className="h-28 w-28 rounded-full object-cover shadow-[0_24px_60px_rgba(0,0,0,0.32)]"
                src={currentUser.avatarSrc}
              />
              <h1 className="mt-5 text-[34px] font-semibold tracking-[-0.04em] text-white">{currentUser.name}</h1>
              <p className="mt-2 text-sm text-[#8fa0b9]">
                {currentUser.handle} · IP属地: {currentUser.location}
              </p>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#d1d9e6]">{currentUser.bio}</p>

              <div className="mt-6 flex items-center gap-8">
                <Stat label="关注" value={compactNumber(currentUser.followingCount)} />
                <div className="h-8 w-px bg-white/8" />
                <Stat label="粉丝" value={compactNumber(currentUser.followersCount)} />
                <div className="h-8 w-px bg-white/8" />
                <Stat label="获赞与收藏" value={compactNumber(currentUser.totalLikesAndSavesCount)} />
              </div>

              <div className="mt-7 flex items-center gap-3">
                <button className="rounded-full border border-white/8 bg-white/4 px-6 py-2.5 text-sm text-white transition hover:bg-white/7" type="button">
                  编辑资料
                </button>
                <button className="rounded-full border border-white/8 bg-white/4 px-6 py-2.5 text-sm text-white transition hover:bg-white/7" type="button">
                  分享主页
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] px-4">
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

          <section className="rounded-[34px] px-2 py-1">
            <div className="columns-1 gap-6 md:columns-3 xl:columns-4">
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
    className="mb-6 inline-block w-full break-inside-avoid"
    href={
      item.id.startsWith("saved-")
        ? `/posts/${item.id.replace("saved-", "")}`
        : item.id.startsWith("liked-")
          ? `/posts/${item.id.replace("liked-", "")}`
          : "/me"
    }
  >
    <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(15,21,32,0.58)_0%,rgba(10,16,24,0.52)_100%)] p-2.5 shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(0,0,0,0.28)]">
      <div className="relative overflow-hidden rounded-[20px]">
        <img alt={item.title} className={`w-full object-cover ${item.mediaHeightClass}`} src={item.coverSrc} />
        {stageLabel[item.stage] ? (
          <div className="liquid-pill absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] tracking-[0.18em] text-white">
            {stageLabel[item.stage]}
          </div>
        ) : null}
      </div>
      <div className="px-2.5 pb-3 pt-4">
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
