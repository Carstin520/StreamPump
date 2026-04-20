import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";
import {
  ProfileHero,
  ProfilePostGrid,
  ProfileTab,
  ProfileTabBar,
  resolveItemPostId,
  resolveProfilePosts,
} from "@/components/profile/ProfileSurface";

const DynamicPostDetailExperience = dynamic(
  () => import("@/components/post/PostDetailExperience").then((mod) => mod.PostDetailExperience),
  { ssr: false },
);

export default function MePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("笔记");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const {
    currentUser,
    currentUserLikedPosts,
    currentUserNotes,
    currentUserSavedPosts,
    error,
    loading,
    posts,
  } = usePublicFeedViewModel();

  const items =
    activeTab === "笔记"
      ? currentUserNotes
      : activeTab === "收藏"
        ? currentUserSavedPosts
        : currentUserLikedPosts;

  const tabPosts = useMemo(() => resolveProfilePosts(items, posts), [items, posts]);

  useEffect(() => {
    if (selectedPostId && !tabPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(null);
    }
  }, [selectedPostId, tabPosts]);

  return (
    <>
      <Head>
        <title>StreamPump | Me</title>
      </Head>
      <PageShell>
        {loading ? <div className="py-10 text-sm text-[#8ea0ba]">Loading imported library…</div> : null}
        {!loading && error ? <div className="py-10 text-sm text-[#8ea0ba]">{error}</div> : null}
        {!loading && !error ? (
          <div className="pb-10">
            <ProfileHero
              avatarSrc={currentUser.avatarSrc}
              bannerSrc={currentUser.bannerSrc}
              bio={currentUser.bio}
              followersCount={currentUser.followersCount}
              followingCount={currentUser.followingCount}
              handle={currentUser.handle}
              likesAndSavesCount={currentUser.totalLikesAndSavesCount}
              location={currentUser.location}
              name={currentUser.name}
            />
            <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
            <ProfilePostGrid posts={tabPosts} onOpen={(postId) => setSelectedPostId(postId)} />
          </div>
        ) : null}
        {selectedPostId ? (
          <DynamicPostDetailExperience
            closeLabel="Close profile post"
            currentPostId={selectedPostId}
            items={tabPosts}
            mode="modal"
            onChangePostId={setSelectedPostId}
            onClose={() => setSelectedPostId(null)}
            syncRoute={false}
          />
        ) : null}
      </PageShell>
    </>
  );
}
