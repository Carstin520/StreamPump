"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthOptionsPanel = void 0;
const router_1 = require("next/router");
const react_1 = require("react");
const AppIcons_1 = require("@/components/shared/AppIcons");
const auth_1 = require("@/lib/api/auth");
const auth_session_1 = require("@/lib/auth-session");
const auth_2 = require("@/lib/mocks/auth");
const METHOD_IDENTITIES = {
    email: {
        provider: "EMAIL",
        providerSubject: "preview-email-alex-chen",
        email: "alex+email@streampump.local",
        displayName: "Alex Chen",
    },
    google: {
        provider: "GOOGLE",
        providerSubject: "preview-google-alex-chen",
        email: "alex+google@streampump.local",
        displayName: "Alex Chen",
    },
    apple: {
        provider: "APPLE",
        providerSubject: "preview-apple-neo-park",
        email: "neo+apple@streampump.local",
        displayName: "Neo Park",
    },
};
const ACCOUNT_IDENTITIES = {
    "james-li": METHOD_IDENTITIES.google,
    "neo-preview-account": METHOD_IDENTITIES.apple,
    "wallet-preview-account": null,
};
const resolveMethodIdentity = (methodId) => {
    if (methodId === "wallet") {
        return null;
    }
    return METHOD_IDENTITIES[methodId];
};
const AuthOptionsPanel = ({ mode, onModeChange }) => {
    const router = (0, router_1.useRouter)();
    const [busyKey, setBusyKey] = (0, react_1.useState)(null);
    const [lastAction, setLastAction] = (0, react_1.useState)("Preview mode: social login first.");
    const [showAccounts, setShowAccounts] = (0, react_1.useState)(false);
    const [walletConnected, setWalletConnected] = (0, react_1.useState)(false);
    const currentAccount = (0, react_1.useMemo)(() => auth_2.loginAccounts.find((account) => account.isCurrent) ?? auth_2.loginAccounts[0], []);
    const secondaryAccounts = (0, react_1.useMemo)(() => auth_2.loginAccounts.filter((account) => account.id !== currentAccount.id), [currentAccount.id]);
    const createPreviewSession = async (identity, successLabel) => {
        setBusyKey(identity.providerSubject);
        setLastAction(`Starting ${successLabel} session...`);
        try {
            const session = await (0, auth_1.exchangeProviderSession)(identity);
            (0, auth_session_1.storeAuthSession)(session);
            setLastAction(`${successLabel} session ready. Redirecting to workspace.`);
            void router.push("/workspace");
        }
        catch (error) {
            setLastAction(error instanceof Error ? error.message : `Failed to create ${successLabel} session.`);
        }
        finally {
            setBusyKey(null);
        }
    };
    const handleMethod = async (method) => {
        if (method.id === "wallet") {
            setWalletConnected((value) => !value);
            setLastAction(walletConnected ? "Wallet session preview ended." : "Wallet connect preview fired, but real challenge/verify wiring is still pending in tracked UI.");
            return;
        }
        await createPreviewSession(METHOD_IDENTITIES[method.id], method.label);
    };
    const handleAccountSwitch = async (accountId, accountName) => {
        const identity = ACCOUNT_IDENTITIES[accountId];
        if (!identity) {
            setLastAction(`${accountName} still maps to the wallet-preview path. Use social login for a real tracked session.`);
            return;
        }
        await createPreviewSession(identity, `${accountName} account`);
    };
    return (<section className="liquid-panel relative mx-auto w-full max-w-[480px] overflow-hidden border border-white/[0.08] px-6 py-7 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_64%)]"/>

      <div className="relative">
        <div className="mb-8 flex items-center justify-end gap-2">
          {["welcome", "switch"].map((previewMode) => (<button className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${mode === previewMode
                ? "liquid-pill-active text-white"
                : "liquid-pill text-[#97a7bf] hover:text-white"}`} key={previewMode} onClick={() => onModeChange(previewMode)} type="button">
              {previewMode === "welcome" ? "初次登录" : "切换账号"}
            </button>))}
        </div>

        {mode === "welcome" ? (<div className="space-y-6">
            <div className="text-center">
              <h2 className="text-[40px] font-semibold tracking-[-0.05em] text-white">欢迎回来</h2>
              <p className="mt-3 text-sm text-[#93a3bb]">登录或注册 StreamPump 账号</p>
            </div>

            <div className="space-y-3">
              {auth_2.loginMethods.map((method) => {
                const identity = resolveMethodIdentity(method.id);
                const methodBusy = busyKey === (identity?.providerSubject ?? "wallet");
                return (<button className={`card-radius group flex w-full items-center justify-between border px-4 py-4 text-left transition ${method.tone === "wallet"
                        ? "border-[#7a4d27] bg-[linear-gradient(180deg,rgba(60,31,18,0.56)_0%,rgba(25,17,13,0.72)_100%)] text-[#ffd0a6] hover:border-[#b06f34]"
                        : "border-white/[0.08] bg-[#111827]/88 text-white hover:border-white/[0.14] hover:bg-[#151d2b]"} ${methodBusy ? "cursor-wait opacity-80" : ""}`} disabled={Boolean(busyKey)} key={method.id} onClick={() => void handleMethod(method)} type="button">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${method.tone === "wallet" ? "bg-[#2e1e17]" : "bg-white/[0.07]"}`}>
                        <LoginMethodIcon id={method.id}/>
                      </span>
                      <div>
                        <p className="text-sm font-medium">{method.label}</p>
                        <p className={`mt-1 text-xs ${method.tone === "wallet" ? "text-[#dca56e]" : "text-[#8193ad]"}`}>{method.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.id === "wallet" ? (<span className="rounded-full border border-[#8f5824] bg-[#59341d] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffb86d]">
                          Web3
                        </span>) : null}
                      <AppIcons_1.ChevronRightIcon className="h-4 w-4 text-white/46 transition group-hover:text-white/86"/>
                    </div>
                  </button>);
            })}
            </div>

            <p className="text-center text-xs text-[#70819d]">
              继续即表示你同意 <span className="text-[#96a8c0]">服务条款</span> 和 <span className="text-[#96a8c0]">隐私政策</span>
            </p>
          </div>) : (<div className="space-y-5">
            <div className="text-center">
              <h2 className="text-[32px] font-semibold tracking-[-0.05em] text-white">切换账号</h2>
              <p className="mt-3 text-sm text-[#93a3bb]">继续当前身份，或切换到另一个 StreamPump 会话</p>
            </div>

            <div className="card-radius border border-white/[0.08] bg-[#111827]/90 p-5 shadow-[0_20px_52px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-4">
                <img alt={currentAccount.name} className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10" src={currentAccount.avatarSrc}/>
                <div className="min-w-0">
                  <p className="truncate text-[32px] font-semibold tracking-[-0.05em] text-white">{currentAccount.name}</p>
                  <p className="mt-1 text-lg text-[#97a7bf]">{currentAccount.handle}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="liquid-pill rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/92">{currentAccount.sessionLabel}</span>
                <span className="liquid-pill rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#93a3bb]">{currentAccount.methodLabel}</span>
              </div>
            </div>

            <button className="card-radius flex w-full items-center justify-between border border-white/[0.08] bg-[#0f1522] px-5 py-5 text-left text-white transition hover:border-white/[0.14] hover:bg-[#141b29]" onClick={() => {
                setShowAccounts((value) => {
                    const nextValue = !value;
                    setLastAction(nextValue ? "Expanded alternate accounts preview." : "Switched back to compact account view.");
                    return nextValue;
                });
            }} type="button">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-[#9fb0ca]">
                  <AppIcons_1.SearchIcon className="h-5 w-5"/>
                </span>
                <div>
                  <p className="text-[18px] font-semibold tracking-[-0.03em]">切换账号</p>
                  <p className="mt-1 text-sm text-[#8ea0ba]">查看其他登录身份与钱包会话</p>
                </div>
              </div>
              <AppIcons_1.ChevronRightIcon className={`h-5 w-5 text-white/52 transition ${showAccounts ? "rotate-90" : ""}`}/>
            </button>

            {showAccounts ? (<div className="card-radius space-y-3 border border-white/[0.08] bg-[#0d1420]/90 p-3">
                {secondaryAccounts.map((account) => (<button className="card-radius flex w-full items-center justify-between border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-80" disabled={Boolean(busyKey)} key={account.id} onClick={() => void handleAccountSwitch(account.id, account.name)} type="button">
                    <div className="flex items-center gap-3">
                      <img alt={account.name} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" src={account.avatarSrc}/>
                      <div>
                        <p className="text-sm font-medium text-white">{account.name}</p>
                        <p className="mt-1 text-xs text-[#8697b1]">{account.handle} · {account.methodLabel}</p>
                      </div>
                    </div>
                    <AppIcons_1.FollowCheckIcon className="h-4 w-4 text-[#93c8ff]"/>
                  </button>))}
              </div>) : null}
          </div>)}

        <div className="mt-6 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs text-[#7f90ab]">
          {lastAction}
        </div>
      </div>
    </section>);
};
exports.AuthOptionsPanel = AuthOptionsPanel;
const LoginMethodIcon = ({ id }) => {
    if (id === "email") {
        return <AppIcons_1.MailIcon className="h-4 w-4"/>;
    }
    if (id === "google") {
        return <AppIcons_1.GoogleIcon className="h-4 w-4"/>;
    }
    if (id === "apple") {
        return <AppIcons_1.AppleIcon className="h-4 w-4"/>;
    }
    return <AppIcons_1.WalletIcon className="h-4 w-4"/>;
};
