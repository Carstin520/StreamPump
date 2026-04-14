import { useMemo, useState } from "react";

import {
  AppleIcon,
  ChevronRightIcon,
  FollowCheckIcon,
  GoogleIcon,
  MailIcon,
  SearchIcon,
  WalletIcon,
} from "@/components/shared/AppIcons";
import { useWeb3Auth } from "@/components/Wallet/Web3AuthContext";
import {
  LoginMethodRecord,
  LoginPreviewMode,
  loginAccounts,
  loginMethods,
} from "@/lib/mock-data";

type AuthOptionsPanelProps = {
  mode: LoginPreviewMode;
  onModeChange: (mode: LoginPreviewMode) => void;
};

export const AuthOptionsPanel = ({ mode, onModeChange }: AuthOptionsPanelProps) => {
  const { connect, disconnect, isReady, provider } = useWeb3Auth();
  const [lastAction, setLastAction] = useState<string>("Preview mode: social login first.");
  const [showAccounts, setShowAccounts] = useState(false);

  const currentAccount = useMemo(
    () => loginAccounts.find((account) => account.isCurrent) ?? loginAccounts[0],
    [],
  );
  const secondaryAccounts = useMemo(
    () => loginAccounts.filter((account) => account.id !== currentAccount.id),
    [currentAccount.id],
  );

  const handleMethod = async (method: LoginMethodRecord) => {
    if (method.id === "wallet") {
      if (!provider && isReady) {
        await connect();
        setLastAction("Wallet connect preview fired through Web3Auth.");
        return;
      }

      if (provider) {
        await disconnect();
        setLastAction("Wallet session preview ended.");
        return;
      }
    }

    setLastAction(`${method.label} selected. This prototype keeps the flow front-loaded and low-friction.`);
  };

  return (
    <section className="liquid-panel relative mx-auto w-full max-w-[480px] overflow-hidden border border-white/[0.08] px-6 py-7 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_64%)]" />

      <div className="relative">
        <div className="mb-8 flex items-center justify-end gap-2">
          {(["welcome", "switch"] as LoginPreviewMode[]).map((previewMode) => (
            <button
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                mode === previewMode
                  ? "liquid-pill-active text-white"
                  : "liquid-pill text-[#97a7bf] hover:text-white"
              }`}
              key={previewMode}
              onClick={() => onModeChange(previewMode)}
              type="button"
            >
              {previewMode === "welcome" ? "初次登录" : "切换账号"}
            </button>
          ))}
        </div>

        {mode === "welcome" ? (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-[40px] font-semibold tracking-[-0.05em] text-white">欢迎回来</h2>
              <p className="mt-3 text-sm text-[#93a3bb]">登录或注册 StreamPump 账号</p>
            </div>

            <div className="space-y-3">
              {loginMethods.map((method) => (
                <button
                  className={`card-radius group flex w-full items-center justify-between border px-4 py-4 text-left transition ${
                    method.tone === "wallet"
                      ? "border-[#7a4d27] bg-[linear-gradient(180deg,rgba(60,31,18,0.56)_0%,rgba(25,17,13,0.72)_100%)] text-[#ffd0a6] hover:border-[#b06f34]"
                      : "border-white/[0.08] bg-[#111827]/88 text-white hover:border-white/[0.14] hover:bg-[#151d2b]"
                  }`}
                  key={method.id}
                  onClick={() => void handleMethod(method)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${method.tone === "wallet" ? "bg-[#2e1e17]" : "bg-white/[0.07]"}`}>
                      <LoginMethodIcon id={method.id} />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{method.label}</p>
                      <p className={`mt-1 text-xs ${method.tone === "wallet" ? "text-[#dca56e]" : "text-[#8193ad]"}`}>{method.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.id === "wallet" ? (
                      <span className="rounded-full border border-[#8f5824] bg-[#59341d] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffb86d]">
                        Web3
                      </span>
                    ) : null}
                    <ChevronRightIcon className="h-4 w-4 text-white/46 transition group-hover:text-white/86" />
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-[#70819d]">
              继续即表示你同意 <span className="text-[#96a8c0]">服务条款</span> 和 <span className="text-[#96a8c0]">隐私政策</span>
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-[32px] font-semibold tracking-[-0.05em] text-white">切换账号</h2>
              <p className="mt-3 text-sm text-[#93a3bb]">继续当前身份，或切换到另一个 StreamPump 会话</p>
            </div>

            <div className="card-radius border border-white/[0.08] bg-[#111827]/90 p-5 shadow-[0_20px_52px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-4">
                <img alt={currentAccount.name} className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10" src={currentAccount.avatarSrc} />
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

            <button
              className="card-radius flex w-full items-center justify-between border border-white/[0.08] bg-[#0f1522] px-5 py-5 text-left text-white transition hover:border-white/[0.14] hover:bg-[#141b29]"
              onClick={() => {
                setShowAccounts((value) => {
                  const nextValue = !value;
                  setLastAction(nextValue ? "Expanded alternate accounts preview." : "Switched back to compact account view.");
                  return nextValue;
                });
              }}
              type="button"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-[#9fb0ca]">
                  <SearchIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[18px] font-semibold tracking-[-0.03em]">切换账号</p>
                  <p className="mt-1 text-sm text-[#8ea0ba]">查看其他登录身份与钱包会话</p>
                </div>
              </div>
              <ChevronRightIcon className={`h-5 w-5 text-white/52 transition ${showAccounts ? "rotate-90" : ""}`} />
            </button>

            {showAccounts ? (
              <div className="card-radius space-y-3 border border-white/[0.08] bg-[#0d1420]/90 p-3">
                {secondaryAccounts.map((account) => (
                  <button
                    className="card-radius flex w-full items-center justify-between border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                    key={account.id}
                    onClick={() => setLastAction(`Preview switched focus to ${account.name}.`)}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <img alt={account.name} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" src={account.avatarSrc} />
                      <div>
                        <p className="text-sm font-medium text-white">{account.name}</p>
                        <p className="mt-1 text-xs text-[#8697b1]">{account.handle} · {account.methodLabel}</p>
                      </div>
                    </div>
                    <FollowCheckIcon className="h-4 w-4 text-[#93c8ff]" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-6 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs text-[#7f90ab]">
          {lastAction}
        </div>
      </div>
    </section>
  );
};

const LoginMethodIcon = ({ id }: { id: LoginMethodRecord["id"] }) => {
  if (id === "email") {
    return <MailIcon className="h-4 w-4" />;
  }

  if (id === "google") {
    return <GoogleIcon className="h-4 w-4" />;
  }

  if (id === "apple") {
    return <AppleIcon className="h-4 w-4" />;
  }

  return <WalletIcon className="h-4 w-4" />;
};
