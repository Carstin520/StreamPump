import {
  ActivityAuthorRecord,
  ActivityFeedItemRecord,
  ActivityFeedTabRecord,
  ActivitySidebarHighlightRecord,
  ActivityVideoItemRecord,
} from "@/lib/api/types";

import { posts } from "./discover";

const activityPost = (postId: string) => posts.find((post) => post.id === postId) ?? posts[0];

export const followedCreatorIds = ["corner-heartbeat", "night-distortion", "wudu-lowfreq", "guantou-bugoufen"];

export const activityFeedTabs: ActivityFeedTabRecord[] = [
  { id: "overview", label: "综合" },
  { id: "video", label: "视频" },
];

export const activityAuthors: ActivityAuthorRecord[] = [
  {
    creatorId: "corner-heartbeat",
    note: "F1 第一圈和高速弯现场切片很能打",
    hasUnread: true,
  },
  {
    creatorId: "night-distortion",
    note: "演出后劲和大场馆情绪记录很稳",
  },
  {
    creatorId: "wudu-lowfreq",
    note: "重庆说唱现场和地域气质结合得很准",
  },
  {
    creatorId: "guantou-bugoufen",
    note: "橘猫日常和拟人化吐槽评论区很活跃",
  },
];

export const activityFeedItems: ActivityFeedItemRecord[] = [
  {
    id: "activity-post-live-afterglow",
    kind: "post",
    creatorId: "night-distortion",
    postId: "post-live-show-afterglow",
    postedAtLabel: "58分钟前",
    title: "散场半天了，耳朵和情绪还没出来，这种现场真的只有去了才知道。",
    body: "有些演出结束以后，人已经离场了，但耳朵和情绪还留在那个空间里。视频只带得走画面，带不走那个场子被低频和呼喊一起按住的感觉。",
    actionSummary: "#音乐现场 #演出记录 #现场后劲",
    commentsCount: 14,
    likesCount: 412,
    sharesCount: 52,
    coverSrc: activityPost("post-live-show-afterglow").coverSrc,
    mediaType: "VIDEO",
    durationLabel: activityPost("post-live-show-afterglow").durationLabel,
    stage: "S1_BUYOUT",
  },
  {
    id: "activity-status-f1-first-lap",
    kind: "status",
    creatorId: "corner-heartbeat",
    postId: "post-f1-first-lap-corner-rush",
    postedAtLabel: "1小时前",
    body: "第一圈车群一起冲进弯角的时候，真的会感觉速度、声浪和重量感同时压过来。电视转播已经很刺激，现场更夸张。",
    actionSummary: "更新了一个短动态 · 点击进入帖子详情",
    commentsCount: 10,
    likesCount: 219,
    sharesCount: 33,
    coverSrc: activityPost("post-f1-first-lap-corner-rush").coverSrc,
    mediaType: "VIDEO",
    durationLabel: activityPost("post-f1-first-lap-corner-rush").durationLabel,
    stage: "S1_BUYOUT",
  },
  {
    id: "activity-post-dune",
    kind: "post",
    creatorId: "mika-zhou",
    postId: "post-dune-afterglow",
    postedAtLabel: "昨晚",
    title: "《沙丘》最厉害的不是大场面，而是它能让人安静下来，被一个世界慢慢压进去。",
    body: "这类电影不是很吵、很满的视觉刺激，而是一种极度克制，但压迫感强到离谱的美。沙漠、秩序感和命运感会把人整个人吞进去。",
    actionSummary: "#电影美学 #沙漠科幻 #镜头情绪",
    commentsCount: 6,
    likesCount: 212,
    sharesCount: 27,
    coverSrc: activityPost("post-dune-afterglow").coverSrc,
    mediaType: "IMAGE",
    stage: "S1_DISCOVERY",
  },
  {
    id: "activity-post-gai",
    kind: "post",
    creatorId: "wudu-lowfreq",
    postId: "post-gai-chongqing-stage-gravity",
    postedAtLabel: "45分钟前",
    title: "有些演唱会放在哪都能炸，但放在重庆，味道就完全不一样了。",
    body: "这场最打我的地方，不只是现场有多炸，而是 GAI 站在重庆唱的时候，那种气场真的太顺了。城市、舞台和声音像本来就该长在一起。",
    actionSummary: "#中文说唱 #重庆现场 #舞台张力",
    commentsCount: 9,
    likesCount: 342,
    sharesCount: 47,
    coverSrc: activityPost("post-gai-chongqing-stage-gravity").coverSrc,
    mediaType: "VIDEO",
    durationLabel: activityPost("post-gai-chongqing-stage-gravity").durationLabel,
    stage: "S1_DISCOVERY",
  },
  {
    id: "activity-post-cat",
    kind: "post",
    creatorId: "guantou-bugoufen",
    postId: "post-orange-cat-watch-mode",
    postedAtLabel: "2小时前",
    title: "我家猫：热闹是你们的，我先躲桌子底下。",
    body: "明明家里很热闹，逗猫棒和零食都摆好了，这位橘猫却全程缩在桌子底下礼貌围观。不是害怕，更像是在观察人类。",
    actionSummary: "#猫咪日常 #社恐小猫 #居家治愈",
    commentsCount: 11,
    likesCount: 388,
    sharesCount: 29,
    coverSrc: activityPost("post-orange-cat-watch-mode").coverSrc,
    mediaType: "VIDEO",
    durationLabel: activityPost("post-orange-cat-watch-mode").durationLabel,
    stage: "NONE",
  },
];

export const activityVideoItems: ActivityVideoItemRecord[] = [
  {
    id: "activity-video-live",
    creatorId: "night-distortion",
    postId: "post-live-show-afterglow",
    title: "有些演出散场以后，人已经出来了，但耳朵和情绪还留在里面。",
    coverSrc: activityPost("post-live-show-afterglow").coverSrc,
    viewsCount: 14200,
    commentsCount: 14,
    timeLabel: "58分钟前",
  },
  {
    id: "activity-video-f1-first-lap",
    creatorId: "corner-heartbeat",
    postId: "post-f1-first-lap-corner-rush",
    title: "第一圈集体过弯这 30 秒，足够把 F1 为什么好看说明白。",
    coverSrc: activityPost("post-f1-first-lap-corner-rush").coverSrc,
    durationLabel: activityPost("post-f1-first-lap-corner-rush").durationLabel,
    viewsCount: 6920,
    commentsCount: 10,
    timeLabel: "1小时前",
  },
  {
    id: "activity-video-gai",
    creatorId: "wudu-lowfreq",
    postId: "post-gai-chongqing-stage-gravity",
    title: "有些现场回到那座城市以后，气场会直接翻倍。",
    coverSrc: activityPost("post-gai-chongqing-stage-gravity").coverSrc,
    viewsCount: 5880,
    commentsCount: 9,
    timeLabel: "45分钟前",
  },
  {
    id: "activity-video-cat",
    creatorId: "guantou-bugoufen",
    postId: "post-orange-cat-watch-mode",
    title: "别人家的猫在营业，我家猫在桌子底下礼貌围观。",
    coverSrc: activityPost("post-orange-cat-watch-mode").coverSrc,
    viewsCount: 4820,
    commentsCount: 11,
    timeLabel: "2小时前",
  },
];

export const activitySidebarHighlights: ActivitySidebarHighlightRecord[] = [
  {
    creatorId: "corner-heartbeat",
    headline: "第一圈和高速弯现场切片正在拉高车迷停留时间。",
    statusLabel: "Trackside clips compounding",
  },
  {
    creatorId: "night-distortion",
    headline: "现场后劲类短视频的评论深度和重播率都很高。",
    statusLabel: "Afterglow clips converting",
  },
  {
    creatorId: "wudu-lowfreq",
    headline: "地域气质很强的说唱现场内容在持续冒头。",
    statusLabel: "Regional identity rising",
  },
  {
    creatorId: "guantou-bugoufen",
    headline: "宠物拟人化短视频依然是高评论密度来源。",
    statusLabel: "Cozy replay loop",
  },
];
