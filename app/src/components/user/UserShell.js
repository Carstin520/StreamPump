"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserShell = void 0;
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
const AnimatedFeedBackdrop_1 = require("@/components/shared/AnimatedFeedBackdrop");
const AppIcons_1 = require("@/components/shared/AppIcons");
const profile_1 = require("@/lib/mocks/profile");
const primaryNav = [
    { href: "/explore", label: "发现", match: ["/", "/explore", "/discover", "/posts"] },
    { href: "/activity", label: "动态", match: ["/activity"] },
    { href: "/trending", label: "Trending", match: ["/trending"] },
    { href: "/portfolio", label: "投资组合", match: ["/portfolio"] },
];
const UserShell = ({ children, header, }) => {
    const router = (0, router_1.useRouter)();
    const isActive = (href, match) => match.some((prefix) => (prefix === "/" ? router.pathname === "/" || router.pathname === "/discover" : router.pathname.startsWith(prefix))) ||
        router.asPath === href;
    return (<main className="relative min-h-[100dvh] overflow-hidden bg-[#090d14] text-[#f5f7fb]">
      <AnimatedFeedBackdrop_1.AnimatedFeedBackdrop />

      <aside className="app-shell-frame fixed left-0 top-0 z-40 hidden h-[100dvh] w-16 border-r border-white/[0.05] bg-[#090d14]/90 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center justify-center border-b border-white/[0.05] lg:justify-start lg:px-6">
          <link_1.default className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(222,64,42,0.32)]" href="/explore">
            SP
          </link_1.default>
          <span className="ml-3 hidden text-lg font-bold tracking-[-0.05em] text-white lg:block">
            StreamPump
          </span>
        </div>

        <nav className="flex-1 space-y-2 px-2 py-6 lg:px-4">
          {primaryNav.map((item) => (<link_1.default className={`group flex h-12 items-center justify-center rounded-2xl px-3 text-sm transition duration-200 lg:justify-start ${isActive(item.href, item.match)
                ? "border border-white/10 bg-white/[0.08] text-white shadow-[0_14px_34px_rgba(0,0,0,0.14)]"
                : "border border-transparent text-[#8f9eb7] hover:border-white/8 hover:bg-white/[0.05] hover:text-white"}`} href={item.href} key={item.href}>
              {item.label}
            </link_1.default>))}
        </nav>

        <div className="space-y-2 border-t border-white/[0.05] p-2 lg:p-4">
          <link_1.default href="/me">
            <div className={`surface-muted flex h-12 items-center justify-center rounded-2xl border px-1 transition duration-200 lg:h-auto lg:justify-start lg:px-3 lg:py-3 ${router.pathname.startsWith("/me")
            ? "border-white/[0.12] bg-white/[0.08] text-white"
            : "text-white/80 hover:bg-white/[0.07]"}`}>
              <img alt={profile_1.currentUser.name} className="h-8 w-8 rounded-full object-cover" src={profile_1.currentUser.avatarSrc}/>
              <div className="ml-3 hidden min-w-0 lg:block">
                <p className="truncate text-sm font-medium text-white">{profile_1.currentUser.name}</p>
                <p className="truncate text-xs text-[#8fa1bd]">{profile_1.currentUser.handle}</p>
              </div>
            </div>
          </link_1.default>

          <link_1.default href="/login?preview=switch">
            <div className="surface-muted flex h-12 items-center justify-center rounded-2xl border px-1 text-white/80 transition duration-200 hover:bg-white/[0.07] lg:justify-start lg:px-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-[#9dadc6]">
                <AppIcons_1.SwitchAccountIcon className="h-4 w-4"/>
              </span>
              <span className="ml-3 hidden text-sm font-medium text-white lg:block">切换账号</span>
            </div>
          </link_1.default>
        </div>
      </aside>

      <div className="relative lg:ml-64">
        <div className="page-enter mx-auto max-w-[1440px] space-y-6 px-4 py-4 lg:px-6 lg:py-0">
          {header}
          {children}
        </div>
      </div>
    </main>);
};
exports.UserShell = UserShell;
