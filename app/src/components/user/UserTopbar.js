"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserTopbar = void 0;
const link_1 = __importDefault(require("next/link"));
const profile_1 = require("@/lib/mocks/profile");
const UserTopbar = ({ searchPlaceholder = "搜索帖子、创作者、品牌合作", }) => (<header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/[0.05] bg-[#090d14]/70 px-2 backdrop-blur-xl lg:px-0">
    <div className="flex-1 lg:max-w-xl">
      <div className="input-glass group relative rounded-full">
        <input className="h-12 w-full rounded-full bg-transparent pl-5 pr-12 text-sm text-white outline-none placeholder:text-[#6f7d95]" placeholder={searchPlaceholder} type="text"/>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-[#8ea0ba] transition group-focus-within:text-white">
          ⌕
        </span>
      </div>
    </div>

    <div className="ml-4 flex items-center gap-3">
      <link_1.default className="rounded-full bg-[#de402a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(222,64,42,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ea523e]" href="/workspace">
        + 创作中心
      </link_1.default>
      <link_1.default className="surface-muted flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm text-[#c4d0e3] transition duration-200 hover:text-white" href="/me">
        <img alt={profile_1.currentUser.name} className="h-7 w-7 rounded-full object-cover" src={profile_1.currentUser.avatarSrc}/>
        <span className="hidden sm:inline">{profile_1.currentUser.handle}</span>
      </link_1.default>
    </div>
  </header>);
exports.UserTopbar = UserTopbar;
