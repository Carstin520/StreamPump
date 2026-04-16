"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostCard = void 0;
const link_1 = __importDefault(require("next/link"));
const ProgressiveImage_1 = require("@/components/shared/ProgressiveImage");
const StagePill_1 = require("@/components/shared/StagePill");
const utils_1 = require("@/lib/mocks/utils");
const stageGlow = {
    NONE: "",
    S1_DISCOVERY: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(74,153,255,0.05)]",
    S1_BUYOUT: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(255,89,147,0.05)]",
    S2_ACTIVE: "shadow-[0_18px_44px_rgba(0,0,0,0.22),0_0_22px_rgba(42,211,138,0.04)]",
};
const PostCard = ({ post }) => {
    return (<link_1.default className={`mb-4 inline-block w-full break-inside-avoid ${stageGlow[post.stage]}`} href={`/posts/${post.id}`}>
      <article className="glass-card relative overflow-hidden border-white/[0.06] bg-[#101621]">
        <div className={`relative overflow-hidden ${post.mediaHeightClass} ${post.mediaStyle}`}>
          <ProgressiveImage_1.ProgressiveImage alt={post.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]" fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" src={post.coverSrc}/>
          <div className="absolute inset-0 bg-gradient-to-t from-[#08111c]/82 via-transparent to-transparent"/>

          <div className="absolute left-3 top-3 z-[2]">
            <StagePill_1.StagePill stage={post.stage}/>
          </div>

          {(post.type === "VIDEO" || post.hasMultipleImages) ? (<div className="absolute right-3 top-3 z-[2] flex h-8 min-w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 px-2 text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur-md">
              {post.type === "VIDEO" ? "▶" : "•••"}
            </div>) : null}

          <div className="absolute inset-x-0 bottom-0 z-[2] bg-[linear-gradient(180deg,rgba(8,12,30,0.2)_0%,rgba(8,12,30,0.82)_100%)] px-4 pb-3 pt-3 backdrop-blur-[18px]">
            <p className="line-clamp-2 text-[15px] font-medium leading-6 text-[#f6f8fd]">{post.title}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <img alt={post.creatorName} className="h-6 w-6 rounded-full object-cover" src={post.creatorAvatarSrc}/>
                <span className="truncate text-xs text-[#cbd7e8]">{post.creatorName}</span>
              </div>
              <span className="shrink-0 text-xs text-[#8ea0ba]">♡ {(0, utils_1.compactNumber)(post.likes)}</span>
            </div>
          </div>
        </div>
      </article>
    </link_1.default>);
};
exports.PostCard = PostCard;
