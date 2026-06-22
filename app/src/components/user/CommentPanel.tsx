import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { FollowCheckIcon, FollowPlusIcon, HeartOutlineIcon, HeartSolidIcon, SendRoundedIcon } from "@/components/shared/AppIcons";
import { StagePill } from "@/components/shared/StagePill";
import { CommentRecord, PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { requireInteractiveSession } from "@/lib/interaction-auth";
import { compactNumber } from "@/lib/public-data";

const ANONYMOUS_USER = {
  name: "You",
  avatarSrc: "/mock/user-surface/posts/cat-portrait.svg",
};

export const CommentPanel = ({
  post,
  variant = "sidebar",
}: {
  post: PostRecord;
  variant?: "sidebar" | "sheet";
}) => {
  const { t } = useI18n();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [comments, setComments] = useState(post.comments);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  useEffect(() => {
    setComments(post.comments);
    setComposerValue("");
    setLiked(false);
    setSaved(false);
    setIsFollowing(false);
    setHighlightKey(null);
  }, [post.id, post.comments]);

  const triggerHighlight = (key: string) => {
    setHighlightKey(key);
    window.setTimeout(() => {
      setHighlightKey((value) => (value === key ? null : value));
    }, 340);
  };

  const toggleFollow = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }

    setIsFollowing((value) => !value);
    triggerHighlight("follow");
  };

  const toggleLike = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }

    setLiked((value) => !value);
    triggerHighlight("like");
  };

  const toggleSave = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }

    setSaved((value) => !value);
    triggerHighlight("save");
  };

  const publishComment = () => {
    if (!requireInteractiveSession(router)) {
      return;
    }

    const content = composerValue.trim();
    if (!content) {
      triggerHighlight("composer");
      return;
    }

    setComments((value) => [
      {
        id: `new-${Date.now()}`,
        author: ANONYMOUS_USER.name,
        avatarSeed: "A",
        avatarSrc: ANONYMOUS_USER.avatarSrc,
        content,
        likes: 0,
        timeLabel: t("feed.justNow"),
      },
      ...value,
    ]);
    setComposerValue("");
    triggerHighlight("publish");
  };

  return (
    <aside
    className={`flex h-full flex-col ${
      variant === "sidebar"
        ? "bg-[linear-gradient(180deg,rgba(16,23,34,0.98)_0%,rgba(10,14,21,0.98)_100%)]"
        : "bg-transparent"
    }`}
  >
    <div className="border-b border-white/[0.045] px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/creators/${post.creatorId}`}>
            <img
              alt={post.creatorName}
              className="h-10 w-10 cursor-pointer rounded-full object-cover ring-1 ring-white/16"
              src={post.creatorAvatarSrc}
            />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link className="text-sm font-semibold text-white hover:underline" href={`/creators/${post.creatorId}`}>
                {post.creatorName}
              </Link>
              <StagePill compact stage={post.stage} />
            </div>
            <p className="text-xs text-[#8799b3]">{post.creatorHandle}</p>
          </div>
        </div>
        <button
          className={`liquid-glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:scale-[1.02] hover:bg-white/10 ${
            highlightKey === "follow" ? "tap-bounce-active" : ""
          } ${isFollowing ? "border-[#90efac]/30 bg-[#13291f]/70 text-[#90efac]" : ""}`}
          onClick={toggleFollow}
          type="button"
        >
          <span className="inline-flex items-center gap-1.5">
            {isFollowing ? <FollowCheckIcon className="h-4 w-4" /> : <FollowPlusIcon className="h-4 w-4" />}
            {isFollowing ? t("feed.following") : t("feed.follow")}
          </span>
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-5 py-5" data-post-scroll-region>
      <h1 className="line-clamp-3 text-[24px] font-semibold leading-8 tracking-[-0.04em] text-white">{post.title}</h1>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#d3dbe9]">{post.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span className="text-xs text-[#de725f]" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#7a8ba5]">
        {post.timeLabel} · {post.location}
      </p>

      <div className="my-6 h-px bg-white/[0.045]" />

      <p className="mb-5 text-sm font-semibold text-white">
        {t("feed.commentCount", { count: compactNumber(comments.length) })}
      </p>
      <div className="space-y-5">
        {comments.map((comment, index) => (
          <CommentRow comment={comment} emphasized={index === 0 && comment.author === ANONYMOUS_USER.name} key={comment.id} />
        ))}
      </div>
    </div>

    <div className="border-t border-white/[0.045] px-5 py-4">
      <div className="mb-3 flex items-center gap-5 px-1">
        <button
          className={`flex items-center gap-1.5 text-sm transition hover:text-white ${
            liked ? "text-[#ff9fc4]" : "text-[#c7d2e3]"
          } ${highlightKey === "like" ? "tap-bounce-active" : ""}`}
          onClick={toggleLike}
          type="button"
        >
          {liked ? <HeartSolidIcon className="h-4 w-4" /> : <HeartOutlineIcon className="h-4 w-4" />}
          <span>{compactNumber(post.likes + (liked ? 1 : 0))}</span>
        </button>
        <button
          className={`flex items-center gap-1.5 text-sm transition hover:text-white ${
            saved ? "text-[#93c8ff]" : "text-[#c7d2e3]"
          } ${highlightKey === "save" ? "tap-bounce-active" : ""}`}
          onClick={toggleSave}
          type="button"
        >
          <span className="text-base">☆</span>
          <span>{compactNumber(post.saves + (saved ? 1 : 0))}</span>
        </button>
        <button
          className={`flex items-center gap-1.5 text-sm text-[#c7d2e3] transition hover:text-white ${
            highlightKey === "share" ? "tap-bounce-active" : ""
          }`}
          onClick={() => triggerHighlight("share")}
          type="button"
        >
          <span className="text-base">↗</span>
          <span>{t("feed.share")}</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`liquid-pill flex-1 rounded-full px-4 py-1.5 text-sm ${
            highlightKey === "composer" ? "composer-glow-active" : ""
          }`}
        >
          <input
            className="w-full bg-transparent py-2 text-sm text-white outline-none placeholder:text-[#6f829d]"
            onChange={(event) => setComposerValue(event.target.value)}
            placeholder={t("feed.commentPlaceholder")}
            type="text"
            value={composerValue}
          />
        </div>
        <button
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#de402a] text-white shadow-[0_14px_28px_rgba(222,64,42,0.24)] transition duration-200 hover:scale-[1.03] hover:bg-[#ea523e] ${
            highlightKey === "publish" ? "tap-bounce-active" : ""
          }`}
          onClick={publishComment}
          type="button"
        >
          <SendRoundedIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  </aside>
  );
};

const CommentRow = ({ comment, emphasized = false }: { comment: CommentRecord; emphasized?: boolean }) => {
  const { t } = useI18n();
  const [activeAction, setActiveAction] = useState<"reply" | "like" | null>(null);

  const triggerAction = (action: "reply" | "like") => {
    setActiveAction(action);
    window.setTimeout(() => {
      setActiveAction((value) => (value === action ? null : value));
    }, 260);
  };

  return (
    <div className={`flex gap-3 rounded-[18px] px-2 py-2 transition ${emphasized ? "tap-soft-active bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}>
      <img alt={comment.author} className="mt-0.5 h-8 w-8 rounded-full object-cover ring-1 ring-white/10" src={comment.avatarSrc} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-white">{comment.author}</span>
          <span className="text-[length:var(--fs-micro)] text-[#7485a0]">{comment.timeLabel}</span>
        </div>
        <p className="mt-1 text-sm leading-6 text-[#d1d9e7]">{comment.content}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-[#7c8ba1]">
          <button className={activeAction === "reply" ? "tap-soft-active" : ""} onClick={() => triggerAction("reply")} type="button">
            {t("feed.reply")}
          </button>
          <button className={activeAction === "like" ? "tap-soft-active" : ""} onClick={() => triggerAction("like")} type="button">
            ♡ {comment.likes}
          </button>
        </div>
      </div>
    </div>
  );
};
