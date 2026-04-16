import { CurrentUserRecord, UserNoteRecord } from "@/lib/api/types";

import { assetPath, avatars } from "./common";
import { posts } from "./discover";

export const currentUser: CurrentUserRecord = {
  id: "james-li",
  name: "Alex Chen",
  handle: "@alexchen",
  location: "San Francisco",
  bio: "Investing in creators who move culture. SF → SH",
  followingCount: 312,
  followersCount: 4800,
  totalLikesAndSavesCount: 28000,
  sessionMode: "Social login + embedded wallet ready",
  primaryWallet: "4NwF...q8Yz",
  avatarSrc: avatars.currentUser,
  bannerSrc: assetPath("2026-04-13-cyberpunk-night-cities", "02.jpg"),
};

export const currentUserNotes: UserNoteRecord[] = [
  {
    id: "me-note-1",
    sourcePostId: "post-cyberpunk-cities",
    title: "夜里开到桥下时，重庆总会给人一种现实偷偷开了科幻滤镜的错觉",
    coverSrc: assetPath("2026-04-13-cyberpunk-night-cities", "02.jpg"),
    likes: 128,
    stage: "NONE",
    authorName: "Alex Chen",
    authorAvatarSrc: avatars.currentUser,
    mediaHeightClass: "h-[310px]",
  },
  {
    id: "me-note-2",
    sourcePostId: "post-rocket-dream",
    title: "有些火箭还没起飞，画面就已经先把“去很远的地方”这件事说清楚了",
    coverSrc: assetPath("2026-04-13-rocket-dream-engineering", "cover.jpg"),
    likes: 72,
    stage: "NONE",
    authorName: "Alex Chen",
    authorAvatarSrc: avatars.currentUser,
    mediaHeightClass: "h-[220px]",
  },
  {
    id: "me-note-3",
    sourcePostId: "post-f1-aesthetics",
    title: "赛车的美感很多时候不是为了帅，反而是性能外溢之后留下来的压迫感",
    coverSrc: assetPath("2026-04-13-f1-aesthetics-entry", "02.png"),
    likes: 184,
    stage: "NONE",
    authorName: "Alex Chen",
    authorAvatarSrc: avatars.currentUser,
    mediaHeightClass: "h-[292px]",
  },
  {
    id: "me-note-4",
    sourcePostId: "post-dune-afterglow",
    title: "《沙丘》的厉害不是大场面，而是它能让人安静下来，慢慢被一个世界压进去",
    coverSrc: assetPath("2026-04-13-dune-afterglow", "01.jpg"),
    likes: 96,
    stage: "NONE",
    authorName: "Alex Chen",
    authorAvatarSrc: avatars.currentUser,
    mediaHeightClass: "h-[260px]",
  },
  {
    id: "me-note-5",
    sourcePostId: "post-game-trailer-moodboard",
    title: "有些游戏还没上手，我就已经先被预告片的世界观和海报气质拿捏住了",
    coverSrc: assetPath("2026-04-13-game-trailer-moodboard", "03.jpg"),
    likes: 211,
    stage: "NONE",
    authorName: "Alex Chen",
    authorAvatarSrc: avatars.currentUser,
    mediaHeightClass: "h-[338px]",
  },
  {
    id: "me-note-6",
    sourcePostId: "post-cyberpunk-cities",
    title: "雨夜、桥梁、高楼和旧街区叠在一起时，城市本身就像在讲一个赛博朋克故事",
    coverSrc: assetPath("2026-04-13-cyberpunk-night-cities", "cover.jpg"),
    likes: 167,
    stage: "NONE",
    authorName: "Alex Chen",
    authorAvatarSrc: avatars.currentUser,
    mediaHeightClass: "h-[300px]",
  },
];

export const currentUserSavedPosts: UserNoteRecord[] = posts.slice(0, 4).map((post) => ({
  id: `saved-${post.id}`,
  title: post.title,
  coverSrc: post.coverSrc,
  likes: post.likes,
  stage: post.stage,
  authorName: post.creatorName,
  authorAvatarSrc: post.creatorAvatarSrc,
  mediaHeightClass: post.mediaHeightClass,
}));

export const currentUserLikedPosts: UserNoteRecord[] = posts.slice(1, 5).map((post) => ({
  id: `liked-${post.id}`,
  title: post.title,
  coverSrc: post.coverSrc,
  likes: post.likes,
  stage: post.stage,
  authorName: post.creatorName,
  authorAvatarSrc: post.creatorAvatarSrc,
  mediaHeightClass: post.mediaHeightClass,
}));
