import Link from "next/link";

import { currentUser } from "@/lib/mock-data";

export const UserTopbar = ({
  searchPlaceholder = "搜索帖子、创作者、品牌合作",
}: {
  searchPlaceholder?: string;
}) => (
  <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/6 bg-[#090d14]/82 px-2 backdrop-blur-xl lg:px-0">
    <div className="flex-1 lg:max-w-xl">
      <div className="group relative">
        <input
          className="h-11 w-full rounded-full border border-white/6 bg-white/[0.04] pl-5 pr-12 text-sm text-white outline-none transition placeholder:text-[#6f7d95] focus:border-white/12 focus:bg-white/[0.06]"
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
        className="rounded-full bg-[#ff516d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#ff627b]"
        href="/workspace"
      >
        创作中心
      </Link>
      <Link
        className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-sm text-[#c4d0e3] transition hover:text-white"
        href="/me"
      >
        <img alt={currentUser.name} className="h-7 w-7 rounded-full object-cover" src={currentUser.avatarSrc} />
        <span className="hidden sm:inline">{currentUser.handle}</span>
      </Link>
    </div>
  </header>
);
