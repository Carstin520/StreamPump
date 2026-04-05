import Link from "next/link";
import { useRouter } from "next/router";

const tabs = [
  { href: "/workspace", label: "Overview" },
  { href: "/workspace/content/new", label: "Create Content" },
  { href: "/workspace/intents/intent-luna-radiantlab", label: "Launch Intent" },
];

export const WorkspaceTabs = () => {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = router.asPath === tab.href;
        return (
          <Link
            className={`rounded-full px-4 py-2 text-sm ${
              active ? "bg-white text-slate-950" : "bg-white/6 text-slate-200 hover:bg-white/10"
            }`}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};
