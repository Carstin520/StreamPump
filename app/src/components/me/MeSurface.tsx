import Link from "next/link";
import { startTransition, useMemo, useState } from "react";

import { InfluenceChip } from "@/components/shared/InfluenceChip";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { CurrentUserRecord, InfluenceRecord, PostRecord, UserNoteRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { EXPLORE_PATH } from "@/lib/routes";
import { compactNumber } from "@/lib/mocks/utils";

type MeTab = "saved" | "history" | "likes" | "about";

export const MeSurface = ({
  currentUser,
  influence,
  posts,
  savedPosts,
}: {
  currentUser: CurrentUserRecord;
  influence: InfluenceRecord | null;
  posts: PostRecord[];
  savedPosts: UserNoteRecord[];
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<MeTab>("saved");

  const likedPosts = useMemo(
    () => posts.slice(1, 7).map((post): UserNoteRecord => ({
      id: `liked-${post.id}`,
      sourcePostId: post.id,
      title: post.title,
      coverSrc: post.coverSrc,
      likes: post.likes,
      stage: post.stage,
      authorName: post.creatorName,
      authorAvatarSrc: post.creatorAvatarSrc,
      mediaHeightClass: "h-32",
    })),
    [posts],
  );

  const tabs: { id: MeTab; label: string; count?: number }[] = [
    { id: "saved", label: t("me.tab.saved"), count: savedPosts.length },
    { id: "history", label: t("me.tab.history") },
    { id: "likes", label: t("me.tab.likes"), count: likedPosts.length },
    { id: "about", label: t("me.tab.about") },
  ];

  return (
    <div className="mx-auto max-w-[960px] space-y-4 py-3">
      <ProfileHeader currentUser={currentUser} influence={influence} />

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            className={`relative flex items-center gap-1.5 px-4 pb-3 pt-1 text-sm font-medium transition ${
              activeTab === tab.id ? "text-white" : "text-[#7f90ab] hover:text-white"
            }`}
            key={tab.id}
            onClick={() => startTransition(() => setActiveTab(tab.id))}
            type="button"
          >
            {tab.label}
            {tab.count != null ? (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-[#8ea0ba]">
                {tab.count}
              </span>
            ) : null}
            {activeTab === tab.id ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#de402a]" />
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "saved" ? <SavedContent savedPosts={savedPosts} /> : null}
      {activeTab === "history" ? <HistoryTab /> : null}
      {activeTab === "likes" ? <LikesTab likedPosts={likedPosts} /> : null}
      {activeTab === "about" ? <AboutTab currentUser={currentUser} /> : null}
    </div>
  );
};

/* ──────────────────────────────  Profile header  ────────────────────────────── */

const ProfileHeader = ({ currentUser, influence }: { currentUser: CurrentUserRecord; influence: InfluenceRecord | null }) => {
  const { t } = useI18n();
  const truncatedWallet = currentUser.primaryWallet
    ? `${currentUser.primaryWallet.slice(0, 4)}...${currentUser.primaryWallet.slice(-4)}`
    : null;

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(14,20,30,0.92)_0%,rgba(10,14,22,0.92)_100%)]">
      <div className="relative h-28 sm:h-36">
        {currentUser.bannerSrc ? (
          <ProgressiveImage
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            fill
            sizes="960px"
            src={currentUser.bannerSrc}
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0d1b2a_0%,#1a2845_40%,#0d1b2a_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,14,22,0.92)] to-transparent" />
      </div>

      <div className="relative px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
          <img
            alt={currentUser.name}
            className="h-20 w-20 rounded-2xl border-[3px] border-[#0e1420] object-cover shadow-lg sm:h-24 sm:w-24"
            src={currentUser.avatarSrc}
          />
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-[-0.03em] text-white sm:text-2xl">{currentUser.name}</h1>
              {influence ? <InfluenceChip influence={influence} /> : null}
              {currentUser.sessionMode ? (
                <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8ea0ba]">
                  {currentUser.sessionMode}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-[#7e90aa]">@{currentUser.handle}</p>
          </div>
          <Link
            className="hidden shrink-0 items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white transition hover:bg-white/[0.08] sm:inline-flex"
            href="/onboarding"
          >
            {t("me.editProfile")}
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#8ea0ba]">
          <span className="flex items-center gap-1">
            <strong className="text-white">{compactNumber(currentUser.followingCount)}</strong> following
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-white">{compactNumber(currentUser.followersCount)}</strong> followers
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-white">{compactNumber(currentUser.totalLikesAndSavesCount)}</strong> likes & saves
          </span>
          {truncatedWallet ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-[#5a6d87]">
              {t("me.wallet")}: {truncatedWallet}
            </span>
          ) : null}
          {currentUser.location ? (
            <span className="text-[#5a6d87]">{currentUser.location}</span>
          ) : null}
        </div>

        {currentUser.bio ? (
          <p className="mt-2.5 text-[13px] leading-6 text-[#b8c6da]">{currentUser.bio}</p>
        ) : null}
      </div>
    </div>
  );
};

/* ──────────────────────────────  Saved content tab  ────────────────────────────── */

const SavedContent = ({ savedPosts }: { savedPosts: UserNoteRecord[] }) => {
  const { t } = useI18n();

  if (savedPosts.length === 0) {
    return (
      <EmptyState
        cta={t("me.saved.emptyHint")}
        href={EXPLORE_PATH}
        title={t("me.saved.empty")}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {savedPosts.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
};

/* ──────────────────────────────  History tab  ────────────────────────────── */

const HistoryTab = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <MockPreviewBadge />
      <EmptyState
        cta={t("me.history.emptyHint")}
        href={EXPLORE_PATH}
        title={t("me.history.empty")}
      />
    </div>
  );
};

/* ──────────────────────────────  Likes tab  ────────────────────────────── */

const LikesTab = ({ likedPosts }: { likedPosts: UserNoteRecord[] }) => {
  const { t } = useI18n();

  if (likedPosts.length === 0) {
    return (
      <div className="space-y-3">
        <MockPreviewBadge />
        <EmptyState
          cta={t("me.likes.emptyHint")}
          href={EXPLORE_PATH}
          title={t("me.likes.empty")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MockPreviewBadge />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {likedPosts.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    </div>
  );
};

/* ──────────────────────────────  About tab  ────────────────────────────── */

const AboutTab = ({ currentUser }: { currentUser: CurrentUserRecord }) => {
  const { t } = useI18n();
  const truncatedWallet = currentUser.primaryWallet
    ? `${currentUser.primaryWallet.slice(0, 6)}...${currentUser.primaryWallet.slice(-6)}`
    : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(14,20,30,0.88)_0%,rgba(10,14,22,0.88)_100%)] px-4 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6f8099]">Bio</h3>
        <p className="mt-2 text-sm leading-7 text-[#b8c6da]">
          {currentUser.bio || t("me.bio.empty")}
        </p>
      </section>

      <section className="rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(14,20,30,0.88)_0%,rgba(10,14,22,0.88)_100%)] px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6f8099]">Details</h3>
        <div className="space-y-2 text-sm">
          {truncatedWallet ? (
            <DetailRow label={t("me.wallet")} value={truncatedWallet} mono />
          ) : null}
          {currentUser.location ? (
            <DetailRow label="Location" value={currentUser.location} />
          ) : null}
          <DetailRow label="Handle" value={`@${currentUser.handle}`} />
          <DetailRow label="Session" value={currentUser.sessionMode} />
        </div>
      </section>
    </div>
  );
};

const DetailRow = ({ label, mono, value }: { label: string; mono?: boolean; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <span className="text-xs text-[#6f8099]">{label}</span>
    <span className={`truncate text-xs text-white ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

/* ──────────────────────────────  Shared components  ────────────────────────────── */

const NoteCard = ({ note }: { note: UserNoteRecord }) => (
  <Link
    className="group block overflow-hidden rounded-[14px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(14,20,30,0.88)_0%,rgba(10,14,22,0.88)_100%)] transition hover:border-white/[0.1]"
    href={note.sourcePostId ? `/posts/${note.sourcePostId}` : "#"}
  >
    {note.coverSrc ? (
      <div className="relative aspect-[16/10] overflow-hidden">
        <ProgressiveImage
          alt={note.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          src={note.coverSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(7,13,21,0.7)_100%)]" />
        <div className="absolute bottom-2 left-2.5 z-[2]">
          <StagePill compact stage={note.stage} />
        </div>
      </div>
    ) : null}
    <div className="px-3 py-2.5">
      <p className="line-clamp-2 text-[13px] font-medium leading-5 text-white">{note.title}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8ea0ba]">
        <img alt={note.authorName} className="h-4 w-4 rounded-full object-cover" src={note.authorAvatarSrc} />
        <span className="truncate">{note.authorName}</span>
        <span className="text-[#3e4a5e]">·</span>
        <span>{compactNumber(note.likes)} likes</span>
      </div>
    </div>
  </Link>
);

const MockPreviewBadge = () => (
  <div className="flex items-center gap-2">
    <span className="rounded border border-[#f3b33e]/20 bg-[#1a1408]/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#f3c66e]">
      Mock Preview
    </span>
    <span className="text-[10px] text-[#6f8099]">Derived from feed posts — not from user action history</span>
  </div>
);

const EmptyState = ({ cta, href, title }: { cta: string; href: string; title: string }) => (
  <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-6 py-10 text-center">
    <p className="text-sm font-medium text-white">{title}</p>
    <p className="mx-auto mt-2 max-w-[360px] text-xs text-[#7e90aa]">{cta}</p>
    <Link className="mt-4 inline-flex rounded-full bg-[#de402a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ea523e]" href={href}>
      Explore
    </Link>
  </div>
);
