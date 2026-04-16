"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceShell = void 0;
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
const UserShell_1 = require("@/components/user/UserShell");
const UserTopbar_1 = require("@/components/user/UserTopbar");
const tabs = [
    { href: "/workspace", label: "Overview" },
    { href: "/workspace/content/new", label: "Create Content" },
];
const WorkspaceShell = ({ title, subtitle, action, children, }) => {
    const router = (0, router_1.useRouter)();
    return (<UserShell_1.UserShell header={<UserTopbar_1.UserTopbar searchPlaceholder="搜索内容包、launch、品牌合作"/>}>
      <div className="space-y-6 py-4">
        <section className="liquid-panel section-enter relative overflow-hidden rounded-[34px] p-6 md:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#de402a]/10 blur-3xl"/>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7486a1]">Workspace</p>
              <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] text-white">{title}</h1>
              <p className="mt-4 text-sm leading-7 text-[#95a6bf]">{subtitle}</p>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {tabs.map((tab) => {
            const active = router.asPath === tab.href;
            return (<link_1.default className={`rounded-full px-4 py-2 text-sm transition duration-200 ${active
                    ? "bg-white text-[#08101a] shadow-[0_14px_28px_rgba(255,255,255,0.12)]"
                    : "liquid-pill text-white hover:scale-[1.02] hover:bg-white/10"}`} href={tab.href} key={tab.href}>
                  {tab.label}
                </link_1.default>);
        })}
          </div>
        </section>

        {children}
      </div>
    </UserShell_1.UserShell>);
};
exports.WorkspaceShell = WorkspaceShell;
