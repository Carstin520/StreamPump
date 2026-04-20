import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { PostRecord, UserNoteRecord } from "@/lib/api/types";
import { compactNumber } from "@/lib/public-data";

export const PROFILE_TABS = ["笔记", "收藏", "点赞"] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export const ProfileHero = ({
  avatarSrc,
  bannerSrc,
  bio,
  followersCount,
  followingCount,
  handle,
  likesAndSavesCount,
  location,
  name,
}: {
  avatarSrc: string;
  bannerSrc: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  handle: string;
  likesAndSavesCount: number;
  location: string;
  name: string;
}) => (
  <section className="mx-auto max-w-[1360px] px-2 pt-3 md:px-4 md:pt-5">
    <div className="liquid-glass-shell">
      <div className="relative h-[250px] overflow-hidden md:h-[340px]">
        <ProgressiveImage
          alt={`${name} banner`}
          className="h-full w-full object-cover"
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          src={bannerSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,13,0.02)_0%,rgba(6,10,16,0.12)_20%,rgba(7,12,19,0.38)_48%,rgba(7,12,19,0.74)_68%,rgba(7,12,19,0.96)_88%,rgba(7,12,19,1)_100%)]" />
      </div>

      <div className="px-5 pb-10 md:px-8 md:pb-12">
        <div className="-mt-16 flex flex-col items-center text-center md:-mt-20">
          <div className="h-28 w-28 overflow-hidden rounded-full border-[4px] border-[#09111b] bg-[#121b2b] shadow-[0_30px_70px_rgba(0,0,0,0.42)] md:h-32 md:w-32">
            <img alt={name} className="h-full w-full object-cover" src={avatarSrc} />
          </div>

          <h1 className="mt-6 max-w-[760px] truncate text-[42px] font-semibold tracking-[-0.07em] text-white md:text-[58px]">{name}</h1>
          <p className="mt-2 max-w-[620px] truncate text-sm text-[#8da0bb] md:text-[17px]">
            {handle} · IP属地: {location}
          </p>
          <p className="mt-6 line-clamp-4 max-w-[760px] text-sm leading-8 text-[#c7d1e0] md:text-[18px]">
            {bio}
          </p>

          <div className="mt-10 grid w-full max-w-[620px] grid-cols-3 gap-4">
            <HeroStat label="关注" value={formatProfileCount(followingCount)} />
            <HeroStat label="粉丝" value={formatProfileCount(followersCount)} />
            <HeroStat label="获赞与收藏" value={formatProfileCount(likesAndSavesCount)} />
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <button
              className="glass-button-ghost px-8 py-3 text-base font-semibold"
              type="button"
            >
              编辑资料
            </button>
            <button
              className="glass-button-primary px-8 py-3 text-base font-semibold"
              type="button"
            >
              + 创作
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const ProfileTabBar = ({
  activeTab,
  onTabChange,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) => (
  <section className="mx-auto mt-8 max-w-[1360px] px-2 md:px-4">
    <div className="glass-divider h-px w-full" />
    <div className="mx-auto flex max-w-[420px] items-center justify-center gap-10 pt-5">
        {PROFILE_TABS.map((tab) => (
          <button
            className={`relative pb-4 text-[15px] font-medium transition ${
              activeTab === tab ? "text-white" : "text-[#8394ad] hover:text-white"
            }`}
            key={tab}
            onClick={() => onTabChange(tab)}
            type="button"
          >
            {tab}
            {activeTab === tab ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" />
            ) : null}
          </button>
        ))}
      </div>
  </section>
);

export const ProfileNoteGrid = ({
  items,
  onOpen,
}: {
  items: UserNoteRecord[];
  onOpen: (item: UserNoteRecord) => void;
}) => (
  <section className="mx-auto max-w-[1360px] px-2 pb-10 pt-6 md:px-4">
    <div className="masonry-grid">
      {items.map((item, index) => (
        <ProfileNoteCard
          item={item}
          key={item.id}
          onOpen={() => onOpen(item)}
          priority={index < 3}
        />
      ))}
    </div>
  </section>
);

export const resolveItemPostId = (item: UserNoteRecord) => {
  if (item.id.startsWith("saved-")) {
    return item.id.replace("saved-", "");
  }

  if (item.id.startsWith("liked-")) {
    return item.id.replace("liked-", "");
  }

  return item.sourcePostId ?? "";
};

export const resolveProfilePosts = (items: UserNoteRecord[], posts: PostRecord[]) => {
  const postIndex = new Map(posts.map((post) => [post.id, post]));
  const seen = new Set<string>();
  const resolved: PostRecord[] = [];

  for (const item of items) {
    const postId = resolveItemPostId(item);
    if (!postId || seen.has(postId)) {
      continue;
    }

    const post = postIndex.get(postId);
    if (!post) {
      continue;
    }

    seen.add(postId);
    resolved.push(post);
  }

  return resolved;
};

const HeroStat = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <p className="text-[34px] font-semibold tracking-[-0.05em] text-white md:text-[42px]">{value}</p>
    <p className="mt-2 text-sm text-[#8698b2]">{label}</p>
  </div>
);

const ProfileNoteCard = ({
  item,
  onOpen,
  priority = false,
}: {
  item: UserNoteRecord;
  onOpen: () => void;
  priority?: boolean;
}) => (
  <button className="mb-5 block w-full text-left break-inside-avoid" onClick={onOpen} type="button">
    <article className="glass-card overflow-hidden border-white/[0.06] bg-[#101621]">
      <div className={`relative overflow-hidden ${item.mediaHeightClass}`}>
        <ProgressiveImage
          alt={item.title}
          className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1440px) 50vw, 33vw"
          src={item.coverSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_35%,rgba(8,17,28,0.24)_55%,rgba(8,17,28,0.62)_78%,rgba(8,17,28,0.88)_100%)]" />
        <div className="absolute left-4 top-4">
          <StagePill stage={item.stage} />
        </div>
      </div>

      <div className="glass-card-footer px-5 pb-5 pt-4">
        <p className="line-clamp-2 text-[18px] font-medium leading-8 text-white">{item.title}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img alt={item.authorName} className="h-8 w-8 rounded-full object-cover" src={item.authorAvatarSrc} />
            <span className="truncate text-sm text-[#9aabc1]">{item.authorName}</span>
          </div>
          <span className="shrink-0 text-sm text-[#8ea0ba]">♡ {compactNumber(item.likes)}</span>
        </div>
      </div>
    </article>
  </button>
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
