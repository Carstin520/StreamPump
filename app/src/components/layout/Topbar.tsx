import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

import { currentUser } from "@/lib/mock-data";
import { Badge } from "@/components/shared/Badge";
import { useWeb3Auth } from "@/components/Wallet/Web3AuthContext";

export const Topbar = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) => {
  const wallet = useWallet();
  const { provider } = useWeb3Auth();

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[#0d1627]/88 p-5 text-slate-100 shadow-[0_20px_70px_rgba(2,6,23,0.4)] lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={provider ? "Social session active" : "Social session idle"} tone={provider ? "success" : "neutral"} />
          <Badge label={wallet.connected ? "External wallet connected" : "External wallet optional"} tone={wallet.connected ? "warm" : "neutral"} />
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
        </div>
      </div>

      <div className="min-w-[240px] rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session</p>
        <p className="mt-2 text-sm font-medium text-white">{currentUser.name}</p>
        <p className="text-sm text-slate-300">{currentUser.handle}</p>
        <p className="mt-2 text-xs text-slate-400">{currentUser.sessionMode}</p>
        <p className="mt-1 text-xs text-slate-500">{currentUser.primaryWallet}</p>
        <div className="mt-4 flex items-center gap-2">
          {action}
          <Link className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 hover:bg-white/8" href="/login">
            Auth
          </Link>
        </div>
      </div>
    </div>
  );
};
