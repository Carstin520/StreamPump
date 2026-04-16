import Link from "next/link";
import { useRouter } from "next/router";

const navItems = [
  { href: "/discover", label: "Discover" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/workspace", label: "Workspace" },
  { href: "/campaigns/proposal-radiantlab-luna", label: "Campaigns" },
];

export const Sidebar = () => {
  const router = useRouter();

  return (
    <aside className="rounded-[28px] border border-white/10 bg-[#09111f]/90 p-5 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
      <div className="mb-8 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.36em] text-sky-200/70">StreamPump</p>
        <div>
          <h1 className="text-xl font-semibold text-white">Growth market for creators</h1>
          <p className="mt-2 text-sm text-slate-400">
            One product surface for S1 discovery, S2 launch, and shared campaign state.
          </p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = router.pathname === item.href || router.asPath === item.href;
          return (
            <Link
              className={`block rounded-2xl px-4 py-3 text-sm transition ${
                active
                  ? "bg-white text-slate-950"
                  : "bg-transparent text-slate-300 hover:bg-white/6 hover:text-white"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Phase 1</p>
        <p className="mt-2 text-sm text-slate-200">Web MVP covers S1 market, content prep, launch bundles, and campaign detail.</p>
      </div>
    </aside>
  );
};
