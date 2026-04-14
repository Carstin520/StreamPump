export type CreatorSeasonState = "S1_DISCOVERY" | "S1_BUYOUT" | "S2_ACTIVE";
export type PostType = "IMAGE" | "VIDEO";

export type CommentRecord = {
  id: string;
  author: string;
  avatarSeed: string;
  avatarSrc: string;
  content: string;
  likes: number;
  timeLabel: string;
};

export type PostRecord = {
  id: string;
  type: PostType;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatarSrc: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  stage: CreatorSeasonState | "NONE";
  likes: number;
  saves: number;
  commentsCount: number;
  timeLabel: string;
  location: string;
  mediaHeightClass: string;
  mediaStyle: string;
  coverSrc: string;
  durationLabel?: string;
  gallerySrcs?: string[];
  hasMultipleImages?: boolean;
  comments: CommentRecord[];
};

export type CreatorMarketRecord = {
  id: string;
  name: string;
  handle: string;
  avatarSrc: string;
  heroSrc: string;
  followingCount: number;
  followersCount: number;
  totalLikesAndSavesCount: number;
  niche: string;
  city: string;
  intro: string;
  level: string;
  momentumScore: number;
  tokenPrice: number;
  supply: number;
  graduationProgress: number;
  buyoutStatus: string;
  state: CreatorSeasonState;
  teaser: string;
  tags: string[];
  holderCount: number;
  topHolders: Array<{ rank: number; label: string; share: string }>;
  targetGraduationPrice: number;
  potentialSponsors: string[];
  supporterDistributableUsd?: number;
  buyoutOfferUsd?: number;
  buyoutTimeline?: string[];
  activeCampaignCount?: number;
  activityScore?: number;
  valuationUsd?: number;
  contentPool: string[];
};

export type ManifestRecord = {
  id: string;
  title: string;
  status: "DRAFT" | "READY" | "ANCHORED" | "LOCKED";
  contentType: "SHORT_VIDEO" | "IMAGE_CAROUSEL" | "MIXED_MEDIA_NOTE";
  assetCount: number;
  updatedAtLabel: string;
};

export type IntentRecord = {
  id: string;
  creatorId: string;
  creatorName: string;
  sponsorName: string;
  status:
    | "DRAFT"
    | "TERMS_LOCKED"
    | "BUNDLE_BUILT"
    | "CREATOR_PARTIAL"
    | "AWAITING_SPONSOR"
    | "SUBMITTED"
    | "CONFIRMED";
  actionOwner: "creator" | "sponsor" | "system";
  track1BaseUsd: number;
  track2PoolUsd: number;
  track3PoolUsd: number;
  metric: string;
  targetValue: string;
  manifestTitle: string;
  deadlineLabel: string;
};

export type CampaignRecord = {
  id: string;
  creatorName: string;
  sponsorName: string;
  status: "FUNDED" | "TRACK2_OPEN" | "TRACK3_PENDING" | "SETTLED";
  contentHashShort: string;
  contentAnchorShort: string;
  track1BaseUsd: number;
  track2PoolUsd: number;
  track3PoolUsd: number;
  metric: string;
  actualValue: string;
  chainTxShort: string;
};

export type LoginPreviewMode = "welcome" | "switch";

export type LoginMethodRecord = {
  id: "email" | "google" | "apple" | "wallet";
  label: string;
  subtitle: string;
  tone?: "default" | "wallet";
};

export type LoginAccountRecord = {
  id: string;
  name: string;
  handle: string;
  avatarSrc: string;
  sessionLabel: string;
  methodLabel: string;
  isCurrent?: boolean;
};

export type PortfolioHoldingRecord = {
  creatorId: string;
  tokenCount: number;
  avgEntryUsd: number;
  unrealizedChangePct: number;
  note: string;
  currentPriceUsd?: number;
  trend: number[];
};

export type PortfolioActionRecord = {
  id: string;
  title: string;
  body: string;
  tone: "neutral" | "buyout" | "opportunity";
  creatorId?: string;
  actionLabel?: string;
};

export type PortfolioExposurePointRecord = {
  label: string;
  value: number;
};

export type PortfolioClaimWindowRecord = {
  id: string;
  creatorId: string;
  eligibleTokens: number;
  claimPriceUsd: number;
  payoutUsd: number;
  closesInLabel: string;
  statusLabel: string;
};

export type PortfolioUpcomingClaimRecord = {
  id: string;
  creatorId: string;
  eligibleTokens: number;
  expectedPriceUsd: number;
  opensInLabel: string;
  estimatedPayoutUsd: number;
};

export type PortfolioReentryRecord = {
  id: string;
  creatorId: string;
  exitPriceUsd: number;
  currentPriceUsd: number;
  exitedAtLabel: string;
  sinceExitPerformancePct: number;
  thesis: string;
};

export type ActivityTab = "overview" | "video";

export type ActivityFeedTabRecord = {
  id: ActivityTab;
  label: string;
};

export type ActivityAuthorRecord = {
  creatorId: string;
  note: string;
  hasUnread?: boolean;
};

export type ActivityFeedItemRecord = {
  id: string;
  kind: "post" | "status";
  creatorId: string;
  postId: string;
  postedAtLabel: string;
  title?: string;
  body: string;
  actionSummary: string;
  commentsCount: number;
  likesCount: number;
  sharesCount: number;
  coverSrc?: string;
  mediaType?: PostType;
  durationLabel?: string;
  stage: CreatorSeasonState | "NONE";
};

export type ActivityVideoItemRecord = {
  id: string;
  creatorId: string;
  postId: string;
  title: string;
  coverSrc: string;
  durationLabel: string;
  viewsCount: number;
  commentsCount: number;
  timeLabel: string;
};

export type ActivitySidebarHighlightRecord = {
  creatorId: string;
  headline: string;
  statusLabel: string;
};

export type UserNoteRecord = {
  id: string;
  sourcePostId?: string;
  title: string;
  coverSrc: string;
  likes: number;
  stage: CreatorSeasonState | "NONE";
  authorName: string;
  authorAvatarSrc: string;
  mediaHeightClass: string;
};

const makeAvatar = (seed: string, start: string, end: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop stop-color="${start}" />
          <stop offset="1" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#bg)" />
      <circle cx="80" cy="58" r="24" fill="rgba(255,255,255,0.2)" />
      <path d="M36 128c8-21 24-33 44-33s36 12 44 33" fill="rgba(255,255,255,0.16)" />
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="700">${seed}</text>
    </svg>
  `)}`;

const assetPath = (slug: string, file: string) => `/local-post-assets/posts/${slug}/images/${file}`;

const makeComment = (
  id: string,
  author: string,
  avatarSeed: string,
  avatarSrc: string,
  content: string,
  likes: number,
  timeLabel: string,
): CommentRecord => ({
  id,
  author,
  avatarSeed,
  avatarSrc,
  content,
  likes,
  timeLabel,
});

const avatars = {
  wanxin: makeAvatar("弯", "#5C3C4A", "#1E2737"),
  midnight: makeAvatar("深", "#29334E", "#121826"),
  dune: makeAvatar("胶", "#705949", "#191919"),
  rocket: makeAvatar("低", "#4A5C73", "#1A2231"),
  neon: makeAvatar("夜", "#5E355F", "#14233E"),
  currentUser: makeAvatar("A", "#445A87", "#1B2436"),
  aZhe: makeAvatar("阿", "#8D5C48", "#33243A"),
  latte: makeAvatar("奶", "#AA6B7F", "#46314D"),
  wind: makeAvatar("风", "#556D7C", "#27313B"),
  track: makeAvatar("赛", "#8F6F44", "#32261D"),
  calm: makeAvatar("理", "#4C596E", "#1C2430"),
  game: makeAvatar("阿", "#6C5D8F", "#25203B"),
  gpu: makeAvatar("显", "#4E728B", "#1F2E3A"),
  monkey: makeAvatar("猴", "#7B5039", "#281F20"),
  neonSea: makeAvatar("霓", "#6A4D7F", "#1C2A3F"),
  movie: makeAvatar("影", "#7D5C49", "#2C211A"),
  tech: makeAvatar("参", "#476279", "#1E2733"),
} as const;

export const creators: CreatorMarketRecord[] = [
  {
    id: "luna-cai",
    name: "弯心入坑",
    handle: "@wanxinrk",
    avatarSrc: avatars.wanxin,
    heroSrc: assetPath("2026-04-13-f1-aesthetics-entry", "cover.png"),
    followingCount: 184,
    followersCount: 58200,
    totalLikesAndSavesCount: 168000,
    niche: "Racing x Visual Culture",
    city: "Shanghai",
    intro: "26岁，视觉设计从业者。先被赛车颜值吸引，再慢慢掉进规则、空气动力学和工业美学里。",
    level: "S1 Buyout Watch",
    momentumScore: 84,
    tokenPrice: 3.24,
    supply: 18420,
    graduationProgress: 76,
    buyoutStatus: "Offer window live",
    state: "S1_BUYOUT",
    teaser: "审美型车迷内容，封面保存率和评论深度都很强。",
    tags: ["赛车", "美学", "速度感"],
    holderCount: 2864,
    topHolders: [
      { rank: 1, label: "0xA7...91", share: "8.7%" },
      { rank: 2, label: "0x4C...8F", share: "6.1%" },
      { rank: 3, label: "0x91...2E", share: "5.8%" },
    ],
    targetGraduationPrice: 4.8,
    potentialSponsors: ["Apex Motion", "Gridline Lab", "Velocity House"],
    supporterDistributableUsd: 124000,
    buyoutOfferUsd: 850000,
    buyoutTimeline: ["Offer opened", "Creator accepted", "Rage-quit window active", "Supporter payout pending"],
    contentPool: ["赛道摄影日常", "F1涂装观察", "比赛集锦审美向轻科普"],
  },
  {
    id: "mika-zhou",
    name: "胶片落进沙里",
    handle: "@filmintosand",
    avatarSrc: avatars.dune,
    heroSrc: assetPath("2026-04-13-dune-afterglow", "cover.jpg"),
    followingCount: 127,
    followersCount: 42600,
    totalLikesAndSavesCount: 102000,
    niche: "Cinema x Atmosphere",
    city: "Beijing",
    intro: "25岁，内容行业从业者。不是影评人，但总是会被沙漠、秩序感和命运感很重的镜头击中。",
    level: "S1 Discovery",
    momentumScore: 67,
    tokenPrice: 2.16,
    supply: 11240,
    graduationProgress: 44,
    buyoutStatus: "Monitoring demand",
    state: "S1_DISCOVERY",
    teaser: "电影氛围感很强，适合高停留图文和品牌电影感合作。",
    tags: ["电影美学", "沙漠科幻", "观后感"],
    holderCount: 1450,
    topHolders: [
      { rank: 1, label: "0xD4...A2", share: "7.4%" },
      { rank: 2, label: "0x3F...0B", share: "6.2%" },
      { rank: 3, label: "0x9C...71", share: "4.9%" },
    ],
    targetGraduationPrice: 3.2,
    potentialSponsors: ["North Frame", "Studio Atlas", "Slate Journal"],
    supporterDistributableUsd: 45000,
    buyoutOfferUsd: 200000,
    contentPool: ["作者电影截图集", "科幻片情绪流分享", "镜头语言观后感"],
  },
  {
    id: "neo-park",
    name: "深夜不下线",
    handle: "@midnightsave",
    avatarSrc: avatars.midnight,
    heroSrc: assetPath("2026-04-13-game-trailer-moodboard", "cover.png"),
    followingCount: 214,
    followersCount: 239000,
    totalLikesAndSavesCount: 522000,
    niche: "Games x Trailer Moodboards",
    city: "Shenzhen",
    intro: "24岁，上班族玩家。会因为一张海报、一段预告、一种世界观就提前上头。",
    level: "Graduated to S2",
    momentumScore: 91,
    tokenPrice: 5.82,
    supply: 23800,
    graduationProgress: 100,
    buyoutStatus: "Running active campaigns",
    state: "S2_ACTIVE",
    teaser: "游戏预告、世界观和视觉叙事类内容，有很高的互动与品牌适配度。",
    tags: ["3A游戏", "游戏美学", "预告片"],
    holderCount: 4120,
    topHolders: [
      { rank: 1, label: "0x2A...17", share: "9.4%" },
      { rank: 2, label: "0x8E...44", share: "7.1%" },
      { rank: 3, label: "0x7B...DD", share: "5.2%" },
    ],
    targetGraduationPrice: 5.8,
    potentialSponsors: ["PulseGear", "Console Dock", "Nova Screen"],
    activeCampaignCount: 2,
    activityScore: 89,
    supporterDistributableUsd: 310000,
    buyoutOfferUsd: 1200000,
    valuationUsd: 1200000,
    contentPool: ["预告片情绪拆解", "世界观海报合集", "主机游戏沉浸感推荐"],
  },
  {
    id: "low-orbit",
    name: "低空仰望者",
    handle: "@loworbitlook",
    avatarSrc: avatars.rocket,
    heroSrc: assetPath("2026-04-13-rocket-dream-engineering", "cover.jpg"),
    followingCount: 96,
    followersCount: 31800,
    totalLikesAndSavesCount: 78000,
    niche: "Aerospace x Engineering Romance",
    city: "Qingdao",
    intro: "27岁，理工科背景。喜欢航天、天空、海边和大型工程，也相信理工科有自己的浪漫。",
    level: "S1 Discovery",
    momentumScore: 61,
    tokenPrice: 1.42,
    supply: 9640,
    graduationProgress: 36,
    buyoutStatus: "Early accumulation",
    state: "S1_DISCOVERY",
    teaser: "航天与工程内容的审美化表达，评论区很容易出现知识型互动。",
    tags: ["航天", "工程浪漫", "科技美学"],
    holderCount: 920,
    topHolders: [
      { rank: 1, label: "0x0F...CE", share: "6.4%" },
      { rank: 2, label: "0x11...A8", share: "5.3%" },
      { rank: 3, label: "0xA1...42", share: "4.7%" },
    ],
    targetGraduationPrice: 2.6,
    potentialSponsors: ["Orbital Press", "Skyframe", "Deep Blue Lab"],
    supporterDistributableUsd: 38000,
    buyoutOfferUsd: 160000,
    contentPool: ["发射场图文记录", "航天新闻氛围分享", "大型工程观察"],
  },
  {
    id: "night-arrival",
    name: "夜航未降落",
    handle: "@nightarrival",
    avatarSrc: avatars.neon,
    heroSrc: assetPath("2026-04-13-cyberpunk-night-cities", "cover.jpg"),
    followingCount: 165,
    followersCount: 67100,
    totalLikesAndSavesCount: 148000,
    niche: "City x Cyberpunk Mood",
    city: "Chongqing",
    intro: "25岁，城市摄影爱好者。喜欢夜景、霓虹、末世感和介于现实与科幻之间的城市情绪。",
    level: "S1 Buyout Watch",
    momentumScore: 79,
    tokenPrice: 2.74,
    supply: 15280,
    graduationProgress: 71,
    buyoutStatus: "Sponsor interest rising",
    state: "S1_BUYOUT",
    teaser: "赛博朋克城市图像和轻文字表达，封面极强，保存率也很稳。",
    tags: ["赛博朋克", "城市夜景", "电影感"],
    holderCount: 2190,
    topHolders: [
      { rank: 1, label: "0x6A...0F", share: "8.0%" },
      { rank: 2, label: "0x5C...D7", share: "6.6%" },
      { rank: 3, label: "0x23...BE", share: "5.1%" },
    ],
    targetGraduationPrice: 4.2,
    potentialSponsors: ["Neon Alley", "After Rain", "Future District"],
    supporterDistributableUsd: 98000,
    buyoutOfferUsd: 620000,
    buyoutTimeline: ["Offer discovery", "Soft circle interest", "Window not opened yet"],
    contentPool: ["重庆夜景图集", "赛博朋克城市观察", "银翼杀手式氛围分享"],
  },
];

export const posts: PostRecord[] = [
  {
    id: "post-f1-aesthetics",
    type: "IMAGE",
    creatorId: "luna-cai",
    creatorName: "弯心入坑",
    creatorHandle: "@wanxinrk",
    creatorAvatarSrc: avatars.wanxin,
    title: "有没有人和我一样，最初喜欢F1不是因为规则，而是因为它真的太好看了",
    excerpt: "一开始只是觉得赛车太帅，后来才发现真正让人上头的，是速度、机械、空气动力学和颜色美学被揉在同一个画面里。",
    body:
      "本来以为赛车只是“谁跑得更快”，\n后来才发现 F1 真正上头的地方，是它把速度、机械、空气动力学、颜色美学全都揉在了一起。\n\n黑银的冷静、红车的攻击感、白车的锋利感，每一台车放在那里都像不同性格的人。静态图已经很震撼了，真正到了赛道上，呼啸而过那一瞬间，真的会理解什么叫“速度是可以被看见的”。\n\n最近翻图的时候又一次感叹：我对 F1 的喜欢，已经从“觉得帅”变成了“会盯着涂装、轮胎、鼻翼和整车线条看很久”的程度。有时候甚至不用知道圈速，光看赛车站在那里，就已经能感受到一种非常克制但很强的压迫感。\n\n可能这就是顶级赛车的魅力吧。它不只是竞技，也是一种工业审美。\n\n你们是因为哪一瞬间开始喜欢 F1 的？是某位车手、某支车队，还是单纯先被赛车外形击中？",
    tags: ["F1", "赛车美学", "一级方程式", "赛车摄影", "速度感", "机械美学"],
    stage: "S1_BUYOUT",
    likes: 361,
    saves: 1116,
    commentsCount: 9,
    timeLabel: "1天前",
    location: "上海",
    mediaHeightClass: "h-[360px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-f1-aesthetics-entry", "cover.png"),
    gallerySrcs: [
      assetPath("2026-04-13-f1-aesthetics-entry", "cover.png"),
      assetPath("2026-04-13-f1-aesthetics-entry", "01.png"),
      assetPath("2026-04-13-f1-aesthetics-entry", "02.png"),
      assetPath("2026-04-13-f1-aesthetics-entry", "03.png"),
      assetPath("2026-04-13-f1-aesthetics-entry", "04.png"),
    ],
    hasMultipleImages: true,
    comments: [
      makeComment("f1-1", "阿哲不是阿这", "阿", avatars.aZhe, "很多人都是先看外观入坑，后面才开始研究规则和策略，太正常了。F1本来就是工业设计和竞技的结合体。", 63, "2小时前"),
      makeComment("f1-2", "奶油拿铁半糖", "奶", avatars.latte, "我是纯纯被红车吸引进来的，红色赛车在赛道上真的太有攻击性了，根本移不开眼。", 58, "3小时前"),
      makeComment("f1-3", "风洞研究员007", "风", avatars.wind, "F1最迷人的地方就是“美”其实是功能决定的。你看到的那些线条、宽体、低趴，不只是为了帅，核心都是为了空气动力学。", 74, "4小时前"),
      makeComment("f1-4", "今天也想去上赛", "赛", avatars.track, "赛道现场和看图完全不是一个概念，现场听到赛车声浪的时候，鸡皮疙瘩真的会起来。", 41, "5小时前"),
      makeComment("f1-5", "理性观赛选手", "理", avatars.calm, "虽然我懂你说的审美，但F1最精彩的还是比赛过程，真正留下人的还是攻防、策略和失误。", 35, "6小时前"),
      makeComment("f1-6", "不懂车但会看帅", "看", avatars.neonSea, "完全不懂规则，但这组图真的太高级了，像时尚大片。", 48, "7小时前"),
    ],
  },
  {
    id: "post-game-trailer-moodboard",
    type: "IMAGE",
    creatorId: "neo-park",
    creatorName: "深夜不下线",
    creatorHandle: "@midnightsave",
    creatorAvatarSrc: avatars.midnight,
    title: "这几款游戏还没全玩到，我的精神状态已经先被预告片拿捏了",
    excerpt: "现在让我上头的游戏，已经不只是好不好玩了，而是它们有没有一种一眼就把你拽进世界里的能力。",
    body:
      "最近又把这几张图翻出来看了一遍，真的有一种很强烈的感觉：\n\n现在让我上头的游戏，已经不只是“好不好玩”了，而是它们有没有一种一眼就把你拽进世界里的能力。\n\n有的游戏是霓虹、海风、夜色、失控的都市欲望；有的游戏是那种安静到发空、但越想越后劲很大的孤独感；还有的游戏直接把东方神话、压迫感、美术氛围和战斗张力全堆满，光看图就已经能脑补出一整段史诗感。\n\n我越来越吃这种作品：不只是做玩法，也在认真做世界、做气质、做“你会不会记住它”。有些图是张扬的，恨不得告诉你“快来，这里很疯”；有些图是克制的，但越克制越让人想进去看看。真正厉害的游戏，可能就是还没开始操作，你已经先进入情绪了。\n\n这几张放在一起看，风格完全不同，但共同点都是：它们不像单纯的游戏宣传图，更像在提前预告一种沉浸感。\n\n你们最近最期待、或者已经被美术风格拿下的游戏是哪一款？",
    tags: ["游戏分享", "3A游戏", "游戏美学", "GTA6", "DeathStranding2", "黑神话悟空"],
    stage: "S2_ACTIVE",
    likes: 20800,
    saves: 1966,
    commentsCount: 12,
    timeLabel: "9小时前",
    location: "深圳",
    mediaHeightClass: "h-[420px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-game-trailer-moodboard", "cover.png"),
    gallerySrcs: [
      assetPath("2026-04-13-game-trailer-moodboard", "cover.png"),
      assetPath("2026-04-13-game-trailer-moodboard", "01.jpg"),
      assetPath("2026-04-13-game-trailer-moodboard", "02.jpg"),
      assetPath("2026-04-13-game-trailer-moodboard", "03.jpg"),
      assetPath("2026-04-13-game-trailer-moodboard", "04.png"),
    ],
    hasMultipleImages: true,
    comments: [
      makeComment("game-1", "阿屿不熬夜", "阿", avatars.game, "死亡搁浅那张真的太有味道了，不需要动起来，光海报就已经有那种“又孤独又宏大”的感觉。", 81, "1小时前"),
      makeComment("game-2", "显卡还在挣扎", "显", avatars.gpu, "我看到这些图第一反应是：很好看，但我的电脑可能不太想玩。", 76, "2小时前"),
      makeComment("game-3", "猴哥请出棍", "猴", avatars.monkey, "黑神话这几张图是真的强，尤其那种东方神话里的压迫感，不是单纯“酷”，是有威慑力。", 93, "3小时前"),
      makeComment("game-4", "霓虹海岸线", "霓", avatars.neonSea, "GTA那张真的就是“我甚至还没进去，已经闻到城市空气了”。", 55, "4小时前"),
      makeComment("game-5", "不懂打斗但看审美", "影", avatars.movie, "虽然我不是重度玩家，但现在很多游戏宣传图真的做得像电影海报，看着就想了解。", 49, "5小时前"),
      makeComment("game-6", "理智消费代表", "参", avatars.tech, "我现在已经不敢太早期待了，怕预期拉太满。但不得不说，这几张图确实都很会吊人胃口。", 42, "6小时前"),
    ],
  },
  {
    id: "post-midnight-console-cut",
    type: "VIDEO",
    creatorId: "neo-park",
    creatorName: "深夜不下线",
    creatorHandle: "@midnightsave",
    creatorAvatarSrc: avatars.midnight,
    title: "真正让我记住一台主机的，不只是参数，而是它第一次亮相时那种把你拽进世界里的气场",
    excerpt: "有些设备不是先靠规格让人上头，而是先靠一段发布片把气氛立住。",
    body:
      "这条更像我最近循环播放的一段 launch cut。\n\n真正让我记住一台主机的，不只是参数表，而是它第一次亮相时有没有把一种“新的世界现在要被打开了”的感觉传达出来。\n\n黑色机身、冷光、空间感很强的镜头调度，再加上一点克制的声音设计，整件事会瞬间从“消费电子”变成“文化物件”。你会突然觉得，它卖的不只是性能，而是一种你愿不愿意把晚上交给它的沉浸感。\n\n我很吃这种视频，不是因为它讲得多完整，而是它知道该在哪一秒把你情绪先抓住。\n\n你们会因为一条发布片对某个设备突然改观吗？",
    tags: ["游戏设备", "发布片", "视觉叙事", "主机", "科技美学"],
    stage: "S2_ACTIVE",
    likes: 12800,
    saves: 1432,
    commentsCount: 8,
    timeLabel: "6小时前",
    location: "深圳",
    mediaHeightClass: "h-[420px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-game-trailer-moodboard", "04.png"),
    durationLabel: "00:38",
    comments: [
      makeComment("helix-1", "显卡还在挣扎", "显", avatars.gpu, "这种发布片最会的就是先卖氛围，等你冷静下来才想起自己根本还没看参数。", 61, "1小时前"),
      makeComment("helix-2", "理智消费代表", "参", avatars.tech, "我承认我经常被这种片子骗进去，但也说明它们真的很懂情绪节奏。", 44, "2小时前"),
      makeComment("helix-3", "不熬夜也会看", "夜", avatars.movie, "这种黑色机身配冷光真的太容易做出高级感了。", 36, "3小时前"),
      makeComment("helix-4", "主机还没下单", "机", avatars.calm, "我就是会先被片子拿下，再去说服自己这是理性消费。", 28, "4小时前"),
    ],
  },
  {
    id: "post-dune-afterglow",
    type: "IMAGE",
    creatorId: "mika-zhou",
    creatorName: "胶片落进沙里",
    creatorHandle: "@filmintosand",
    creatorAvatarSrc: avatars.dune,
    title: "有些电影不是“好看”而已，是看完之后整个人还陷在那个世界里",
    excerpt: "不是很热闹、很满的视觉刺激，而是一种极度克制，但压迫感强到离谱的美。",
    body:
      "最近又翻到这组图，还是会被这种气质打到。\n\n不是那种很热闹、很满的视觉刺激，而是一种极度克制，但压迫感强到离谱的美。黄沙、热浪、巨物、决斗、安静到近乎肃穆的画面，每一张都像在说：这里不只是一个故事背景，而是一个会吞没人的世界。\n\n我很喜欢这种电影的原因是，它不是只靠“大场面”让你记住，而是靠气氛、秩序、信仰感和命运感慢慢把你压进去。看的人会很自然地安静下来，因为你知道它讲的不只是打斗或权力，而是一种很庞大的东西正在逼近。\n\n尤其这种沙漠科幻的审美，真的太特别了。颜色很少，情绪很浓；台词可能不多，但每个镜头都像有重量。那种“人在巨大的世界面前其实很小”的感觉，会一直留在心里。\n\n有些电影看完是爽，有些电影看完是会后劲很久。这组图对我来说就是后者。\n\n你们看电影会更在意剧情推进，还是会被这种画面和氛围先拿下？",
    tags: ["电影分享", "科幻电影", "电影美学", "沙漠美学", "观影记录", "沙丘风格"],
    stage: "S1_DISCOVERY",
    likes: 1480,
    saves: 602,
    commentsCount: 6,
    timeLabel: "昨晚",
    location: "北京",
    mediaHeightClass: "h-[320px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-dune-afterglow", "cover.jpg"),
    gallerySrcs: [
      assetPath("2026-04-13-dune-afterglow", "cover.jpg"),
      assetPath("2026-04-13-dune-afterglow", "01.jpg"),
    ],
    hasMultipleImages: true,
    comments: [
      makeComment("dune-1", "夜里只看大银幕", "夜", avatars.game, "这类电影最绝的就是大场面很多，但一点都不吵，反而越安静越有压迫感。", 52, "2小时前"),
      makeComment("dune-2", "冰美式不加糖", "冰", avatars.gpu, "我承认我一开始是冲着画面去的，结果看完发现世界观和气质才是最可怕的，后劲太久了。", 39, "3小时前"),
      makeComment("dune-3", "风从沙里来", "风", avatars.wind, "沙漠在这种电影里已经不是景，是一种权力和生存法则本身。", 58, "4小时前"),
      makeComment("dune-4", "今天也想二刷", "二", avatars.latte, "我真的很吃这种配色，明明全是土黄和暗色，但就是美得很冷。", 44, "5小时前"),
      makeComment("dune-5", "剧情至上派", "剧", avatars.calm, "我个人还是更看重故事，但这类片子确实能做到“光画面就先把你拽进去”。", 31, "6小时前"),
      makeComment("dune-6", "不懂科幻但会共鸣", "共", avatars.movie, "虽然我平时不怎么看科幻，但这种宿命感和孤独感我反而很能代入。", 29, "7小时前"),
    ],
  },
  {
    id: "post-trackside-rain-cut",
    type: "VIDEO",
    creatorId: "luna-cai",
    creatorName: "弯心入坑",
    creatorHandle: "@wanxinrk",
    creatorAvatarSrc: avatars.wanxin,
    title: "雨战镜头最可怕的地方，是它会把速度、危险和审美同时拉满",
    excerpt: "赛道一旦开始下雨，所有画面都会突然从“很好看”变成“好看到让人屏住呼吸”。",
    body:
      "这段我最近会反复看。\n\n赛道一旦开始下雨，所有画面都会突然从“很好看”变成“好看到让人屏住呼吸”。水雾、反光、尾灯、轮胎带起来的雾墙，再加上转播镜头那种贴着速度走的压迫感，整件事会瞬间变得特别像电影。\n\n我喜欢这种片段，不只是因为它刺激，而是因为它会把赛车那种功能性极强的美感拉到最满。每一个动作都更危险，但每一个画面也更成立。\n\n很多人第一次被 F1 击中，可能不是因为规则，而是因为类似这种镜头让你突然意识到：速度真的可以有情绪。\n\n你们最喜欢的雨战镜头是哪一种？高速直道、慢速弯，还是进站那一瞬间？",
    tags: ["F1", "雨战", "转播镜头", "赛车审美", "速度感"],
    stage: "S1_BUYOUT",
    likes: 6240,
    saves: 908,
    commentsCount: 7,
    timeLabel: "3小时前",
    location: "上海",
    mediaHeightClass: "h-[360px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-f1-aesthetics-entry", "03.png"),
    durationLabel: "00:27",
    comments: [
      makeComment("track-1", "风洞研究员007", "风", avatars.wind, "雨战最迷人的就是所有原本熟悉的东西都突然变得不稳定。", 42, "58分钟前"),
      makeComment("track-2", "今天也想去上赛", "赛", avatars.track, "直道上那种雾墙最夸张，几乎看不见前车的时候真的会起鸡皮疙瘩。", 35, "1小时前"),
      makeComment("track-3", "不懂车但会看帅", "看", avatars.neonSea, "这种镜头对我这种外行杀伤力也很大，就是会忍不住一直看。", 31, "2小时前"),
      makeComment("track-4", "理性观赛选手", "理", avatars.calm, "雨战是最能把转播镜头价值拉出来的场景之一。", 22, "3小时前"),
    ],
  },
  {
    id: "post-rocket-dream",
    type: "IMAGE",
    creatorId: "low-orbit",
    creatorName: "低空仰望者",
    creatorHandle: "@loworbitlook",
    creatorAvatarSrc: avatars.rocket,
    title: "有些震撼不是因为它很大，而是你知道它真的想去很远的地方",
    excerpt: "火箭最打动人的地方不只是厉害，而是它同时拥有工程的冷静和人类不讲道理的浪漫。",
    body:
      "看到这种画面的时候，真的会有一种很奇妙的感觉。\n\n海边、清晨、还没完全亮起来的天，一枚火箭安静地立在那里。它没有起飞，没有喷焰，甚至画面本身很安静，但就是这种安静，反而让人更能感受到一种巨大的力量正在被压住。\n\n我一直觉得，火箭最打动人的地方不只是“厉害”，而是它同时拥有两种很少会放在一起的气质：一边是极度冷静的工程、计算、结构、材料、风险控制；另一边又是人类非常不讲道理的浪漫——我们明明知道这件事很难，还是想去更远的地方。\n\n尤其这种靠近海岸线的发射场画面，特别容易让人出神。脚下还是地球，很真实；但你看着它的时候，脑子已经开始往天上走了。\n\n大型工程之所以让人着迷，不只是因为技术突破，而是它把“想象力”做成了实体。\n\n你们看到火箭发射场这种画面，第一反应是震撼、浪漫，还是纯粹的工程美感？",
    tags: ["航天", "火箭", "科技美学", "工程浪漫", "太空探索", "理工科的浪漫"],
    stage: "S1_DISCOVERY",
    likes: 842,
    saves: 318,
    commentsCount: 6,
    timeLabel: "昨天",
    location: "得州海岸",
    mediaHeightClass: "h-[340px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-rocket-dream-engineering", "cover.jpg"),
    gallerySrcs: [
      assetPath("2026-04-13-rocket-dream-engineering", "cover.jpg"),
      assetPath("2026-04-13-rocket-dream-engineering", "01.jpg"),
    ],
    hasMultipleImages: true,
    comments: [
      makeComment("rocket-1", "今天也想上天", "天", avatars.neonSea, "我每次看火箭不是先想到参数，是先想到“原来真的有人在认真做去更远地方这件事”。", 37, "1小时前"),
      makeComment("rocket-2", "咖啡续命工程师", "工", avatars.tech, "外行看浪漫，内行看细节。我一看到这些结构和连接件就会开始想：这背后到底做了多少轮验证。", 51, "2小时前"),
      makeComment("rocket-3", "海边吹风的人", "海", avatars.rocket, "这组图最绝的是环境，海岸线和晨光把火箭衬得特别不真实，像科幻片截图。", 28, "3小时前"),
      makeComment("rocket-4", "宇宙便利店店员", "宇", avatars.latte, "我不懂太多技术，但每次看到火箭都会有点想哭，可能就是那种“人类居然能做到这个”的情绪。", 33, "4小时前"),
      makeComment("rocket-5", "参数先别念", "参", avatars.calm, "大型工程最迷人的点，是你能同时看到想象力和执行力。缺一个都不行。", 42, "5小时前"),
      makeComment("rocket-6", "谨慎乐观派", "谨", avatars.movie, "我第一反应还是风险和成本，但这不影响我觉得它很浪漫。可能真正的浪漫本来就不轻松。", 24, "6小时前"),
    ],
  },
  {
    id: "post-cyberpunk-cities",
    type: "IMAGE",
    creatorId: "night-arrival",
    creatorName: "夜航未降落",
    creatorHandle: "@nightarrival",
    creatorAvatarSrc: avatars.neon,
    title: "有些城市一到夜里，就像现实世界偷偷开了科幻滤镜",
    excerpt: "赛博朋克最迷人的地方不是未来科技，而是它把热闹、孤独、欲望、疏离和浪漫一起塞进了城市。",
    body:
      "我一直很喜欢那种介于现实和科幻之间的画面。\n\n下雨的霓虹、空旷到有点失真的荒地、桥梁从高楼之间穿过去、冷蓝和暖金同时亮着，人站在里面会突然变得很小，像误入了某个未来世界的片场。\n\n有时候觉得，赛博朋克最迷人的地方不是“未来科技”，而是它总能把一种很复杂的情绪放进城市里：热闹、孤独、欲望、疏离、浪漫、失重感，全部同时存在。灯很多，人也很多，但你还是会在某个瞬间觉得自己特别安静。\n\n最妙的是，这种感觉并不只活在电影里。有些城市夜景真的会让人恍惚，你明明站在现实里，却像已经提前看见了未来。高楼、天桥、旧街区、潮湿空气、远处发白的天色，它们拼在一起的时候，画面会有一种很强的叙事感。\n\n我喜欢这种风格，不只是因为它好看，而是因为它总让我觉得：城市从来不只是建筑和道路，它其实会储存情绪，也会制造幻想。\n\n你们看到这种画面，第一反应是浪漫、孤独，还是“这也太像电影了”？",
    tags: ["赛博朋克", "城市夜景", "电影感", "银翼杀手2049", "霓虹美学", "重庆夜景"],
    stage: "S1_BUYOUT",
    likes: 6200,
    saves: 2100,
    commentsCount: 6,
    timeLabel: "昨夜",
    location: "重庆",
    mediaHeightClass: "h-[400px]",
    mediaStyle: "",
    coverSrc: assetPath("2026-04-13-cyberpunk-night-cities", "cover.jpg"),
    gallerySrcs: [
      assetPath("2026-04-13-cyberpunk-night-cities", "cover.jpg"),
      assetPath("2026-04-13-cyberpunk-night-cities", "01.jpg"),
      assetPath("2026-04-13-cyberpunk-night-cities", "02.jpg"),
    ],
    hasMultipleImages: true,
    comments: [
      makeComment("city-1", "凌晨两点不睡", "凌", avatars.neonSea, "第一张真的太像银翼杀手了，雨、霓虹、拥抱，直接把那种“热闹里的孤独感”拍出来了。", 67, "1小时前"),
      makeComment("city-2", "渝中区散步选手", "渝", avatars.rocket, "最后一张很重庆，真的有时候走在桥下和老街旁边，会觉得自己像进了什么未来城市副本。", 59, "2小时前"),
      makeComment("city-3", "废土拾荒指南", "废", avatars.game, "第二张那种空旷感也很绝，不是霓虹型赛博朋克，但有种文明退场之后的冷感。", 44, "3小时前"),
      makeComment("city-4", "城市缝隙收藏家", "城", avatars.tech, "我觉得这种图最吸引人的不是高楼，是新和旧能同时出现在一个画面里。", 36, "4小时前"),
      makeComment("city-5", "恋爱也要下雨天", "恋", avatars.latte, "我承认我先被第一张吸引住了，赛博朋克背景下接吻真的太有宿命感了。", 71, "5小时前"),
      makeComment("city-6", "不太懂但觉得高级", "高", avatars.movie, "我以前一直不理解赛博朋克到底迷人在哪，看完这组突然懂了，就是一种漂亮又有点难过的感觉。", 33, "6小时前"),
    ],
  },
];

export const manifests: ManifestRecord[] = [
  {
    id: "cmna6yckj0000qt4p9rehgen0",
    title: "F1 aesthetics gallery",
    status: "ANCHORED",
    contentType: "IMAGE_CAROUSEL",
    assetCount: 5,
    updatedAtLabel: "6 min ago",
  },
  {
    id: "cmna4hq390006qteqss16aj8b",
    title: "Game trailer moodboard",
    status: "READY",
    contentType: "IMAGE_CAROUSEL",
    assetCount: 5,
    updatedAtLabel: "28 min ago",
  },
];

export const intents: IntentRecord[] = [
  {
    id: "intent-luna-radiantlab",
    creatorId: "luna-cai",
    creatorName: "弯心入坑",
    sponsorName: "Apex Motion",
    status: "AWAITING_SPONSOR",
    actionOwner: "sponsor",
    track1BaseUsd: 1200,
    track2PoolUsd: 2400,
    track3PoolUsd: 3000,
    metric: "Saves",
    targetValue: "18,000",
    manifestTitle: "F1 aesthetics gallery",
    deadlineLabel: "Closes in 18h",
  },
  {
    id: "intent-neo-pulsefit",
    creatorId: "neo-park",
    creatorName: "深夜不下线",
    sponsorName: "Nova Screen",
    status: "CREATOR_PARTIAL",
    actionOwner: "sponsor",
    track1BaseUsd: 1800,
    track2PoolUsd: 3600,
    track3PoolUsd: 5200,
    metric: "Clicks",
    targetValue: "9,500",
    manifestTitle: "Game trailer moodboard",
    deadlineLabel: "Closes in 9h",
  },
  {
    id: "intent-mika-grain",
    creatorId: "mika-zhou",
    creatorName: "胶片落进沙里",
    sponsorName: "Slate Journal",
    status: "BUNDLE_BUILT",
    actionOwner: "creator",
    track1BaseUsd: 900,
    track2PoolUsd: 1400,
    track3PoolUsd: 2100,
    metric: "Views",
    targetValue: "120,000",
    manifestTitle: "Dune afterglow note",
    deadlineLabel: "Closes in 26h",
  },
];

export const campaigns: CampaignRecord[] = [
  {
    id: "proposal-radiantlab-luna",
    creatorName: "弯心入坑",
    sponsorName: "Apex Motion",
    status: "TRACK2_OPEN",
    contentHashShort: "a46c...1da7",
    contentAnchorShort: "5Y3s...Rx2N",
    track1BaseUsd: 1200,
    track2PoolUsd: 2400,
    track3PoolUsd: 3000,
    metric: "Saves",
    actualValue: "12,480 / 18,000",
    chainTxShort: "5e3E...oZ4m",
  },
  {
    id: "proposal-pulsefit-neo",
    creatorName: "深夜不下线",
    sponsorName: "Nova Screen",
    status: "FUNDED",
    contentHashShort: "d1cc...ab91",
    contentAnchorShort: "9vQ4...cK8j",
    track1BaseUsd: 1800,
    track2PoolUsd: 3600,
    track3PoolUsd: 5200,
    metric: "Clicks",
    actualValue: "Pending report",
    chainTxShort: "2RzM...Xn7Q",
  },
];

export const currentUser = {
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

export const loginPreviewDefaultMode: LoginPreviewMode = "welcome";

export const loginMethods: LoginMethodRecord[] = [
  {
    id: "email",
    label: "邮箱登录 / 注册",
    subtitle: "最轻量的账户入口",
  },
  {
    id: "google",
    label: "使用 Google 登录",
    subtitle: "默认社交登录路径",
  },
  {
    id: "apple",
    label: "使用 Apple 登录",
    subtitle: "适合 iPhone 与 Mac 用户",
  },
  {
    id: "wallet",
    label: "钱包登录",
    subtitle: "面向签名和高控制权用户",
    tone: "wallet",
  },
];

export const loginAccounts: LoginAccountRecord[] = [
  {
    id: currentUser.id,
    name: currentUser.name,
    handle: currentUser.handle,
    avatarSrc: currentUser.avatarSrc,
    sessionLabel: "当前会话",
    methodLabel: "Google + Embedded Wallet",
    isCurrent: true,
  },
  {
    id: "neo-preview-account",
    name: "Neo Park",
    handle: "@midnightsave",
    avatarSrc: avatars.midnight,
    sessionLabel: "最近登录",
    methodLabel: "Apple Login",
  },
  {
    id: "wallet-preview-account",
    name: "Luna Cai",
    handle: "@wanxinrk",
    avatarSrc: avatars.wanxin,
    sessionLabel: "钱包身份",
    methodLabel: "Phantom",
  },
];

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

export const currentUserSavedPosts = posts.slice(0, 4).map((post) => ({
  id: `saved-${post.id}`,
  title: post.title,
  coverSrc: post.coverSrc,
  likes: post.likes,
  stage: post.stage,
  authorName: post.creatorName,
  authorAvatarSrc: post.creatorAvatarSrc,
  mediaHeightClass: post.mediaHeightClass,
}));

export const currentUserLikedPosts = posts.slice(1, 5).map((post) => ({
  id: `liked-${post.id}`,
  title: post.title,
  coverSrc: post.coverSrc,
  likes: post.likes,
  stage: post.stage,
  authorName: post.creatorName,
  authorAvatarSrc: post.creatorAvatarSrc,
  mediaHeightClass: post.mediaHeightClass,
}));

export const portfolioHoldings: PortfolioHoldingRecord[] = [
  {
    creatorId: "luna-cai",
    tokenCount: 154,
    avgEntryUsd: 2.64,
    unrealizedChangePct: 18.4,
    note: "Buyout already accepted. This holding is about claim visibility and supporter payout timing.",
    currentPriceUsd: 3.24,
    trend: [2.72, 2.84, 2.76, 2.91, 3.03, 3.14, 3.2, 3.24],
  },
  {
    creatorId: "neo-park",
    tokenCount: 198,
    avgEntryUsd: 4.38,
    unrealizedChangePct: 32.8,
    note: "This creator already crossed into S2. The next step is campaign continuity, not discovery risk.",
    currentPriceUsd: 5.82,
    trend: [4.92, 5.18, 5.46, 5.08, 5.24, 5.49, 5.68, 5.82],
  },
  {
    creatorId: "mika-zhou",
    tokenCount: 94,
    avgEntryUsd: 1.87,
    unrealizedChangePct: 0,
    note: "Still in S1 discovery. Watch graduation pressure and category momentum before adding more.",
    currentPriceUsd: 1.87,
    trend: [2.26, 2.18, 2.08, 1.99, 1.92, 1.88, 1.87, 1.87],
  },
];

export const portfolioExposureTrend: PortfolioExposurePointRecord[] = [
  { label: "Apr 7", value: 1528.4 },
  { label: "Apr 8", value: 1606.1 },
  { label: "Apr 9", value: 1642.8 },
  { label: "Apr 10", value: 1708.2 },
  { label: "Apr 11", value: 1765.9 },
  { label: "Apr 12", value: 1788.6 },
  { label: "Apr 13", value: 1812.4 },
  { label: "Apr 14", value: 1827.1 },
];

export const portfolioClaimWindows: PortfolioClaimWindowRecord[] = [
  {
    id: "claim-luna",
    creatorId: "luna-cai",
    eligibleTokens: 154,
    claimPriceUsd: 3.24,
    payoutUsd: 498.96,
    closesInLabel: "2d 0h left",
    statusLabel: "Claim window approaching",
  },
];

export const portfolioUpcomingClaims: PortfolioUpcomingClaimRecord[] = [
  {
    id: "upcoming-mika",
    creatorId: "mika-zhou",
    eligibleTokens: 94,
    expectedPriceUsd: 2.1,
    opensInLabel: "in 14 days",
    estimatedPayoutUsd: 197.4,
  },
];

export const portfolioReentryPositions: PortfolioReentryRecord[] = [
  {
    id: "reentry-neo",
    creatorId: "neo-park",
    exitPriceUsd: 3.9,
    currentPriceUsd: 5.82,
    exitedAtLabel: "Exited Feb 15, 2026",
    sinceExitPerformancePct: 49.2,
    thesis: "S1 → S2 transition",
  },
  {
    id: "reentry-luna",
    creatorId: "luna-cai",
    exitPriceUsd: 2.2,
    currentPriceUsd: 3.24,
    exitedAtLabel: "Exited Dec 8, 2025",
    sinceExitPerformancePct: 47.3,
    thesis: "Pre-S1 early exit",
  },
];

export const portfolioActions: PortfolioActionRecord[] = [
  {
    id: "action-luna-buyout",
    title: "Claim window is approaching",
    body: "弯心入坑的 buyout 支持者分配即将进入可见阶段。这里应该持续提醒，而不是让用户自己记。",
    tone: "buyout",
    creatorId: "luna-cai",
    actionLabel: "View buyout detail",
  },
  {
    id: "action-neo-s2",
    title: "Re-entry through S2 content pool",
    body: "深夜不下线已经在跑 sponsor-backed launches。这个入口应该帮助用户从 S1 暴露顺滑跳到正在执行的 S2 语境。",
    tone: "opportunity",
    creatorId: "neo-park",
    actionLabel: "Open creator page",
  },
  {
    id: "action-market-rhythm",
    title: "Portfolio should feel like a content habit",
    body: "This page should still look like the same user product as Explore. It is not a separate admin dashboard.",
    tone: "neutral",
  },
];

export const discoverCategories = ["推荐", "赛车", "游戏", "电影", "科技", "城市", "氛围", "创作者观察"];

const activityPost = (postId: string) => posts.find((post) => post.id === postId) ?? posts[0];

export const followedCreatorIds = ["neo-park", "luna-cai", "mika-zhou", "low-orbit"];

export const activityFeedTabs: ActivityFeedTabRecord[] = [
  { id: "overview", label: "综合" },
  { id: "video", label: "视频" },
];

export const activityAuthors: ActivityAuthorRecord[] = [
  {
    creatorId: "neo-park",
    note: "预告氛围和主机发布片更新很快",
    hasUnread: true,
  },
  {
    creatorId: "luna-cai",
    note: "F1 视觉向内容在持续冒头",
  },
  {
    creatorId: "mika-zhou",
    note: "偏电影感长文和克制图文",
  },
  {
    creatorId: "low-orbit",
    note: "工程与航天类内容保持稳定更新",
  },
];

export const activityFeedItems: ActivityFeedItemRecord[] = [
  {
    id: "activity-post-console-cut",
    kind: "post",
    creatorId: "neo-park",
    postId: "post-midnight-console-cut",
    postedAtLabel: "6小时前",
    title: "新的主机 launch cut 一出来，我又被那种“世界现在要被打开了”的气场打回来了。",
    body: "有些设备不是先靠规格让人上头，而是先靠一段发布片把气氛立住。冷光、空间感和克制的声音设计，一下就把消费电子拉进文化物件的语境里。",
    actionSummary: "#主机发布 #视觉叙事 #设备氛围",
    commentsCount: 8,
    likesCount: 365,
    sharesCount: 52,
    coverSrc: activityPost("post-midnight-console-cut").coverSrc,
    mediaType: "VIDEO",
    durationLabel: activityPost("post-midnight-console-cut").durationLabel,
    stage: "S2_ACTIVE",
  },
  {
    id: "activity-status-rain",
    kind: "status",
    creatorId: "luna-cai",
    postId: "post-trackside-rain-cut",
    postedAtLabel: "3小时前",
    body: "雨战镜头真正可怕的地方，是它会把速度、危险和审美同时拉满。今天又把那段水雾和尾灯的画面翻出来循环了一遍。",
    actionSummary: "更新了一个短动态 · 点击进入帖子详情",
    commentsCount: 16,
    likesCount: 148,
    sharesCount: 19,
    coverSrc: activityPost("post-trackside-rain-cut").coverSrc,
    mediaType: "VIDEO",
    durationLabel: activityPost("post-trackside-rain-cut").durationLabel,
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
    id: "activity-status-rocket",
    kind: "status",
    creatorId: "low-orbit",
    postId: "post-rocket-dream",
    postedAtLabel: "昨天",
    body: "有些震撼不是因为它很大，而是你知道它真的想去很远的地方。海岸线上的火箭还没起飞，浪漫已经先立住了。",
    actionSummary: "来自关注创作者的近况更新",
    commentsCount: 11,
    likesCount: 126,
    sharesCount: 14,
    coverSrc: activityPost("post-rocket-dream").coverSrc,
    mediaType: "IMAGE",
    stage: "S1_DISCOVERY",
  },
  {
    id: "activity-post-game",
    kind: "post",
    creatorId: "neo-park",
    postId: "post-game-trailer-moodboard",
    postedAtLabel: "9小时前",
    title: "这几款游戏还没全玩到，我的精神状态已经先被预告片拿捏了。",
    body: "现在让我上头的游戏，已经不只是好不好玩了，而是它们有没有一种一眼就把你拽进世界里的能力。风格不同，但共同点都是沉浸感先抵达。",
    actionSummary: "#游戏预告 #世界观海报 #情绪板",
    commentsCount: 12,
    likesCount: 468,
    sharesCount: 71,
    coverSrc: activityPost("post-game-trailer-moodboard").coverSrc,
    mediaType: "IMAGE",
    stage: "S2_ACTIVE",
  },
];

export const activityVideoItems: ActivityVideoItemRecord[] = [
  {
    id: "activity-video-console",
    creatorId: "neo-park",
    postId: "post-midnight-console-cut",
    title: "主机发布片这种东西，很多时候先卖的是世界观，不是参数表。",
    coverSrc: activityPost("post-midnight-console-cut").coverSrc,
    durationLabel: "00:38",
    viewsCount: 12800,
    commentsCount: 8,
    timeLabel: "6小时前",
  },
  {
    id: "activity-video-rain",
    creatorId: "luna-cai",
    postId: "post-trackside-rain-cut",
    title: "雨战镜头会把速度、危险和审美一次性拉满。",
    coverSrc: activityPost("post-trackside-rain-cut").coverSrc,
    durationLabel: "00:27",
    viewsCount: 6240,
    commentsCount: 7,
    timeLabel: "3小时前",
  },
  {
    id: "activity-video-game",
    creatorId: "neo-park",
    postId: "post-game-trailer-moodboard",
    title: "这些游戏还没全玩到，但预告片已经先把情绪做满了。",
    coverSrc: activityPost("post-game-trailer-moodboard").coverSrc,
    durationLabel: "02:29",
    viewsCount: 20800,
    commentsCount: 12,
    timeLabel: "9小时前",
  },
  {
    id: "activity-video-f1",
    creatorId: "luna-cai",
    postId: "post-f1-aesthetics",
    title: "喜欢 F1 的起点，也可能只是被一台车的外形瞬间击中。",
    coverSrc: activityPost("post-f1-aesthetics").coverSrc,
    durationLabel: "01:18",
    viewsCount: 8420,
    commentsCount: 9,
    timeLabel: "1天前",
  },
  {
    id: "activity-video-dune",
    creatorId: "mika-zhou",
    postId: "post-dune-afterglow",
    title: "《沙丘》这种片子最狠的不是热闹，是那种安静但很重的压迫感。",
    coverSrc: activityPost("post-dune-afterglow").coverSrc,
    durationLabel: "01:42",
    viewsCount: 4140,
    commentsCount: 6,
    timeLabel: "昨晚",
  },
  {
    id: "activity-video-rocket",
    creatorId: "low-orbit",
    postId: "post-rocket-dream",
    title: "看火箭的时候最先冒出来的情绪，常常不是参数而是浪漫。",
    coverSrc: activityPost("post-rocket-dream").coverSrc,
    durationLabel: "00:54",
    viewsCount: 3820,
    commentsCount: 6,
    timeLabel: "昨天",
  },
];

export const activitySidebarHighlights: ActivitySidebarHighlightRecord[] = [
  {
    creatorId: "neo-park",
    headline: "新一轮主机与 3A 预告内容继续带动互动。",
    statusLabel: "S2 campaign cadence",
  },
  {
    creatorId: "luna-cai",
    headline: "F1 雨战短视频和美学图文都在涨评论深度。",
    statusLabel: "Buyout window in focus",
  },
  {
    creatorId: "mika-zhou",
    headline: "长文类电影美学内容停留时间稳定。",
    statusLabel: "S1 discovery retained",
  },
  {
    creatorId: "low-orbit",
    headline: "航天与工程浪漫题材在持续刷新收藏率。",
    statusLabel: "Quiet but compounding",
  },
];

export const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);

export const compactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const findCreator = (creatorId: string) =>
  creators.find((creator) => creator.id === creatorId) ?? creators[0];

export const findIntent = (intentId: string) =>
  intents.find((intent) => intent.id === intentId) ?? intents[0];

export const findCampaign = (campaignId: string) =>
  campaigns.find((campaign) => campaign.id === campaignId) ?? campaigns[0];

export const findManifest = (manifestId: string) =>
  manifests.find((manifest) => manifest.id === manifestId) ?? manifests[0];

export const findPost = (postId: string) =>
  posts.find((post) => post.id === postId) ?? posts[0];
