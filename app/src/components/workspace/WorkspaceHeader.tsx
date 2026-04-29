import Link from "next/link";

import { BellIcon, PlusIcon } from "@/components/shared/AppIcons";
import { WORKSPACE_CONTENT_NEW_PATH } from "@/lib/routes";

export const WorkspaceHeader = ({
  wallet,
  className = "",
}: {
  wallet?: string;
  className?: string;
}) => {
  const shortWallet = wallet
    ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    : null;

  return (
    <header className={`flex h-14 items-center justify-between ${className}`}>
      <h1 className="text-sm font-medium tracking-[-0.02em] text-[#93a2bb]">
        StreamPump <span className="text-white">创作中心</span>
      </h1>

      <div className="flex items-center gap-3">
        {shortWallet && (
          <span className="hidden items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-[#93a2bb] md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#65ecaf]" />
            {shortWallet}
          </span>
        )}

        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-[#93a2bb] transition hover:bg-white/[0.08] hover:text-white"
          type="button"
        >
          <BellIcon className="h-4 w-4" />
        </button>

        <Link
          className="glass-button-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          href={WORKSPACE_CONTENT_NEW_PATH}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          新建内容
        </Link>
      </div>
    </header>
  );
};
