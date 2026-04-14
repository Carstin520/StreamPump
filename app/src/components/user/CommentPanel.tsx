import Link from "next/link";

import { compactNumber, CommentRecord, PostRecord } from "@/lib/mock-data";

export const CommentPanel = ({
  post,
  variant = "sidebar",
}: {
  post: PostRecord;
  variant?: "sidebar" | "sheet";
}) => (
  <aside
    className={`flex h-full flex-col ${
      variant === "sidebar"
        ? "bg-[linear-gradient(180deg,rgba(16,23,34,0.98)_0%,rgba(12,18,28,0.98)_100%)]"
        : "bg-transparent"
    }`}
  >
    <div className="border-b border-white/8 px-5 py-4">
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
              {post.stage !== "NONE" ? (
                <span className="liquid-pill rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
                  {post.stage === "S1_DISCOVERY" ? "S1" : post.stage === "S1_BUYOUT" ? "S1 Buyout" : "S2"}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[#8799b3]">{post.creatorHandle}</p>
          </div>
        </div>
        <button className="liquid-glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10" type="button">
          关注
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-5 py-5">
      <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.03em] text-white">{post.title}</h1>
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

      <div className="my-6 h-px bg-white/8" />

      <p className="mb-5 text-sm font-semibold text-white">共 {compactNumber(post.commentsCount)} 条评论</p>
      <div className="space-y-5">
        {post.comments.map((comment) => (
          <CommentRow comment={comment} key={comment.id} />
        ))}
      </div>
    </div>

    <div className="border-t border-white/8 px-5 py-4">
      <div className="mb-3 flex items-center gap-5 px-1">
        <button className="flex items-center gap-1.5 text-sm text-[#c7d2e3] transition hover:text-white" type="button">
          <span className="text-base">♡</span>
          <span>{compactNumber(post.likes)}</span>
        </button>
        <button className="flex items-center gap-1.5 text-sm text-[#c7d2e3] transition hover:text-white" type="button">
          <span className="text-base">☆</span>
          <span>{compactNumber(post.saves)}</span>
        </button>
        <button className="flex items-center gap-1.5 text-sm text-[#c7d2e3] transition hover:text-white" type="button">
          <span className="text-base">↗</span>
          <span>分享</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="liquid-pill flex-1 rounded-full px-4 py-3 text-sm text-[#6f829d]">
          说点什么...
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#de402a] text-white transition hover:bg-[#ea523e]" type="button">
          ➤
        </button>
      </div>
    </div>
  </aside>
);

const CommentRow = ({ comment }: { comment: CommentRecord }) => (
  <div className="flex gap-3">
    <img alt={comment.author} className="mt-0.5 h-8 w-8 rounded-full object-cover ring-1 ring-white/10" src={comment.avatarSrc} />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-white">{comment.author}</span>
        <span className="text-[10px] text-[#7485a0]">{comment.timeLabel}</span>
      </div>
      <p className="mt-1 text-sm leading-6 text-[#d1d9e7]">{comment.content}</p>
      <div className="mt-2 flex items-center gap-4 text-xs text-[#7c8ba1]">
        <span>回复</span>
        <span>♡ {comment.likes}</span>
      </div>
    </div>
  </div>
);
