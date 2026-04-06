import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { CommentPanel } from "@/components/user/CommentPanel";
import { compactNumber, findCreator, findPost, posts } from "@/lib/mock-data";

type VideoTab = "详情" | "评论" | "相关";

export default function PostDetailPage() {
  const router = useRouter();
  const post = findPost(String(router.query.postId ?? ""));

  return (
    <>
      <Head>
        <title>{`StreamPump | ${post.title}`}</title>
      </Head>
      {post.type === "VIDEO" ? <VideoPostView /> : <ImagePostView />}
    </>
  );
}

const ImagePostView = () => {
  const router = useRouter();
  const imagePosts = useMemo(() => posts.filter((item) => item.type === "IMAGE"), []);
  const routePostId = String(router.query.postId ?? "");
  const routeIndex = Math.max(0, imagePosts.findIndex((item) => item.id === routePostId));
  const [displayIndex, setDisplayIndex] = useState(routeIndex);
  const [transitionDirection, setTransitionDirection] = useState<"up" | "down">("up");
  const [transitionKey, setTransitionKey] = useState(0);
  const post = imagePosts[displayIndex] ?? imagePosts[0];
  const images = post.gallerySrcs?.length ? post.gallerySrcs : [post.coverSrc];
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    if (routeIndex !== displayIndex && routeIndex >= 0) {
      setTransitionDirection(routeIndex > displayIndex ? "up" : "down");
      setDisplayIndex(routeIndex);
      setTransitionKey((value) => value + 1);
    }
  }, [displayIndex, routeIndex]);

  useEffect(() => {
    setCurrentImage(0);
  }, [post.id]);

  const goPrev = () => setCurrentImage((value) => Math.max(value - 1, 0));
  const goNext = () => setCurrentImage((value) => Math.min(value + 1, images.length - 1));
  const previousPost = displayIndex > 0 ? imagePosts[displayIndex - 1] : null;
  const nextPost = displayIndex < imagePosts.length - 1 ? imagePosts[displayIndex + 1] : null;

  const switchPost = (direction: "up" | "down", nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= imagePosts.length) return;
    setTransitionDirection(direction);
    setDisplayIndex(nextIndex);
    setTransitionKey((value) => value + 1);
    void router.replace(`/posts/${imagePosts[nextIndex].id}`, undefined, { shallow: true, scroll: false });
  };

  return (
    <main className="min-h-screen bg-[#070b11] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1680px] items-center p-3 lg:p-6">
        <section
          className={`glass-card grid min-h-[88vh] w-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] ${
            transitionDirection === "up" ? "content-slide-up" : "content-slide-down"
          }`}
          key={`${post.id}-${transitionKey}`}
        >
          <div className="relative flex min-h-[60vh] items-center justify-center bg-black/34 px-4 py-6 lg:px-8">
            <Link
              className="liquid-pill absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-lg text-white transition hover:bg-white/10"
              href="/explore"
            >
              ←
            </Link>

            {post.stage !== "NONE" ? (
              <div className="liquid-pill absolute left-16 top-4 z-20 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                {post.stage === "S1_DISCOVERY" ? "S1" : post.stage === "S1_BUYOUT" ? "S1 Buyout" : "S2"}
              </div>
            ) : null}

            <div className="liquid-pill absolute right-4 top-4 z-20 rounded-full px-3 py-1 text-xs text-white">
              {currentImage + 1} / {images.length}
            </div>

            <div className="absolute right-4 top-16 z-20 flex flex-col items-center gap-2">
              <button
                className={`liquid-pill flex h-9 w-9 items-center justify-center rounded-full text-white transition ${
                  previousPost ? "hover:bg-white/10" : "cursor-not-allowed opacity-30"
                }`}
                onClick={() => switchPost("down", displayIndex - 1)}
                type="button"
              >
                ↑
              </button>
              <span className="text-xs text-white/60">
                {displayIndex + 1}/{imagePosts.length}
              </span>
              <button
                className={`liquid-pill flex h-9 w-9 items-center justify-center rounded-full text-white transition ${
                  nextPost ? "hover:bg-white/10" : "cursor-not-allowed opacity-30"
                }`}
                onClick={() => switchPost("up", displayIndex + 1)}
                type="button"
              >
                ↓
              </button>
            </div>

            <div className="relative w-full max-w-[760px]">
              <div className="overflow-hidden rounded-[28px] shadow-[0_34px_90px_rgba(0,0,0,0.45)]">
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    transform: `translateX(-${currentImage * (100 / images.length)}%)`,
                    width: `${images.length * 100}%`,
                  }}
                >
                  {images.map((image, index) => (
                    <img
                      alt={`${post.title} ${index + 1}`}
                      className="max-h-[76vh] object-contain"
                      key={`${post.id}-${image}-${index}`}
                      src={image}
                      style={{ width: `${100 / images.length}%` }}
                    />
                  ))}
                </div>
              </div>

              {images.length > 1 ? (
                <>
                  {currentImage > 0 ? (
                    <button
                      className="liquid-pill absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                      onClick={goPrev}
                      type="button"
                    >
                      ‹
                    </button>
                  ) : null}
                  {currentImage < images.length - 1 ? (
                    <button
                      className="liquid-pill absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                      onClick={goNext}
                      type="button"
                    >
                      ›
                    </button>
                  ) : null}
                </>
              ) : null}

              {images.length > 1 ? (
                <div className="mt-5 flex items-center justify-center gap-3 overflow-x-auto">
                  {images.map((image, index) => (
                    <button
                      className={`overflow-hidden rounded-2xl border transition ${
                        index === currentImage
                          ? "border-white/24 shadow-[0_12px_28px_rgba(0,0,0,0.26)]"
                          : "border-white/8 opacity-70 hover:opacity-100"
                      }`}
                      key={`${post.id}-${index}`}
                      onClick={() => setCurrentImage(index)}
                      type="button"
                    >
                      <img alt={`${post.title} ${index + 1}`} className="h-16 w-16 object-cover" src={image} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-[88vh] xl:border-l xl:border-white/8">
            <CommentPanel post={post} />
          </div>
        </section>
      </div>
    </main>
  );
};

const VideoPostView = () => {
  const router = useRouter();
  const videoPosts = useMemo(() => posts.filter((item) => item.type === "VIDEO"), []);
  const routePostId = String(router.query.postId ?? "");
  const routeIndex = Math.max(0, videoPosts.findIndex((item) => item.id === routePostId));
  const [displayIndex, setDisplayIndex] = useState(routeIndex);
  const [transitionDirection, setTransitionDirection] = useState<"up" | "down">("up");
  const [transitionKey, setTransitionKey] = useState(0);
  const post = videoPosts[displayIndex] ?? videoPosts[0];
  const creator = findCreator(post.creatorId);
  const [showComments, setShowComments] = useState(false);
  const [activeTab, setActiveTab] = useState<VideoTab>("评论");
  const previousPost = displayIndex > 0 ? videoPosts[displayIndex - 1] : null;
  const nextPost = displayIndex < videoPosts.length - 1 ? videoPosts[displayIndex + 1] : null;
  const relatedVideos = videoPosts.filter((item) => item.id !== post.id).slice(0, 4);

  useEffect(() => {
    if (routeIndex !== displayIndex && routeIndex >= 0) {
      setTransitionDirection(routeIndex > displayIndex ? "up" : "down");
      setDisplayIndex(routeIndex);
      setTransitionKey((value) => value + 1);
      setShowComments(false);
    }
  }, [displayIndex, routeIndex]);

  const switchVideo = (direction: "up" | "down", nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= videoPosts.length) return;
    setTransitionDirection(direction);
    setDisplayIndex(nextIndex);
    setTransitionKey((value) => value + 1);
    setShowComments(false);
    void router.replace(`/posts/${videoPosts[nextIndex].id}`, undefined, { shallow: true, scroll: false });
  };

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <Link
        className="liquid-pill absolute left-5 top-5 z-40 flex h-11 w-11 items-center justify-center rounded-full text-lg text-white transition hover:bg-white/10"
        href="/explore"
      >
        ←
      </Link>

      <div className="absolute right-5 top-5 z-40 flex flex-col items-center gap-2">
        <Link
          className={`liquid-pill flex h-9 w-9 items-center justify-center rounded-full text-white transition ${
            previousPost ? "hover:bg-white/10" : "pointer-events-none opacity-30"
          }`}
          href={previousPost ? `/posts/${previousPost.id}` : "#"}
          onClick={(event) => {
            if (!previousPost) return;
            event.preventDefault();
            switchVideo("down", displayIndex - 1);
          }}
        >
          ↑
        </Link>
        <span className="text-xs text-white/60">
          {displayIndex + 1}/{videoPosts.length}
        </span>
        <Link
          className={`liquid-pill flex h-9 w-9 items-center justify-center rounded-full text-white transition ${
            nextPost ? "hover:bg-white/10" : "pointer-events-none opacity-30"
          }`}
          href={nextPost ? `/posts/${nextPost.id}` : "#"}
          onClick={(event) => {
            if (!nextPost) return;
            event.preventDefault();
            switchVideo("up", displayIndex + 1);
          }}
        >
          ↓
        </Link>
      </div>

      <section
        className={`relative flex h-full ${transitionDirection === "up" ? "content-slide-up" : "content-slide-down"}`}
        key={`${post.id}-${transitionKey}`}
      >
        <div className="relative flex-1 overflow-hidden">
          <img
            alt={post.title}
            className="absolute inset-0 h-full w-full object-cover"
            src={post.coverSrc}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/14 to-black/38" />

          <div className="absolute bottom-0 left-0 right-0 z-10 p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <Link href={`/creators/${post.creatorId}`}>
                <img
                  alt={post.creatorName}
                  className="h-10 w-10 rounded-full border-2 border-white/40 object-cover"
                  src={post.creatorAvatarSrc}
                />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link className="text-sm font-semibold text-white hover:underline" href={`/creators/${post.creatorId}`}>
                    {post.creatorName}
                  </Link>
                  {post.stage !== "NONE" ? (
                    <span className="liquid-pill rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                      {post.stage === "S1_DISCOVERY" ? "S1" : post.stage === "S1_BUYOUT" ? "S1 Buyout" : "S2"}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-white/65">{post.creatorHandle}</p>
              </div>
              <button className="ml-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/92" type="button">
                关注
              </button>
            </div>

            <h1 className="mt-4 max-w-xl text-[30px] font-semibold leading-[1.12] tracking-[-0.04em] text-white">
              {post.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span className="text-sm text-white/72" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/45">
              {post.timeLabel} · {post.location}
            </p>
          </div>

          <div className="absolute bottom-24 right-4 z-20 flex flex-col items-center gap-5 lg:right-6">
            <ActionRailButton label={compactNumber(post.likes)} symbol="♡" />
            <ActionRailButton
              label={compactNumber(post.commentsCount)}
              onClick={() => setShowComments((value) => !value)}
              symbol="💬"
            />
            <ActionRailButton label={compactNumber(post.saves)} symbol="☆" />
            <ActionRailButton label="分享" symbol="↗" />
          </div>
        </div>

        <div className="hidden h-full w-[420px] border-l border-white/8 bg-[linear-gradient(180deg,rgba(14,21,33,0.96)_0%,rgba(10,16,24,0.98)_100%)] xl:flex xl:flex-col">
          <div className="border-b border-white/8 px-4 pt-4">
            <div className="flex items-center gap-4">
              {(["详情", "评论", "相关"] as VideoTab[]).map((tab) => (
                <button
                  className={`relative pb-4 text-sm transition ${
                    activeTab === tab ? "font-semibold text-white" : "text-[#7f90aa] hover:text-white"
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
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {activeTab === "详情" ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <img alt={creator.name} className="h-11 w-11 rounded-full object-cover" src={creator.avatarSrc} />
                  <div>
                    <p className="text-sm font-semibold text-white">{creator.name}</p>
                    <p className="text-xs text-[#8799b3]">{compactNumber(creator.followersCount)} 粉丝</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold leading-8 tracking-[-0.03em] text-white">{post.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#d3dbe9]">{post.body}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span className="text-xs text-[#89bcff]" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <VideoMetric label="点赞" value={compactNumber(post.likes)} />
                  <VideoMetric label="收藏" value={compactNumber(post.saves)} />
                  <VideoMetric label="评论" value={compactNumber(post.commentsCount)} />
                  <VideoMetric label="阶段" value={post.stage === "NONE" ? "Story" : post.stage === "S1_DISCOVERY" ? "S1" : post.stage === "S1_BUYOUT" ? "S1 Buyout" : "S2"} />
                </div>

                <div className="glass-card p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849e]">Creator signal</p>
                  <p className="mt-2 text-sm leading-7 text-[#d3dbe9]">{creator.teaser}</p>
                </div>
              </div>
            ) : null}

            {activeTab === "评论" ? (
              <div className="space-y-5">
                <p className="text-sm font-semibold text-white">共 {compactNumber(post.commentsCount)} 条评论</p>
                {post.comments.map((comment) => (
                  <VideoCommentRow comment={comment} key={comment.id} />
                ))}
              </div>
            ) : null}

            {activeTab === "相关" ? (
              <div className="space-y-3">
                {relatedVideos.map((related) => (
                  <Link className="block" href={`/posts/${related.id}`} key={related.id}>
                    <div className="glass-card overflow-hidden">
                      <div className="relative">
                        <img alt={related.title} className="h-36 w-full object-cover" src={related.coverSrc} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                      </div>
                      <div className="glass-card-footer px-4 pb-4 pt-4">
                        <p className="line-clamp-2 text-sm font-medium leading-6 text-white">{related.title}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img alt={related.creatorName} className="h-5 w-5 rounded-full object-cover" src={related.creatorAvatarSrc} />
                            <span className="text-xs text-[#8ea0ba]">{related.creatorName}</span>
                          </div>
                          <span className="text-xs text-[#8ea0ba]">♡ {compactNumber(related.likes)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {activeTab === "评论" ? (
            <div className="border-t border-white/8 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="liquid-pill flex-1 rounded-full px-4 py-3 text-sm text-[#6f829d]">
                  说点什么...
                </div>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/92" type="button">
                  ↑
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showComments ? (
        <div className="absolute inset-x-0 bottom-0 z-30 xl:hidden">
          <div className="mx-auto h-[65vh] max-w-2xl overflow-hidden rounded-t-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,21,32,0.96)_0%,rgba(10,16,24,0.98)_100%)] shadow-[0_-24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <span className="text-sm font-semibold text-white">共 {compactNumber(post.commentsCount)} 条评论</span>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 transition hover:bg-white/6"
                onClick={() => setShowComments(false)}
                type="button"
              >
                关闭
              </button>
            </div>
            <div className="h-[calc(65vh-57px)]">
              <CommentPanel post={post} variant="sheet" />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

const ActionRailButton = ({
  symbol,
  label,
  onClick,
}: {
  symbol: string;
  label: string;
  onClick?: () => void;
}) => (
  <button className="flex flex-col items-center gap-1 text-white" onClick={onClick} type="button">
    <div className="liquid-pill flex h-12 w-12 items-center justify-center rounded-full text-sm text-white transition hover:bg-white/10">
      {symbol}
    </div>
    <span className="text-[11px] font-medium drop-shadow-md">{label}</span>
  </button>
);

const VideoMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-card p-4">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#73849e]">{label}</p>
    <p className="mt-2 text-base font-semibold text-white">{value}</p>
  </div>
);

const VideoCommentRow = ({
  comment,
}: {
  comment: ReturnType<typeof findPost>["comments"][number];
}) => (
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
