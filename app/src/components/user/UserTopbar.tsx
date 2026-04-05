import Link from "next/link";

import { currentUser } from "@/lib/mock-data";

const categoryTone: Record<string, string> = {
  推荐: "from-[#3b5fa8]/70 to-[#243864]/70",
  穿搭: "from-[#6b4da3]/72 to-[#3a275a]/72",
  美妆: "from-[#87417c]/72 to-[#4b2246]/72",
  科技: "from-[#24607f]/72 to-[#17354e]/72",
  健身: "from-[#26556b]/72 to-[#1a3248]/72",
  游戏: "from-[#5b4588]/72 to-[#30234b]/72",
  城市: "from-[#4f627e]/72 to-[#253246]/72",
  创作者观察: "from-[#556c3c]/72 to-[#29351d]/72",
};

export const UserTopbar = ({
  categories,
  activeCategory,
  title,
  subtitle,
}: {
  categories?: string[];
  activeCategory?: string;
  title?: string;
  subtitle?: string;
}) => (
  <header className="sticky top-0 z-30 space-y-4 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,18,28,0.96)_0%,rgba(10,15,24,0.92)_100%)] px-6 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3 lg:min-w-[240px]">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,#243a64_0%,#172740_100%)] text-sm font-semibold text-[#d8ecff] lg:hidden">
          SP
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-[#6f809f]">StreamPump user surface</p>
          {title ? <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-white">{title}</h1> : null}
          {subtitle ? <p className="mt-1 text-sm text-[#91a0b7]">{subtitle}</p> : null}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="hidden max-w-[720px] flex-1 items-center rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,#101826_0%,#0c131d_100%)] px-5 py-4 lg:flex">
          <input
            className="w-full bg-transparent text-sm text-[#f3f7ff] outline-none placeholder:text-[#6f7d95]"
            placeholder="搜索帖子、创作者、品牌合作"
            type="text"
          />
          <span className="text-xl text-[#8ea0ba]">⌕</span>
        </div>
        <Link className="rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,#152235_0%,#101a29_100%)] px-5 py-3 text-sm text-[#eef4ff] shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:bg-[#18263d]" href="/workspace">
          创作中心
        </Link>
        <Link className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-2 text-sm text-[#c4d0e3] hover:text-white" href="/me">
          <img
            alt={currentUser.name}
            className="h-8 w-8 rounded-full border border-white/10 object-cover"
            src={currentUser.avatarSrc}
          />
          {currentUser.handle}
        </Link>
      </div>
    </div>

    {categories ? (
      <div className="flex gap-3 overflow-x-auto pb-1 text-sm">
        {categories.map((category) => (
          <button
            className={`whitespace-nowrap rounded-full border px-4 py-2.5 transition ${
              category === activeCategory
                ? "border-white/16 bg-white text-black"
                : `border-white/8 bg-gradient-to-r ${categoryTone[category] ?? "from-white/5 to-white/5"} text-[#edf2fb] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/16`
            }`}
            key={category}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
    ) : null}
  </header>
);
