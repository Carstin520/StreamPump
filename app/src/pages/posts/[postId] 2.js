"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PostDetailPage;
const head_1 = __importDefault(require("next/head"));
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
const react_1 = require("react");
const CommentPanel_1 = require("@/components/user/CommentPanel");
const mock_data_1 = require("@/lib/mock-data");
function PostDetailPage() {
    const router = (0, router_1.useRouter)();
    const post = (0, mock_data_1.findPost)(String(router.query.postId ?? ""));
    return (<>
      <head_1.default>
        <title>{`StreamPump | ${post.title}`}</title>
      </head_1.default>
      {post.type === "VIDEO" ? <VideoPostView /> : <ImagePostView />}
    </>);
}
const ImagePostView = () => {
    const router = (0, router_1.useRouter)();
    const post = (0, mock_data_1.findPost)(String(router.query.postId ?? ""));
    const images = post.gallerySrcs?.length ? post.gallerySrcs : [post.coverSrc];
    const [currentImage, setCurrentImage] = (0, react_1.useState)(0);
    const goPrev = () => setCurrentImage((value) => Math.max(value - 1, 0));
    const goNext = () => setCurrentImage((value) => Math.min(value + 1, images.length - 1));
    return (<main className="min-h-screen bg-[#090d14] text-white">
      <section className="grid min-h-screen grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative flex items-center justify-center bg-black/50 p-6 xl:p-8">
          <link_1.default className="absolute left-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-lg text-white backdrop-blur-md transition hover:bg-black/55" href="/explore">
            ←
          </link_1.default>

          <div className="relative w-full max-w-[620px]">
            <img alt={post.title} className="max-h-[84vh] w-full rounded-[28px] object-contain shadow-[0_34px_90px_rgba(0,0,0,0.45)]" src={images[currentImage]}/>

            {images.length > 1 ? (<>
                {currentImage > 0 ? (<button className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65" onClick={goPrev} type="button">
                    ‹
                  </button>) : null}
                {currentImage < images.length - 1 ? (<button className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65" onClick={goNext} type="button">
                    ›
                  </button>) : null}
                <div className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {currentImage + 1} / {images.length}
                </div>
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-2 backdrop-blur-sm">
                    {images.map((_, index) => (<button className={`rounded-full transition-all ${index === currentImage ? "h-1.5 w-4 bg-white" : "h-1.5 w-1.5 bg-white/45 hover:bg-white/70"}`} key={`${post.id}-${index}`} onClick={() => setCurrentImage(index)} type="button"/>))}
                  </div>
                </div>
              </>) : null}
          </div>
        </div>

        <div className="min-h-screen">
          <CommentPanel_1.CommentPanel post={post}/>
        </div>
      </section>
    </main>);
};
const VideoPostView = () => {
    const router = (0, router_1.useRouter)();
    const postId = String(router.query.postId ?? "");
    const videoPosts = (0, react_1.useMemo)(() => mock_data_1.posts.filter((item) => item.type === "VIDEO"), []);
    const currentIndex = Math.max(0, videoPosts.findIndex((item) => item.id === postId));
    const post = videoPosts[currentIndex] ?? videoPosts[0];
    const [showComments, setShowComments] = (0, react_1.useState)(true);
    const previousPost = currentIndex > 0 ? videoPosts[currentIndex - 1] : null;
    const nextPost = currentIndex < videoPosts.length - 1 ? videoPosts[currentIndex + 1] : null;
    return (<main className="fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <link_1.default className="absolute left-5 top-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/45 text-lg backdrop-blur-md transition hover:bg-black/65" href="/explore">
        ←
      </link_1.default>

      <div className="absolute right-5 top-5 z-40 flex flex-col items-center gap-2">
        <link_1.default className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition ${previousPost ? "hover:bg-black/65" : "pointer-events-none opacity-30"}`} href={previousPost ? `/posts/${previousPost.id}` : "#"}>
          ↑
        </link_1.default>
        <span className="text-xs text-white/60">
          {currentIndex + 1}/{videoPosts.length}
        </span>
        <link_1.default className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition ${nextPost ? "hover:bg-black/65" : "pointer-events-none opacity-30"}`} href={nextPost ? `/posts/${nextPost.id}` : "#"}>
          ↓
        </link_1.default>
      </div>

      <div className="absolute right-[72px] top-5 z-40 flex flex-col gap-1 items-center">
        {videoPosts.map((item, index) => (<div className={`w-1 rounded-full transition-all duration-300 ${item.id === post.id ? "h-6 bg-white" : "h-1.5 bg-white/30"}`} key={`${item.id}-${index}`}/>))}
      </div>

      <section className="relative flex h-full">
        <div className="relative flex-1 overflow-hidden">
          <img alt={post.title} className="absolute inset-0 h-full w-full object-cover" src={post.coverSrc}/>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/12 to-black/35"/>

          <div className="absolute bottom-0 left-0 right-0 z-10 p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <link_1.default href={`/creators/${post.creatorId}`}>
                <img alt={post.creatorName} className="h-10 w-10 rounded-full border-2 border-white/40 object-cover" src={post.creatorAvatarSrc}/>
              </link_1.default>
              <div>
                <link_1.default className="text-sm font-semibold text-white hover:underline" href={`/creators/${post.creatorId}`}>
                  {post.creatorName}
                </link_1.default>
                <p className="text-xs text-white/65">{post.creatorHandle}</p>
              </div>
              <button className="ml-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90" type="button">
                关注
              </button>
            </div>

            <h1 className="mt-4 max-w-xl text-[30px] font-semibold leading-[1.12] tracking-[-0.04em] text-white">
              {post.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (<span className="text-sm text-white/72" key={tag}>
                  #{tag}
                </span>))}
            </div>
            <p className="mt-2 text-xs text-white/45">
              {post.timeLabel} · {post.location}
            </p>
          </div>

          <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-5 items-center lg:right-6">
            {[
            `♡ ${(0, mock_data_1.compactNumber)(post.likes)}`,
            `💬 ${(0, mock_data_1.compactNumber)(post.commentsCount)}`,
            `☆ ${(0, mock_data_1.compactNumber)(post.saves)}`,
            "↗ 分享",
        ].map((label, index) => (<button className="flex flex-col items-center gap-1 text-white" key={`${post.id}-${index}-${label}`} onClick={() => {
                if (label.includes("💬"))
                    setShowComments((value) => !value);
            }} type="button">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-black/45 text-sm backdrop-blur-md transition hover:bg-black/65">
                  {label.split(" ")[0]}
                </div>
                <span className="text-[11px] font-medium drop-shadow-md">{label.split(" ").slice(1).join(" ")}</span>
              </button>))}
          </div>
        </div>

        <div className="hidden h-full w-[420px] border-l border-white/8 xl:block">
          <CommentPanel_1.CommentPanel post={post}/>
        </div>
      </section>

      {showComments ? (<div className="absolute inset-x-0 bottom-0 z-30 xl:hidden">
          <div className="mx-auto h-[65vh] max-w-2xl overflow-hidden rounded-t-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,21,32,0.96)_0%,rgba(10,16,24,0.98)_100%)] shadow-[0_-24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <span className="text-sm font-semibold text-white">共 {(0, mock_data_1.compactNumber)(post.commentsCount)} 条评论</span>
              <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 transition hover:bg-white/6" onClick={() => setShowComments(false)} type="button">
                关闭
              </button>
            </div>
            <div className="h-[calc(65vh-57px)]">
              <CommentPanel_1.CommentPanel post={post} variant="sheet"/>
            </div>
          </div>
        </div>) : null}
    </main>);
};
