import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import {
  AppleIcon,
  ChevronRightIcon,
  FollowCheckIcon,
  GoogleIcon,
  MailIcon,
  SearchIcon,
  WalletIcon,
} from "@/components/shared/AppIcons";
import {
  createWalletAuthChallenge,
  exchangeProviderSession,
  requestEmailLoginCode,
  verifyEmailLoginCode,
  verifyWalletAuthChallenge,
} from "@/lib/api/auth";
import {
  AuthSessionRecord,
  IdentityProvider,
  LoginMethodRecord,
  LoginPreviewMode,
} from "@/lib/api/types";
import { storeAuthSession } from "@/lib/auth-session";
import { loginAccounts, loginMethods } from "@/lib/public-data";
import { WORKSPACE_PATH } from "@/lib/routes";

type AuthOptionsPanelProps = {
  mode: LoginPreviewMode;
  nextHref?: string;
  onModeChange: (mode: LoginPreviewMode) => void;
};

type PreviewIdentity = {
  provider: IdentityProvider;
  providerSubject: string;
  email?: string | null;
  displayName?: string | null;
};

const METHOD_IDENTITIES: Record<Exclude<LoginMethodRecord["id"], "wallet">, PreviewIdentity> = {
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

const ACCOUNT_IDENTITIES: Record<string, PreviewIdentity | null> = {
  "james-li": METHOD_IDENTITIES.google,
  "neo-preview-account": METHOD_IDENTITIES.apple,
  "wallet-preview-account": null,
};

const previewSocialAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH !== "false";

const PREVIEW_MANAGED_WALLET = "C8tzqwn5ghvKEgkcwf822vxQA5fgt7cmr49mqCtyK8fX";

const createPreviewAccessToken = (source: string) =>
  `preview-local.${source}.${Date.now().toString(36)}`;

const createPreviewExpiresAt = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const createLocalProviderSession = (
  identity: PreviewIdentity,
  wallet = PREVIEW_MANAGED_WALLET,
): AuthSessionRecord => ({
  wallet,
  accessToken: createPreviewAccessToken(identity.provider.toLowerCase()),
  expiresAt: createPreviewExpiresAt(),
  tokenType: "Bearer",
  identity: {
    id: `local-${identity.providerSubject}`,
    provider: identity.provider,
    providerSubject: identity.providerSubject,
    email: identity.email ?? null,
    displayName: identity.displayName ?? null,
    managedWalletAddress: wallet,
  },
});

const createLocalWalletSession = (wallet: string): AuthSessionRecord => ({
  wallet,
  accessToken: createPreviewAccessToken("wallet"),
  expiresAt: createPreviewExpiresAt(),
  tokenType: "Bearer",
  identity: null,
});

const resolveLocalPreviewRedirectHref = (href: string) =>
  href === WORKSPACE_PATH ? `${WORKSPACE_PATH}?demo=1` : href;

const isUserRejectedWalletRequest = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /reject|denied|cancel/i.test(message);
};

const bytesToBase64 = (value: Uint8Array) => {
  let binary = "";

  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
};

export const AuthOptionsPanel = ({
  mode,
  nextHref = WORKSPACE_PATH,
  onModeChange,
}: AuthOptionsPanelProps) => {
  const router = useRouter();
  const { connected, connecting, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState("alex@streampump.local");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeExpiresAt, setEmailCodeExpiresAt] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>("选择邮箱、Google、Apple 或钱包继续。");
  const [pendingWalletLogin, setPendingWalletLogin] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const currentAccount = useMemo(
    () => loginAccounts.find((account) => account.isCurrent) ?? loginAccounts[0],
    [],
  );
  const secondaryAccounts = useMemo(
    () => loginAccounts.filter((account) => account.id !== currentAccount.id),
    [currentAccount.id],
  );

  const resolveMethodIdentity = useCallback(
    (methodId: Exclude<LoginMethodRecord["id"], "wallet">): PreviewIdentity => {
      if (methodId !== "email") {
        return METHOD_IDENTITIES[methodId];
      }

      const email = emailValue.trim() || METHOD_IDENTITIES.email.email || "alex@streampump.local";
      const providerSubject = `preview-email-${email.toLowerCase()}`;

      return {
        ...METHOD_IDENTITIES.email,
        email,
        providerSubject,
      };
    },
    [emailValue],
  );

  const createPreviewSession = async (identity: PreviewIdentity, successLabel: string) => {
    if (!previewSocialAuthEnabled) {
      setLastAction("社交登录预览被环境变量关闭，请使用钱包登录。");
      return;
    }

    setBusyKey(identity.providerSubject);
    setLastAction(`正在创建 ${successLabel} 会话...`);

    try {
      const session = await exchangeProviderSession(identity);
      storeAuthSession(session);
      setLastAction(`${successLabel} 会话已创建，正在进入产品。`);
      void router.push(nextHref);
    } catch (error) {
      const session = createLocalProviderSession(identity);
      storeAuthSession(session);
      setLastAction(`${successLabel} 本地预览会话已创建，后端不可用时也可继续浏览。`);
      void router.push(resolveLocalPreviewRedirectHref(nextHref));
    } finally {
      setBusyKey(null);
    }
  };

  const completeWalletLogin = useCallback(async () => {
    if (!publicKey) {
      return;
    }

    const walletAddress = publicKey.toBase58();
    setBusyKey("wallet");
    setPendingWalletLogin(false);
    setLastAction("正在创建钱包登录会话...");

    try {
      if (!signMessage) {
        const session = createLocalWalletSession(walletAddress);
        storeAuthSession(session);
        setLastAction("钱包已连接，本地预览会话已创建。");
        void router.push(resolveLocalPreviewRedirectHref(nextHref));
        return;
      }

      const challenge = await createWalletAuthChallenge(walletAddress);
      const signatureBytes = await signMessage(new TextEncoder().encode(challenge.message));
      const session = await verifyWalletAuthChallenge({
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature: bytesToBase64(signatureBytes),
      });

      storeAuthSession(session);
      setLastAction("钱包会话已创建，正在进入产品。");
      void router.push(nextHref);
    } catch (error) {
      if (isUserRejectedWalletRequest(error)) {
        setLastAction("钱包签名已取消，未创建会话。");
        return;
      }

      const session = createLocalWalletSession(walletAddress);
      storeAuthSession(session);
      setLastAction("钱包已连接，本地预览会话已创建。");
      void router.push(resolveLocalPreviewRedirectHref(nextHref));
    } finally {
      setBusyKey(null);
    }
  }, [nextHref, publicKey, router, signMessage]);

  useEffect(() => {
    if (!pendingWalletLogin || !connected || !publicKey || busyKey) {
      return;
    }

    void completeWalletLogin();
  }, [busyKey, completeWalletLogin, connected, pendingWalletLogin, publicKey]);

  const handleWalletLogin = async () => {
    if (!connected || !publicKey) {
      setPendingWalletLogin(true);
      setVisible(true);
      setLastAction("请选择并连接 Solana 钱包，连接成功后会自动继续登录。");
      return;
    }

    await completeWalletLogin();
  };

  const handleEmailRequestCode = async () => {
    const email = emailValue.trim();
    if (!email) {
      setLastAction("请输入邮箱地址。");
      return;
    }

    setBusyKey("email");
    setLastAction("正在发送邮箱验证码...");

    try {
      const challenge = await requestEmailLoginCode(email);
      setEmailCode("");
      setEmailCodeExpiresAt(challenge.expiresAt);
      setLastAction("验证码已发送，请查看邮箱。");
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : "邮箱验证码发送失败。");
    } finally {
      setBusyKey(null);
    }
  };

  const handleEmailVerifyCode = async () => {
    const email = emailValue.trim();
    const code = emailCode.trim();
    if (!email || !code) {
      setLastAction("请输入邮箱和验证码。");
      return;
    }

    setBusyKey("email-verify");
    setLastAction("正在验证邮箱验证码...");

    try {
      const session = await verifyEmailLoginCode({ email, code });
      storeAuthSession(session);
      setLastAction("邮箱会话已创建，正在进入产品。");
      void router.push(nextHref);
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : "邮箱验证码验证失败。");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMethod = async (method: LoginMethodRecord) => {
    if (method.id === "wallet") {
      await handleWalletLogin();
      return;
    }

    if (method.id === "email") {
      await handleEmailRequestCode();
      return;
    }

    await createPreviewSession(resolveMethodIdentity(method.id), method.label);
  };

  const handleAccountSwitch = async (accountId: string, accountName: string) => {
    const identity = ACCOUNT_IDENTITIES[accountId];
    if (!identity) {
      setLastAction(`${accountName} will use the connected wallet instead of the old preview path.`);
      await handleWalletLogin();
      return;
    }

    await createPreviewSession(identity, `${accountName} account`);
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

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7f90ab]">
                Email
              </span>
              <input
                className="card-radius w-full border border-white/[0.08] bg-[#0d1420]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#53627a] focus:border-[#de513c]/60 focus:bg-[#111a2a]"
                inputMode="email"
                onChange={(event) => setEmailValue(event.target.value)}
                placeholder="you@domain.com"
                type="email"
                value={emailValue}
              />
            </label>

            {emailCodeExpiresAt ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7f90ab]">
                    Verification code
                  </span>
                  <input
                    className="card-radius w-full border border-white/[0.08] bg-[#0d1420]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#53627a] focus:border-[#de513c]/60 focus:bg-[#111a2a]"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    type="text"
                    value={emailCode}
                  />
                </label>
                <button
                  className="card-radius flex w-full items-center justify-center border border-[#5fca9f]/25 bg-[#113222] px-4 py-3 text-sm font-semibold text-[#87e7bd] transition hover:border-[#87e7bd]/45 disabled:cursor-wait disabled:opacity-70"
                  disabled={Boolean(busyKey) || !emailCode.trim()}
                  onClick={() => void handleEmailVerifyCode()}
                  type="button"
                >
                  Verify email code
                </button>
              </div>
            ) : null}

            <div className="space-y-3">
              {loginMethods.map((method) => {
                const identity = method.id === "wallet" ? null : resolveMethodIdentity(method.id);
                const methodBusy = method.id === "email"
                  ? busyKey === "email" || busyKey === "email-verify"
                  : busyKey === (identity?.providerSubject ?? "wallet");
                const socialDisabled = method.id !== "wallet" && method.id !== "email" && !previewSocialAuthEnabled;

                return (
                  <button
                    className={`card-radius group flex w-full items-center justify-between border px-4 py-4 text-left transition ${
                      method.tone === "wallet"
                        ? "border-[#7a4d27] bg-[linear-gradient(180deg,rgba(60,31,18,0.56)_0%,rgba(25,17,13,0.72)_100%)] text-[#ffd0a6] hover:border-[#b06f34]"
                        : "border-white/[0.08] bg-[#111827]/88 text-white hover:border-white/[0.14] hover:bg-[#151d2b]"
                    } ${methodBusy ? "cursor-wait opacity-80" : ""}`}
                    disabled={Boolean(busyKey) || socialDisabled}
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
                        <p className={`mt-1 text-xs ${method.tone === "wallet" ? "text-[#dca56e]" : "text-[#8193ad]"}`}>
                          {method.id === "email"
                            ? emailCodeExpiresAt
                              ? "重新发送邮箱验证码"
                              : "发送一次性邮箱验证码"
                            : socialDisabled
                              ? "社交登录已被环境变量关闭"
                              : method.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.id === "email" ? (
                        <span className="rounded-full border border-[#5fca9f]/20 bg-[#113222] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#87e7bd]">
                          OTP
                        </span>
                      ) : socialDisabled ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7f90ab]">
                          Env off
                        </span>
                      ) : method.id === "wallet" ? (
                        <span className="rounded-full border border-[#8f5824] bg-[#59341d] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffb86d]">
                          {connecting ? "Connecting" : connected ? "Wallet ready" : "Web3"}
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#5fca9f]/20 bg-[#113222] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#87e7bd]">
                          Ready
                        </span>
                      )}
                      <ChevronRightIcon className="h-4 w-4 text-white/46 transition group-hover:text-white/86" />
                    </div>
                  </button>
                );
              })}
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
                    className="card-radius flex w-full items-center justify-between border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-80"
                    disabled={Boolean(busyKey)}
                    key={account.id}
                    onClick={() => void handleAccountSwitch(account.id, account.name)}
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
