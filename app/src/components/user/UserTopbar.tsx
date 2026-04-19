import Link from "next/link";

import { currentUser } from "@/lib/public-data";

export const UserTopbar = ({
  searchPlaceholder = "搜索帖子、创作者、品牌合作",
}: {
  searchPlaceholder?: string;
}) => (
  <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/[0.05] bg-[#090d14]/70 px-2 backdrop-blur-xl lg:px-0">
    <div className="flex-1 lg:max-w-xl">
      <div className="input-glass group relative rounded-full">
        <input
          className="h-12 w-full rounded-full bg-transparent pl-5 pr-12 text-sm text-white outline-none placeholder:text-[#6f7d95]"
          placeholder={searchPlaceholder}
          type="text"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-[#8ea0ba] transition group-focus-within:text-white">
          ⌕
        </span>
      </div>
    </div>

    <div className="ml-4 flex items-center gap-3">
      <Link
        className="rounded-full bg-[#de402a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(222,64,42,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ea523e]"
        href="/workspace"
      >
        + 创作中心
      </Link>
      <Link
        className="surface-muted flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm text-[#c4d0e3] transition duration-200 hover:text-white"
        href="/me"
      >
        <img alt={currentUser.name} className="h-7 w-7 rounded-full object-cover" src={currentUser.avatarSrc} />
        <span className="hidden sm:inline">{currentUser.handle}</span>
      </Link>
    </div>
  </header>
);
