import Link from "next/link";

import { currentUser } from "@/lib/public-data";

export const UserTopbar = ({
  searchPlaceholder = "搜索帖子、创作者、品牌合作",
}: {
  searchPlaceholder?: string;
}) => (
  <header className="sticky top-0 z-30 pt-4">
    <div className="glass-toolbar flex min-h-[76px] items-center justify-between gap-4 px-3 py-3 lg:px-4">
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
          className="glass-button-primary px-5 py-2.5 text-sm font-semibold"
          href="/workspace"
        >
          + 创作中心
        </Link>
        <Link
          className="glass-button-ghost flex items-center gap-2 px-2.5 py-1.5 text-sm text-[#c4d0e3] transition duration-200 hover:text-white"
          href="/me"
        >
          <img alt={currentUser.name} className="h-7 w-7 rounded-full object-cover" src={currentUser.avatarSrc} />
          <span className="hidden max-w-[140px] truncate sm:inline">{currentUser.handle}</span>
        </Link>
      </div>
    </div>
  </header>
);
